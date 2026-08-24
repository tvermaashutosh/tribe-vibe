import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { clearCacheDir } from '../src/repository/clearCacheDir.js';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-test-'));
}

function fakePlatform(cacheDir) {
  return { getCacheDir: () => cacheDir };
}

test('clearCacheDir deletes every previously-cached file', () => {
  const cacheDir = tempDir();
  fs.writeFileSync(path.join(cacheDir, 'abc123.m4a'), 'fake cached audio');

  clearCacheDir(fakePlatform(cacheDir));

  assert.equal(fs.existsSync(cacheDir), false);
});

test('clearCacheDir does not throw when the cache dir does not exist yet', () => {
  const cacheDir = path.join(tempDir(), 'never-created');

  assert.doesNotThrow(() => clearCacheDir(fakePlatform(cacheDir)));
});

test('clearCacheDir never touches anything outside the cache dir it was given', () => {
  const cacheDir = tempDir();
  const unrelatedDir = tempDir();
  fs.writeFileSync(path.join(unrelatedDir, 'not-tribe-vibe.txt'), 'leave me alone');

  clearCacheDir(fakePlatform(cacheDir));

  assert.ok(fs.existsSync(path.join(unrelatedDir, 'not-tribe-vibe.txt')));
});

test('clearCacheDir swallows a delete failure instead of throwing — runs unconditionally on every startup, must never block an actual play/control command', () => {
  const platform = {
    getCacheDir: () => {
      throw new Error('EBUSY: file is locked');
    },
  };

  assert.doesNotThrow(() => clearCacheDir(platform));
});
