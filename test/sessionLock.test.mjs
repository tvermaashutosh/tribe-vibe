import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acquireSessionLock, releaseSessionLock } from '../src/repository/sessionLock.js';

function fakePlatform() {
  // A real platform's getConfigDir() always returns the same fixed path —
  // computed once here too, not freshly created on every call, otherwise
  // two calls within the same test would never actually contend for the
  // same lock.
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-test-'));
  return { getConfigDir: () => configDir };
}

test('acquireSessionLock wins the lock when nothing else holds it', () => {
  const platform = fakePlatform();
  assert.equal(acquireSessionLock(platform), true);
});

test('acquireSessionLock loses to a lock another process already holds', () => {
  const platform = fakePlatform();
  assert.equal(acquireSessionLock(platform), true);
  assert.equal(acquireSessionLock(platform), false);
});

test('releaseSessionLock frees the lock for the next process to win', () => {
  const platform = fakePlatform();
  assert.equal(acquireSessionLock(platform), true);
  releaseSessionLock(platform);
  assert.equal(acquireSessionLock(platform), true);
});

test('releaseSessionLock does not throw when no lock is held', () => {
  const platform = fakePlatform();
  assert.doesNotThrow(() => releaseSessionLock(platform));
});

test('acquireSessionLock self-heals a stale lock left behind by a crashed process', () => {
  const platform = fakePlatform();
  const dir = path.join(platform.getConfigDir(), '.session-lock');
  fs.mkdirSync(dir);
  // Back-date the lock well past the staleness threshold, simulating a
  // process that crashed without ever releasing it.
  const staleTime = new Date(Date.now() - 20 * 60 * 1000);
  fs.utimesSync(dir, staleTime, staleTime);

  assert.equal(acquireSessionLock(platform), true);
});

test('acquireSessionLock does not treat a fresh lock as stale', () => {
  const platform = fakePlatform();
  assert.equal(acquireSessionLock(platform), true);
  // Still fresh — a second process must not be able to steal it.
  assert.equal(acquireSessionLock(platform), false);
});
