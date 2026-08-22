import { truncateToWidth, getTerminalWidth } from '../text/truncateToWidth.js';

// Pure formatting, shared by cli.js and Play.jsx — both print this right
// before handing off to mpv, once via directPlay's onReady(playlist), so you
// know what's queued up before the terminal becomes mpv's.
export function formatPlaylistSongList(playlist) {
  const header = `Playlist "${playlist.name}" — ${playlist.songs.length} song${playlist.songs.length === 1 ? '' : 's'}:`;
  const width = getTerminalWidth();
  const lines = playlist.songs.map((song, i) => {
    const prefix = `  ${i + 1}. `;
    return prefix + truncateToWidth(song.title, Math.max(width - prefix.length, 0));
  });
  return [header, ...lines].join('\n');
}
