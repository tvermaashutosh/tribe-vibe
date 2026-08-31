// Pulled out of Playlists.jsx's list mode, same reason buildBrowseItems was
// pulled out of Play.jsx: plain logic with no JSX, testable without a real
// TTY. Only the playlist rows themselves — the divider and the static
// "+ New playlist/Back" rows stay in the component, since they're never part
// of the aligned columns. Expects playlists already sorted (the component
// needs that same sorted order for its own detail-mode lookup, so it's the
// caller's to do once, not this function's to redo).
import { alignColumns } from './alignColumns.js';

export function buildPlaylistListItems(playlists) {
  const rows = playlists.map((playlist) => ({
    name: playlist.name,
    count: `${playlist.songs.length} songs`,
  }));
  const columns = alignColumns(rows.map((row) => [row.name, '→', row.count]));
  return rows.map((row, i) => ({ label: columns[i].join('  '), value: row.name }));
}
