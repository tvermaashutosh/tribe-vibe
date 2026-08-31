import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlaylistListItems } from '../src/ui/playlistListItems.js';

test('buildPlaylistListItems returns "name → N songs" for each playlist', () => {
  const items = buildPlaylistListItems([{ name: 'focus', songs: [{ videoId: 'a' }] }]);
  assert.equal(items[0].label, 'focus  →  1 songs');
  assert.equal(items[0].value, 'focus');
});

test('buildPlaylistListItems columnar-aligns the name column across playlists of different name lengths', () => {
  const items = buildPlaylistListItems([
    { name: 'a-very-long-playlist-name', songs: [] },
    { name: 'p', songs: [{ videoId: 'a' }, { videoId: 'b' }] },
  ]);
  const arrowStarts = items.map((item) => item.label.indexOf('→'));
  assert.equal(new Set(arrowStarts).size, 1);
  assert.equal(arrowStarts[0], 'a-very-long-playlist-name'.length + 2);
  // Nothing truncated — full name and full count both still present.
  assert.match(items[0].label, /^a-very-long-playlist-name\s+→\s+0 songs$/);
  assert.match(items[1].label, /^p\s+→\s+2 songs$/);
});

test('buildPlaylistListItems returns an empty list for no playlists', () => {
  assert.deepEqual(buildPlaylistListItems([]), []);
});
