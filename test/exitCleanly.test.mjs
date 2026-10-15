import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acquireSessionLock } from '../src/repository/sessionLock.js';
import { exitCleanly } from '../src/ui/exitCleanly.js';

function fakePlatform() {
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-test-'));
  return { getConfigDir: () => configDir };
}

function lockPath(platform) {
  return path.join(platform.getConfigDir(), '.session-lock');
}

// process.exit() is stubbed rather than actually called — calling the real
// one would kill this test process. The order this proves is the whole
// point of the fix: App.jsx's Escape at the main menu calls process.exit(0)
// directly with no unmount() first, so cli.js's own
// try { ... } finally { releaseSessionLock } never gets a chance to run —
// this must release the lock itself, before exiting, not after.
test('exitCleanly releases the session lock before calling process.exit', () => {
  const platform = fakePlatform();
  const lease = acquireSessionLock(platform);
  assert.ok(lease);
  assert.ok(fs.existsSync(lockPath(platform)));

  const originalExit = process.exit;
  let exitCode;
  let lockGoneWhenExitCalled;
  process.exit = (code) => {
    exitCode = code;
    lockGoneWhenExitCalled = !fs.existsSync(lockPath(platform));
  };
  try {
    exitCleanly(platform, 0, lease);
  } finally {
    process.exit = originalExit;
  }

  assert.equal(exitCode, 0);
  assert.equal(lockGoneWhenExitCalled, true);
});

test('exitCleanly does not release a lock when this process has no lease', () => {
  const platform = fakePlatform();
  const lease = acquireSessionLock(platform);
  assert.ok(lease);
  const originalExit = process.exit;
  process.exit = () => {};
  try {
    exitCleanly(platform);
  } finally {
    process.exit = originalExit;
  }

  assert.equal(fs.existsSync(lockPath(platform)), true);
  lease.release();
});

test('exitCleanly defaults to exit code 0', () => {
  const platform = fakePlatform();
  const originalExit = process.exit;
  let exitCode;
  process.exit = (code) => {
    exitCode = code;
  };
  try {
    exitCleanly(platform);
  } finally {
    process.exit = originalExit;
  }
  assert.equal(exitCode, 0);
});

test('exitCleanly passes a non-zero code through, matching the error-exit call site', () => {
  const platform = fakePlatform();
  const originalExit = process.exit;
  let exitCode;
  process.exit = (code) => {
    exitCode = code;
  };
  try {
    exitCleanly(platform, 1);
  } finally {
    process.exit = originalExit;
  }
  assert.equal(exitCode, 1);
});

test('exitCleanly does not throw when no lock is held', () => {
  const platform = fakePlatform();
  const originalExit = process.exit;
  process.exit = () => {};
  try {
    assert.doesNotThrow(() => exitCleanly(platform));
  } finally {
    process.exit = originalExit;
  }
});
