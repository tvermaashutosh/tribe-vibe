// Pure formatting, shared by cli.js and Play.jsx — both print this right
// before handing off to mpv, once via directPlay's onReady(playlist), so you
// know what's queued up before the terminal becomes mpv's.
export function formatPlaylistSongList(playlist, indent = 0) {
  const header = `Playlist "${playlist.name}" — ${playlist.songs.length} song${playlist.songs.length === 1 ? '' : 's'}:`;
  const lines = playlist.songs.map((song, i) => `  ${i + 1}. ${song.title}`);
  const padding = ' '.repeat(indent);
  return [header, ...lines].map((line) => `${padding}${line}`).join('\n');
}
