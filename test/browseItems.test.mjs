import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrowseItems } from '../src/ui/browseItems.js';

function fakeAliasRepo(entries) {
  return { all: () => entries };
}

function fakePlaylistRepo(playlists) {
  return { all: () => playlists };
}

test('buildBrowseItems combines song aliases and playlists, grouped song -> playlist regardless of insertion order', () => {
  const aliasRepo = fakeAliasRepo([
    // Artist listed first in storage — must never appear in the output at all.
    { token: 'tsw', type: 'artist', value: 'Taylor Swift' },
    { token: 'tt', type: 'song', videoId: 'abc123', title: 'Taylor Swift - 22' },
  ]);
  const playlistRepo = fakePlaylistRepo([{ name: 'focus', songs: [{ videoId: 'a', title: 'A' }] }]);

  const items = buildBrowseItems(aliasRepo, playlistRepo);

  assert.equal(items.length, 2);
  assert.equal(items[0].itemType, 'song');
  assert.match(items[0].label, /tt.*Taylor Swift - 22.*\(song\)/);
  assert.equal(items[1].itemType, 'playlist');
  assert.match(items[1].label, /focus.*1 song.*\(playlist\)/);
});

test('buildBrowseItems never includes an artist alias — picking one is an ambiguous search, not a one-click play', () => {
  const aliasRepo = fakeAliasRepo([
    { token: 'a1', type: 'artist', value: 'Artist One' },
    { token: 's1', type: 'song', videoId: 'x', title: 'Song One' },
  ]);
  const items = buildBrowseItems(aliasRepo, fakePlaylistRepo([]));

  assert.deepEqual(
    items.map((item) => item.itemType),
    ['song'],
  );
});

test('buildBrowseItems pluralizes "songs" correctly for a playlist with 0 or many songs', () => {
  const aliasRepo = fakeAliasRepo([]);
  const playlistRepo = fakePlaylistRepo([
    { name: 'empty', songs: [] },
    { name: 'many', songs: [{ videoId: 'a' }, { videoId: 'b' }] },
  ]);

  const items = buildBrowseItems(aliasRepo, playlistRepo);

  assert.match(items[0].label, /0 songs\s+\(playlist\)/);
  assert.match(items[1].label, /2 songs\s+\(playlist\)/);
});

test('buildBrowseItems returns an empty list when there is nothing to browse', () => {
  assert.deepEqual(buildBrowseItems(fakeAliasRepo([]), fakePlaylistRepo([])), []);
});

test('buildBrowseItems keeps the title in full, padded to line up — nothing is ever truncated', () => {
  const token = 'tt';
  const title = 'A very long song title that would definitely wrap';
  const playlistName = 'a-much-longer-playlist-name-here';
  const aliasRepo = fakeAliasRepo([{ token, type: 'song', videoId: 'a', title }]);
  const playlistRepo = fakePlaylistRepo([{ name: playlistName, songs: [] }]);
  const items = buildBrowseItems(aliasRepo, playlistRepo);

  const tokenWidth = Math.max(token.length, playlistName.length);
  const valueWidth = Math.max(title.length, '0 songs'.length);
  assert.equal(items[0].label, `${token.padEnd(tokenWidth)}  →  ${title.padEnd(valueWidth)}  (song)`);
  assert.equal(items[1].label, `${playlistName.padEnd(tokenWidth)}  →  ${'0 songs'.padEnd(valueWidth)}  (playlist)`);
});

test('buildBrowseItems columnar-aligns token, value, and "(type)" across song and playlist rows alike', () => {
  const aliasRepo = fakeAliasRepo([{ token: 'a-very-long-token', type: 'song', videoId: 'a', title: 'A Song' }]);
  const playlistRepo = fakePlaylistRepo([{ name: 'p', songs: [{ videoId: 'z' }] }]);

  const items = buildBrowseItems(aliasRepo, playlistRepo);
  const arrowStarts = items.map((item) => item.label.indexOf('→'));
  const parenStarts = items.map((item) => item.label.indexOf('('));

  // Every row's "→" starts at the same column — the token column is as wide
  // as 'a-very-long-token', the longest token across both kinds.
  assert.equal(new Set(arrowStarts).size, 1);
  // Every row's "(type)" starts at the same column too.
  assert.equal(new Set(parenStarts).size, 1);
  // Confirmed genuinely widened, not a coincidental equal-width fluke.
  assert.equal(arrowStarts[0], 'a-very-long-token'.length + 2);
});

test('buildBrowseItems sorts each chunk most-recently-touched first, independent of storage order', () => {
  const aliasRepo = fakeAliasRepo([
    { token: 's-old', type: 'song', videoId: 'x', title: 'Old Song', updatedAt: 100 },
    { token: 's-new', type: 'song', videoId: 'y', title: 'New Song', updatedAt: 300 },
  ]);
  const playlistRepo = fakePlaylistRepo([
    { name: 'old-playlist', songs: [], updatedAt: 100 },
    { name: 'new-playlist', songs: [], updatedAt: 300 },
  ]);

  const items = buildBrowseItems(aliasRepo, playlistRepo);

  assert.deepEqual(
    items.map((item) => item.token),
    ['s-new', 's-old', 'new-playlist', 'old-playlist'],
  );
});
