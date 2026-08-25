import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// YouTube's serving behavior for direct/streamed URLs shifts over time (which
// player clients still get plain https URLs, which formats are offered) —
// these are the failure signatures worth naming instead of dumping raw
// yt-dlp stderr on the user.
function enrichError(rawMessage, fallback) {
  const message = (rawMessage || '').trim() || fallback;
  if (/HTTP Error 403|Forbidden/i.test(message)) {
    return new Error(
      `${message}\nA 403 usually means YouTube changed which player clients still work, not a stale yt-dlp — try: yt-dlp -U`,
    );
  }
  if (/Requested format is not available/i.test(message)) {
    return new Error(
      `${message}\nYouTube may have changed what formats it serves — try: yt-dlp -U, then yt-dlp -F <url> to see what's actually offered.`,
    );
  }
  if (/timed out|timeout/i.test(message)) {
    return new Error(`${message}\nLooks like a slow/flaky connection — worth just trying again.`);
  }
  return new Error(message);
}

// Bounds every network attempt instead of trusting yt-dlp's own defaults (10
// retries, no socket-timeout unless told) — on a genuinely stalled
// connection those compound into a long, silent, unbounded wait with zero
// feedback (this is what a "sometimes 1-2 minute hang while playing" turned
// out to be). 10s per attempt, 3 attempts: a real connection succeeds on the
// first try well within that; a truly dead one now fails fast with a clear
// error instead of however long the OS's own TCP retry timeout happens to be.
const NETWORK_TIMEOUT_ARGS = ['--socket-timeout', '10', '--retries', '3', '--fragment-retries', '3'];

// A hard ceiling on the whole yt-dlp invocation, on top of the flags above —
// those only catch a fully stalled connection (no data at all for 10s);
// they don't catch one that's still trickling in, just very slowly, which
// isn't a "stall" by yt-dlp's own definition and would otherwise run
// forever. Confirmed live: a genuinely slow connection took 97s to fetch a
// 4MB file with the flags above already active — a shorter ceiling would
// have killed that legitimate, if slow, download. 120s gives a real
// slow-but-working connection a fair shot at still finishing, while giving
// every case a real, predictable end instead of an open-ended one.
const PROCESS_TIMEOUT_MS = 120_000;

// Strategy: today's source is YouTube via yt-dlp, but nothing upstream should
// assume that — a SoundCloud or local-file resolver could implement the same
// methods and swap in without touching the pipeline, commands, or UI.
export class YoutubeResolver {
  // processTimeoutMs is overridable so a test can prove the kill-after-
  // timeout behavior itself in milliseconds, instead of actually waiting out
  // the real 90s ceiling every time.
  constructor({ processTimeoutMs = PROCESS_TIMEOUT_MS } = {}) {
    this.processTimeoutMs = processTimeoutMs;
  }

  toWatchUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  spawnYtdlp(args) {
    const proc = spawn('yt-dlp', args);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
    }, this.processTimeoutMs);
    proc.once('exit', () => clearTimeout(timer));
    return { proc, didTimeOut: () => timedOut };
  }

  timeoutError(label) {
    return new Error(`${label} timed out after ${this.processTimeoutMs / 1000}s — looks like a slow/stalled connection, worth trying again.`);
  }

  search(query, top) {
    return new Promise((resolve, reject) => {
      const { proc, didTimeOut } = this.spawnYtdlp([
        `ytsearch${top}:${query}`,
        '--dump-json',
        '--flat-playlist',
        '--no-warnings',
        ...NETWORK_TIMEOUT_ARGS,
      ]);
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      proc.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      proc.on('error', (err) => {
        reject(new Error(`yt-dlp is not available — is it installed? (${err.message})`));
      });
      proc.on('close', (code) => {
        if (didTimeOut()) {
          reject(this.timeoutError('Search'));
          return;
        }
        if (code !== 0) {
          reject(enrichError(stderr, 'yt-dlp search failed'));
          return;
        }
        const results = stdout
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line))
          .map((entry) => ({ videoId: entry.id, title: entry.title, duration: entry.duration }));
        resolve(results);
      });
    });
  }

  // Downloads the audio to a real local file and hands mpv that instead of a
  // raw YouTube URL — mpv's own internal ytdl_hook streaming is what caused
  // header-mismatch and pipe-format-detection failures in practice; a plain
  // local file sidesteps all of that. Cached by videoId under cacheDir since
  // aliases/playlists are meant to be replayed, not searched fresh each time.
  downloadAudio(videoId, cacheDir) {
    return new Promise((resolve, reject) => {
      fs.mkdirSync(cacheDir, { recursive: true });

      const cached = fs.readdirSync(cacheDir).find((name) => name.startsWith(`${videoId}.`));
      if (cached) {
        resolve(path.join(cacheDir, cached));
        return;
      }

      const { proc, didTimeOut } = this.spawnYtdlp([
        '-f',
        'bestaudio/best',
        '--no-warnings',
        '-o',
        path.join(cacheDir, '%(id)s.%(ext)s'),
        ...NETWORK_TIMEOUT_ARGS,
        this.toWatchUrl(videoId),
      ]);
      let stderr = '';
      proc.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      proc.on('error', (err) => {
        reject(new Error(`yt-dlp is not available — is it installed? (${err.message})`));
      });
      proc.on('close', (code) => {
        if (didTimeOut()) {
          reject(this.timeoutError('Download'));
          return;
        }
        if (code !== 0) {
          reject(enrichError(stderr, 'yt-dlp download failed'));
          return;
        }
        const downloaded = fs.readdirSync(cacheDir).find((name) => name.startsWith(`${videoId}.`));
        if (!downloaded) {
          reject(new Error('Download finished but no file was produced — see the yt-dlp output above.'));
          return;
        }
        resolve(path.join(cacheDir, downloaded));
      });
    });
  }
}
