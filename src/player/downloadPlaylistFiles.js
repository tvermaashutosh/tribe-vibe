import { trace } from '../debugTrace.js';

// Pulled out of directPlay.js's own playPlaylistForeground, plain logic with
// no Ink/mpv involved, so it's testable without needing a real TTY.
//
// Runs up to `concurrency` downloads at once instead of strictly one song at
// a time — same "skip a failure, keep going" semantics playPlaylistForeground
// always had: onSongFailed fires per song, and the returned array is always
// in the playlist's own order, never completion order (mpv needs the real
// playlist order; racing downloads finish in whatever order the network
// happens to hand them back, not the order they were started in). A shared
// cursor (nextIndex), not fixed batches — a fast download doesn't have to
// wait for a slow one started alongside it before picking up the next song.
export async function downloadPlaylistFiles({ resolver, cacheDir, songs, concurrency = 1, onSongFailed }) {
  const files = new Array(songs.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < songs.length) {
      const index = nextIndex;
      nextIndex += 1;
      const song = songs[index];
      try {
        const localFile = await resolver.downloadAudio(song.videoId, cacheDir);
        files[index] = { path: localFile, title: song.title };
      } catch (err) {
        trace(`downloadPlaylistFiles: skipping "${song.title}" (${song.videoId}) — download failed: ${err.message}`);
        if (onSongFailed) onSongFailed(song, err);
      }
    }
  }

  // Clamped to at least 1 (a corrupted/invalid setting shouldn't spawn zero
  // workers and download nothing at all) and never more workers than there
  // are songs (an extra worker would just find nextIndex already past the
  // end and return immediately — harmless, but pointless to even start).
  const workerCount = Math.max(1, Math.min(concurrency, songs.length));
  await Promise.all(Array.from({ length: workerCount }, worker));

  return files.filter(Boolean);
}
