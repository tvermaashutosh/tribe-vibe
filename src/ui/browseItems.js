// Pulled out of Play.jsx, plain logic with no JSX, so it's testable without
// needing a real TTY (Ink components can't be unit-tested here).
import { sortByRecency } from './sortByRecency.js';
import { alignColumns } from './alignColumns.js';

// Every song alias and playlist, in one browsable list, grouped song ->
// playlist (most-specific/most-likely-to-be-what-you-want first), and
// within each chunk most-recently-touched first — playlist names live in
// the exact same flat token namespace as aliases (TokenRegistry/
// assertValidToken already enforce that non-intersection), so this is just
// "everything you can play with one click," listed. Artist aliases are
// deliberately never shown here: picking one doesn't play anything by
// itself, it opens an ambiguous search — everything in this list, by
// contrast, plays in a single click, the same way selecting it here would.
// The Artists screen is where an artist alias actually lives now.
//
// Every label is "token → value (type)" columnar-aligned across the WHOLE
// list — the token column is as wide as the longest token among every song
// and playlist row combined, same for the value column before it, so "→"
// and "(" both start at the same left position on every row, no matter
// which of the two kinds a given row is. Nothing is ever truncated to fit —
// a column just grows to fit its longest value.
export function buildBrowseItems(aliasRepo, playlistRepo) {
  const songs = sortByRecency(aliasRepo.all().filter((alias) => alias.type === 'song')).map((alias) => ({
    itemType: 'song',
    token: alias.token,
    displayValue: alias.title,
    displayType: 'song',
    videoId: alias.videoId,
    title: alias.title,
  }));
  const playlists = sortByRecency(playlistRepo.all()).map((playlist) => ({
    itemType: 'playlist',
    token: playlist.name,
    displayValue: `${playlist.songs.length} song${playlist.songs.length === 1 ? '' : 's'}`,
    displayType: 'playlist',
    playlistName: playlist.name,
  }));
  const entries = [...songs, ...playlists];
  const columns = alignColumns(entries.map((entry) => [entry.token, '→', entry.displayValue, `(${entry.displayType})`]));
  return entries.map(({ displayValue, displayType, ...entry }, i) => ({ ...entry, label: columns[i].join('  ') }));
}

// Selecting an item from the browse list plays it exactly as if you'd typed
// that token and pressed enter — both kinds shown here resolve
// deterministically, no ambiguous search involved. Building the intent
// directly from the repo entry (we already have videoId/title/name in hand)
// rather than reconstructing a query string and re-parsing it through
// resolveTypedInput.
export function intentForBrowseItem(item) {
  if (item.itemType === 'song') return { kind: 'song', deterministic: true, videoId: item.videoId, title: item.title, modifiers: {} };
  return { kind: 'playlist', deterministic: true, playlistName: item.playlistName, modifiers: {} };
}
