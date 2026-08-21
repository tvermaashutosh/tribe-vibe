import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { YoutubeResolver } from '../src/resolvers/youtubeResolver.js';

function tempCacheDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-cache-test-'));
}

test('downloadAudio returns an already-cached file without shelling out again', async () => {
  const cacheDir = tempCacheDir();
  const cachedPath = path.join(cacheDir, 'abc123.m4a');
  fs.writeFileSync(cachedPath, 'fake audio bytes');

  const resolver = new YoutubeResolver();
  const result = await resolver.downloadAudio('abc123', cacheDir);

  assert.equal(result, cachedPath);
});

test('toWatchUrl builds a plain YouTube watch URL', () => {
  const resolver = new YoutubeResolver();
  assert.equal(resolver.toWatchUrl('abc123'), 'https://www.youtube.com/watch?v=abc123');
});
