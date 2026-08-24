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

test('formatPlaylistSongList keeps a long title in full — Ink wraps it onto another line rather than losing any of it', () => {
  const playlist = {
    name: 'focus',
    songs: [{ videoId: 'a', title: 'A very long song title that would definitely wrap onto a second line' }],
  };
  const line = formatPlaylistSongList(playlist).split('\n')[1];
  assert.equal(line, '  1. A very long song title that would definitely wrap onto a second line');
});
