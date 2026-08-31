import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrowseItems, intentForBrowseItem } from '../src/ui/browseItems.js';

function fakeAliasRepo(entries) {
  return { all: () => entries };
}

function fakePlaylistRepo(playlists) {
  return { all: () => playlists };
}

test('buildBrowseItems combines artist aliases, song aliases, and playlists, grouped song -> playlist -> artist regardless of insertion order', () => {
  const aliasRepo = fakeAliasRepo([
    // Artist listed first in storage — the output must still put songs first.
    { token: 'tsw', type: 'artist', value: 'Taylor Swift' },
    { token: 'tt', type: 'song', videoId: 'abc123', title: 'Taylor Swift - 22' },
  ]);
  const playlistRepo = fakePlaylistRepo([{ name: 'focus', songs: [{ videoId: 'a', title: 'A' }] }]);

  const items = buildBrowseItems(aliasRepo, playlistRepo);

  assert.equal(items.length, 3);
  assert.equal(items[0].itemType, 'song');
  assert.match(items[0].label, /tt.*Taylor Swift - 22.*\(song\)/);
  assert.equal(items[1].itemType, 'playlist');
  assert.match(items[1].label, /focus.*1 song.*\(playlist\)/);
  assert.equal(items[2].itemType, 'artist');
  assert.match(items[2].label, /tsw.*Taylor Swift.*\(artist\)/);
});

test('buildBrowseItems keeps all songs together before all artists, even when interleaved in storage', () => {
  const aliasRepo = fakeAliasRepo([
    { token: 'a1', type: 'artist', value: 'Artist One' },
    { token: 's1', type: 'song', videoId: 'x', title: 'Song One' },
    { token: 'a2', type: 'artist', value: 'Artist Two' },
    { token: 's2', type: 'song', videoId: 'y', title: 'Song Two' },
  ]);
  const items = buildBrowseItems(aliasRepo, fakePlaylistRepo([]));

  assert.deepEqual(
    items.map((item) => item.itemType),
    ['song', 'song', 'artist', 'artist'],
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

test('buildBrowseItems keeps the title/value in full, padded to line up — nothing is ever truncated', () => {
  const aliasRepo = fakeAliasRepo([
    { token: 'tt', type: 'song', videoId: 'a', title: 'A very long song title that would definitely wrap' },
    { token: 'ts', type: 'artist', value: 'A very long canonical artist name that would definitely wrap' },
  ]);
  const items = buildBrowseItems(aliasRepo, fakePlaylistRepo([]));

  // The artist's value is longer, so the song's value column is padded out
  // to match it — its full, untruncated text is still there, just followed
  // by trailing spaces so "(song)" lines up under where "(artist)" starts.
  assert.equal(
    items[0].label,
    `tt  →  ${'A very long song title that would definitely wrap'.padEnd('A very long canonical artist name that would definitely wrap'.length)}  (song)`,
  );
  assert.equal(items[1].label, 'ts  →  A very long canonical artist name that would definitely wrap  (artist)');
});

test('buildBrowseItems columnar-aligns token, value, and "(type)" across every row — song, playlist, and artist rows alike', () => {
  const aliasRepo = fakeAliasRepo([
    { token: 'tt', type: 'song', videoId: 'a', title: 'A Song' },
    { token: 'a-very-long-token', type: 'artist', value: 'X' },
  ]);
  const playlistRepo = fakePlaylistRepo([{ name: 'p', songs: [{ videoId: 'z' }] }]);

  const items = buildBrowseItems(aliasRepo, playlistRepo);
  const arrowStarts = items.map((item) => item.label.indexOf('→'));
  const parenStarts = items.map((item) => item.label.indexOf('('));

  // Every row's "→" starts at the same column — the token column is as wide
  // as 'a-very-long-token', the longest token across all three kinds.
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
    { token: 'a-old', type: 'artist', value: 'Old Artist', updatedAt: 100 },
    { token: 'a-new', type: 'artist', value: 'New Artist', updatedAt: 300 },
  ]);
  const playlistRepo = fakePlaylistRepo([
    { name: 'old-playlist', songs: [], updatedAt: 100 },
    { name: 'new-playlist', songs: [], updatedAt: 300 },
  ]);

  const items = buildBrowseItems(aliasRepo, playlistRepo);

  assert.deepEqual(
    items.map((item) => item.token),
    ['s-new', 's-old', 'new-playlist', 'old-playlist', 'a-new', 'a-old'],
  );
});

test('intentForBrowseItem: an artist item resolves to the same ambiguous search typing it alone would', () => {
  const intent = intentForBrowseItem({ itemType: 'artist', artistName: 'Taylor Swift' });
  assert.deepEqual(intent, { kind: 'search', deterministic: false, query: 'Taylor Swift', modifiers: {} });
});

test('intentForBrowseItem: a song item resolves deterministically, no search involved', () => {
  const intent = intentForBrowseItem({ itemType: 'song', videoId: 'abc123', title: 'Taylor Swift - 22' });
  assert.deepEqual(intent, { kind: 'song', deterministic: true, videoId: 'abc123', title: 'Taylor Swift - 22', modifiers: {} });
});

test('intentForBrowseItem: a playlist item resolves deterministically', () => {
  const intent = intentForBrowseItem({ itemType: 'playlist', playlistName: 'focus' });
  assert.deepEqual(intent, { kind: 'playlist', deterministic: true, playlistName: 'focus', modifiers: {} });
});
