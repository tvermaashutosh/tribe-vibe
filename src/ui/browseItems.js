// Pulled out of Play.jsx, plain logic with no JSX, so it's testable without
// needing a real TTY (Ink components can't be unit-tested here).
import { sortByRecency } from './sortByRecency.js';

// Every artist alias, song alias, and playlist, in one browsable list,
// grouped song -> playlist -> artist (most-specific/most-likely-to-be-what-
// you-want first), and within each chunk most-recently-touched first —
// playlist names live in the exact same flat token namespace as aliases
// (TokenRegistry/assertValidToken already enforce that non-intersection), so
// this is just "everything you can invoke by name," listed. Aliases.jsx
// deliberately keeps playlists out of its own listing — this is the one
// place they're shown alongside aliases, since it's a discovery aid for what
// you can type, not a management screen.
//
// Every label is "token → value (type)" in full — Ink wraps it onto as many
// lines as it needs when it doesn't fit, same as any other text in the app.
export function buildBrowseItems(aliasRepo, playlistRepo) {
  const aliases = aliasRepo.all();
  const songItems = sortByRecency(aliases.filter((alias) => alias.type === 'song')).map((alias) => ({
    itemType: 'song',
    token: alias.token,
    label: `${alias.token}  →  ${alias.title}  (song)`,
    videoId: alias.videoId,
    title: alias.title,
  }));
  const playlistItems = sortByRecency(playlistRepo.all()).map((playlist) => ({
    itemType: 'playlist',
    token: playlist.name,
    label: `${playlist.name}  →  ${playlist.songs.length} song${playlist.songs.length === 1 ? '' : 's'}  (playlist)`,
    playlistName: playlist.name,
  }));
  const artistItems = sortByRecency(aliases.filter((alias) => alias.type === 'artist')).map((alias) => ({
    itemType: 'artist',
    token: alias.token,
    label: `${alias.token}  →  ${alias.value}  (artist)`,
    artistName: alias.value,
  }));
  return [...songItems, ...playlistItems, ...artistItems];
}

// Selecting an item from the browse list plays it exactly as if you'd typed
// that token and pressed enter — an artist alone resolves to the same
// ambiguous search typing it alone would, a song/playlist resolves
// deterministically. Building the intent directly from the repo entry (we
// already have videoId/title/name in hand) rather than reconstructing a
// query string and re-parsing it through resolveTypedInput.
export function intentForBrowseItem(item) {
  if (item.itemType === 'artist') return { kind: 'search', deterministic: false, query: item.artistName, modifiers: {} };
  if (item.itemType === 'song') return { kind: 'song', deterministic: true, videoId: item.videoId, title: item.title, modifiers: {} };
  return { kind: 'playlist', deterministic: true, playlistName: item.playlistName, modifiers: {} };
}
