import { playForeground } from './playForeground.js';

// Shared by the typed CLI and the Ink "Play" screen — both hand off to a real
// foreground mpv the same way, so this is the one place that logic lives.
// onReady, if given, fires once the download finishes and right before mpv
// takes over the terminal — that's the accurate moment to print "Now
// playing", not before (the file isn't ready yet) and not after (mpv has
// already exited by the time this whole call resolves).
export async function playSongForeground({ resolver, platform, videoId, title, loop, onReady }) {
  const localFile = await resolver.downloadAudio(videoId, platform.getCacheDir());
  if (onReady) onReady();
  await playForeground({ files: [{ path: localFile, title }], loop });
}

// Every song is downloaded before mpv ever starts — one at a time, in
// playlist order, same as a single song's download-then-play. mpv is never
// handed a raw YouTube URL here; that's what caused header mismatches and
// pipe-format-detection failures in the first place (see YoutubeResolver).
export async function playPlaylistForeground({ resolver, platform, playlistRepo, playlistName, loop, onReady }) {
  const playlist = playlistRepo.all().find((entry) => entry.name === playlistName);
  if (!playlist) throw new Error(`No playlist named "${playlistName}"`);
  if (playlist.songs.length === 0) throw new Error(`Playlist "${playlistName}" has no songs yet`);

  const files = [];
  for (const song of playlist.songs) {
    const path = await resolver.downloadAudio(song.videoId, platform.getCacheDir());
    files.push({ path, title: song.title });
  }
  // Passed the whole playlist (not just its name) so a caller can print the
  // song list before mpv takes over the terminal — right here is the last
  // moment stdout is still ours; once playForeground starts, mpv owns it.
  if (onReady) onReady(playlist);
  await playForeground({ files, loop });
}
