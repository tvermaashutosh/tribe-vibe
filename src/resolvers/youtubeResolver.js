import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// YouTube's serving behavior for direct/streamed URLs shifts over time (which
// player clients still get plain https URLs, which formats are offered) —
// these are the failure signatures worth naming instead of dumping raw
// yt-dlp stderr on the user. Takes the config-hint path as a param rather
// than hardcoding one — that path is OS-dependent (yt-dlp doesn't even look
// at ~/.config on Windows), so the platform adapter is the one place that's
// allowed to know it.
function enrichError(rawMessage, fallback, ytDlpConfigHint) {
  const message = (rawMessage || '').trim() || fallback;
  if (/HTTP Error 403|Forbidden/i.test(message)) {
    return new Error(
      `${message}\nA 403 usually means YouTube changed which player clients still work, not a stale yt-dlp — try: yt-dlp -U\nCheck ${ytDlpConfigHint} (player_client / remote-components) too.`,
    );
  }
  if (/Requested format is not available/i.test(message)) {
    return new Error(
      `${message}\nYouTube may have changed what formats it serves — try: yt-dlp -U, then yt-dlp -F <url> to see what's actually offered.\nCheck ${ytDlpConfigHint} (player_client / remote-components) too.`,
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
// out to be). Deliberately NOT a flat wall-clock cap on the whole process —
// an earlier version of this fix added one, and it broke long songs: a
// 10-minute track, let alone a 1-hour compilation, is a much bigger file
// that takes genuinely longer to transfer even on a perfectly healthy
// connection, and a flat cap can't tell that apart from a real stall.
// --socket-timeout/--retries/--fragment-retries only fire when NO bytes are
// arriving for that many seconds — a size-agnostic definition of "stuck"
// that a slow-but-still-flowing download for a long song never trips,
// while a truly dead connection still fails predictably (3 attempts × 10s
// each, worst case) instead of hanging on whatever the OS's own default
// timeout happens to be.
const NETWORK_TIMEOUT_ARGS = ['--socket-timeout', '10', '--retries', '3', '--fragment-retries', '3'];

// Strategy: today's source is YouTube via yt-dlp, but nothing upstream should
// assume that — a SoundCloud or local-file resolver could implement the same
// methods and swap in without touching the pipeline, commands, or UI.
export class YoutubeResolver {
  constructor(platform) {
    this.platform = platform;
  }

  toWatchUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  // tswift's own dependency check names the exact install command for every
  // missing tool, not just "is it installed?" — this matches that for the
  // one binary this class depends on.
  missingBinaryError(err) {
    return new Error(`yt-dlp is not available — is it installed? (${err.message}) Try: ${this.platform.getInstallInstructions()}`);
  }

  search(query, top) {
    return new Promise((resolve, reject) => {
      const proc = spawn('yt-dlp', [
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
        reject(this.missingBinaryError(err));
      });
      proc.on('close', (code) => {
        if (code !== 0) {
          reject(enrichError(stderr, 'yt-dlp search failed', this.platform.getYtDlpConfigHint()));
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

      const proc = spawn('yt-dlp', [
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
        reject(this.missingBinaryError(err));
      });
      proc.on('close', (code) => {
        if (code !== 0) {
          reject(enrichError(stderr, 'yt-dlp download failed', this.platform.getYtDlpConfigHint()));
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
