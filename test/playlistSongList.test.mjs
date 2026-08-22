import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPlaylistSongList } from '../src/player/playlistSongList.js';

test('formatPlaylistSongList lists every song, numbered, under a header with the playlist name and count', () => {
  const playlist = { name: 'bpfav', songs: [{ videoId: 'a', title: 'Song A' }, { videoId: 'b', title: 'Song B' }] };
  assert.equal(formatPlaylistSongList(playlist), 'Playlist "bpfav" — 2 songs:\n  1. Song A\n  2. Song B');
});

test('formatPlaylistSongList pluralizes "song" correctly for exactly one song', () => {
  const playlist = { name: 'solo', songs: [{ videoId: 'a', title: 'Song A' }] };
  assert.equal(formatPlaylistSongList(playlist), 'Playlist "solo" — 1 song:\n  1. Song A');
});

test('formatPlaylistSongList truncates a title that would otherwise wrap onto a second row', () => {
  const originalColumns = process.stdout.columns;
  Object.defineProperty(process.stdout, 'columns', { value: 30, configurable: true });
  try {
    const playlist = {
      name: 'focus',
      songs: [{ videoId: 'a', title: 'A very long song title that would definitely wrap onto a second line' }],
    };
    const line = formatPlaylistSongList(playlist).split('\n')[1];
    assert.ok(line.length <= 30, `expected line within 30 columns, got ${line.length}: ${line}`);
    assert.match(line, /…$/);
  } finally {
    Object.defineProperty(process.stdout, 'columns', { value: originalColumns, configurable: true });
  }
});
