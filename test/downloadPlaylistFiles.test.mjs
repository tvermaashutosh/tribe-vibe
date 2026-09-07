import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { downloadPlaylistFiles } from '../src/player/downloadPlaylistFiles.js';

function songs(count) {
  return Array.from({ length: count }, (_, i) => ({ videoId: `v${i}`, title: `Song ${i}` }));
}

// Delays deliberately out of order (later songs finish sooner) — the real
// bug this whole feature could otherwise reintroduce: a fast download racing
// ahead of a slow one must never scramble the output order, since mpv needs
// the real playlist order, not whichever order the network handed files back.
function outOfOrderResolver() {
  return {
    downloadAudio: async (videoId) => {
      const index = Number(videoId.slice(1));
      await delay((5 - index) * 5);
      return `/cache/${videoId}.m4a`;
    },
  };
}

test('downloadPlaylistFiles defaults to one at a time when concurrency is not given', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const resolver = {
    downloadAudio: async (videoId) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await delay(5);
      inFlight -= 1;
      return `/cache/${videoId}.m4a`;
    },
  };

  await downloadPlaylistFiles({ resolver, cacheDir: '/cache', songs: songs(4) });

  assert.equal(maxInFlight, 1);
});

test('downloadPlaylistFiles runs up to `concurrency` downloads at once, never more', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const resolver = {
    downloadAudio: async (videoId) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await delay(10);
      inFlight -= 1;
      return `/cache/${videoId}.m4a`;
    },
  };

  await downloadPlaylistFiles({ resolver, cacheDir: '/cache', songs: songs(6), concurrency: 3 });

  assert.equal(maxInFlight, 3);
});

test('downloadPlaylistFiles keeps the result in playlist order, even when later songs finish downloading first', async () => {
  const result = await downloadPlaylistFiles({
    resolver: outOfOrderResolver(),
    cacheDir: '/cache',
    songs: songs(5),
    concurrency: 5,
  });

  assert.deepEqual(
    result.map((file) => file.title),
    ['Song 0', 'Song 1', 'Song 2', 'Song 3', 'Song 4'],
  );
});

test('downloadPlaylistFiles skips a failed download via onSongFailed, keeping the rest in order', async () => {
  const resolver = {
    downloadAudio: async (videoId) => {
      if (videoId === 'v1') throw new Error('Video unavailable');
      return `/cache/${videoId}.m4a`;
    },
  };
  const failed = [];

  const result = await downloadPlaylistFiles({
    resolver,
    cacheDir: '/cache',
    songs: songs(3),
    concurrency: 3,
    onSongFailed: (song, err) => failed.push({ title: song.title, message: err.message }),
  });

  assert.deepEqual(
    result.map((file) => file.title),
    ['Song 0', 'Song 2'],
  );
  assert.deepEqual(failed, [{ title: 'Song 1', message: 'Video unavailable' }]);
});

test('downloadPlaylistFiles clamps a nonsensical concurrency (0, negative) up to 1, instead of downloading nothing', async () => {
  const result = await downloadPlaylistFiles({
    resolver: { downloadAudio: async (videoId) => `/cache/${videoId}.m4a` },
    cacheDir: '/cache',
    songs: songs(2),
    concurrency: 0,
  });

  assert.equal(result.length, 2);
});

test('downloadPlaylistFiles never needs more workers than there are songs', async () => {
  const result = await downloadPlaylistFiles({
    resolver: { downloadAudio: async (videoId) => `/cache/${videoId}.m4a` },
    cacheDir: '/cache',
    songs: songs(2),
    concurrency: 10,
  });

  assert.equal(result.length, 2);
});
