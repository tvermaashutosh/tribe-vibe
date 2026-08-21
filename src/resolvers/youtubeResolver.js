import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// YouTube's serving behavior for direct/streamed URLs shifts over time (which
// player clients still get plain https URLs, which formats are offered) —
// these are the two failure signatures worth naming instead of dumping raw
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
  return new Error(message);
}

// Strategy: today's source is YouTube via yt-dlp, but nothing upstream should
// assume that — a SoundCloud or local-file resolver could implement the same
// methods and swap in without touching the pipeline, commands, or UI.
export class YoutubeResolver {
  toWatchUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  search(query, top) {
    return new Promise((resolve, reject) => {
      const proc = spawn('yt-dlp', [`ytsearch${top}:${query}`, '--dump-json', '--flat-playlist', '--no-warnings']);
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

      const proc = spawn('yt-dlp', [
        '-f',
        'bestaudio/best',
        '--no-warnings',
        '-o',
        path.join(cacheDir, '%(id)s.%(ext)s'),
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
