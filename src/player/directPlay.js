import { playForeground } from './playForeground.js';
import { downloadPlaylistFiles } from './downloadPlaylistFiles.js';
import { trace } from '../debugTrace.js';

// Shared by the typed CLI and the Ink "Play" screen — both hand off to a real
// foreground mpv the same way, so this is the one place that logic lives.
// onReady, if given, fires once the download finishes and right before mpv
// takes over the terminal — that's the accurate moment to announce what's
// about to play, not before (the file isn't ready yet) and not after (mpv
// has already exited by the time this whole call resolves). Passed the
// downloaded file's local path: mpv itself only prints its own "Playing:
// <path>" line for a genuine multi-entry playlist, never for a lone file
// (confirmed live — no flag changes that), so a caller wanting the same
// line for a single song has to print it itself, using the same path mpv
// would have shown.
export async function playSongForeground({ resolver, platform, videoId, title, loop, onReady }) {
  trace(`playSongForeground: downloading videoId=${videoId}`);
  const localFile = await resolver.downloadAudio(videoId, platform.getCacheDir());
  trace(`playSongForeground: downloaded to ${localFile}, calling onReady`);
  if (onReady) onReady(localFile);
  trace('playSongForeground: calling playForeground');
  await playForeground({ files: [{ path: localFile, title }], loop, platform });
  trace('playSongForeground: playForeground resolved, returning');
}

// Every song is downloaded before mpv ever starts, in playlist order — one
// at a time by default, or up to `concurrency` at once when a caller passes
// Settings' own concurrentDownloads through (see downloadPlaylistFiles.js).
// Either way the resulting file list is always in playlist order, never
// download-completion order. mpv is never handed a raw YouTube URL here;
// that's what caused header mismatches and pipe-format-detection failures in
// the first place (see YoutubeResolver).
//
// onPlaylistFound fires immediately, before any downloading — that's the
// accurate moment to print what's queued up, not after the whole thing has
// already downloaded and is about to play. onReady keeps its usual meaning:
// fires right before mpv takes over the terminal.
//
// An empty playlist is nothing to play, not a system failure — it doesn't
// deserve the same "tv error:" + nonzero exit as a genuine crash.
// onEmpty lets a caller handle it gracefully instead; a caller that doesn't
// pass one keeps the old throw, so nothing that already relies on it breaks.
//
// One song's download failing (deleted from YouTube, a genuine network
// error after its own retries) doesn't deserve to take the other 9 down
// with it, discarding everything already downloaded — it's skipped instead,
// same "nothing to play here" spirit as onEmpty above. onSongFailed lets a
// caller report which ones were skipped and why; a caller that doesn't pass
// one just gets the skip silently (still traced) rather than a crash either
// way. Only if every song fails is there genuinely nothing to play, which
// throws same as the empty-playlist case does when onEmpty isn't given.
export async function playPlaylistForeground({ resolver, platform, playlistRepo, playlistName, loop, concurrency, onPlaylistFound, onEmpty, onSongFailed, onReady }) {
  const playlist = playlistRepo.all().find((entry) => entry.name === playlistName);
  if (!playlist) throw new Error(`No playlist named "${playlistName}"`);
  if (playlist.songs.length === 0) {
    if (onEmpty) return onEmpty(playlist);
    throw new Error(`Playlist "${playlistName}" has no songs yet`);
  }

  if (onPlaylistFound) onPlaylistFound(playlist);

  const files = await downloadPlaylistFiles({
    resolver,
    cacheDir: platform.getCacheDir(),
    songs: playlist.songs,
    concurrency,
    onSongFailed,
  });
  if (files.length === 0) throw new Error(`Playlist "${playlistName}": every song failed to download`);
  if (onReady) onReady(playlist);
  await playForeground({ files, loop, platform });
}
