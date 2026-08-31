import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PlaylistRepository } from '../src/repository/playlistRepository.js';

function tempConfigDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-playlist-test-'));
}

const fakeTokenRegistry = { describeTaken: () => null };

function repoWithSongs(songs) {
  const repo = new PlaylistRepository(tempConfigDir());
  repo.create('focus', fakeTokenRegistry);
  for (const song of songs) repo.addSong('focus', song);
  return repo;
}

function titles(repo) {
  return repo.all().find((p) => p.name === 'focus').songs.map((s) => s.title);
}

test('reorder moves a song from one valid index to another', () => {
  const repo = repoWithSongs([
    { videoId: 'a', title: 'Song A' },
    { videoId: 'b', title: 'Song B' },
    { videoId: 'c', title: 'Song C' },
  ]);
  repo.reorder('focus', 0, 2);
  assert.deepEqual(titles(repo), ['Song B', 'Song C', 'Song A']);
});

// Bug: fromIndex was never bounds-checked, unlike toIndex right above it.
// An out-of-range fromIndex makes splice(fromIndex, 1) return [undefined]
// instead of a real song, which then gets spliced right back into songs —
// corrupting the playlist with a literal undefined entry that persists.
test('reorder is a no-op for an out-of-range fromIndex, instead of corrupting the playlist', () => {
  const repo = repoWithSongs([
    { videoId: 'a', title: 'Song A' },
    { videoId: 'b', title: 'Song B' },
  ]);

  repo.reorder('focus', 5, 0);

  assert.deepEqual(titles(repo), ['Song A', 'Song B']);
  const songs = repo.all().find((p) => p.name === 'focus').songs;
  assert.equal(songs.some((song) => song === undefined), false);
  assert.equal(songs.length, 2);
});

test('reorder is a no-op for a negative fromIndex', () => {
  const repo = repoWithSongs([
    { videoId: 'a', title: 'Song A' },
    { videoId: 'b', title: 'Song B' },
  ]);

  repo.reorder('focus', -1, 0);

  assert.deepEqual(titles(repo), ['Song A', 'Song B']);
});

test('reorder is still a no-op for an out-of-range toIndex (existing behavior, unchanged)', () => {
  const repo = repoWithSongs([
    { videoId: 'a', title: 'Song A' },
    { videoId: 'b', title: 'Song B' },
  ]);

  repo.reorder('focus', 0, 5);

  assert.deepEqual(titles(repo), ['Song A', 'Song B']);
});
