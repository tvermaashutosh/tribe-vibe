import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acquireSessionLock } from '../src/repository/sessionLock.js';
import { handOffToForeground } from '../src/ui/handOffToForeground.js';

function fakePlatform() {
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-test-'));
  return { getConfigDir: () => configDir };
}

function disableTrace() {
  const previous = process.env.TRIBE_VIBE_TRACE;
  process.env.TRIBE_VIBE_TRACE = '0';
  return () => {
    if (previous === undefined) delete process.env.TRIBE_VIBE_TRACE;
    else process.env.TRIBE_VIBE_TRACE = previous;
  };
}

test('foreground handoff keeps the cache lease until playback finishes', async () => {
  const platform = fakePlatform();
  const sessionLock = acquireSessionLock(platform);
  assert.ok(sessionLock);
  let finishPlayback;
  const playback = new Promise((resolve) => {
    finishPlayback = resolve;
  });
  let exitCode;
  const restoreTrace = disableTrace();
  const originalExit = process.exit;
  process.exit = (code) => {
    exitCode = code;
  };

  const handoff = handOffToForeground(
    {
      platform,
      sessionLock,
      unmountMenu() {
        assert.equal(sessionLock.transferred, true, 'the lease must transfer before Ink unmounts');
      },
      closeDaemon() {},
    },
    () => playback,
  );

  try {
    assert.equal(sessionLock.transferred, true);
    assert.equal(acquireSessionLock(platform), false);
    finishPlayback();
    await handoff;
  } finally {
    process.exit = originalExit;
    restoreTrace();
  }

  assert.equal(exitCode, 0);
  const nextLease = acquireSessionLock(platform);
  assert.ok(nextLease);
  nextLease.release();
});

test('foreground handoff releases its lease when playback fails', async () => {
  const platform = fakePlatform();
  const sessionLock = acquireSessionLock(platform);
  assert.ok(sessionLock);
  let exitCode;
  const restoreTrace = disableTrace();
  const originalExit = process.exit;
  const originalError = console.error;
  process.exit = (code) => {
    exitCode = code;
  };
  console.error = () => {};

  try {
    await handOffToForeground(
      {
        platform,
        sessionLock,
        unmountMenu() {},
        closeDaemon() {},
      },
      async () => {
        throw new Error('playback failed');
      },
    );
  } finally {
    process.exit = originalExit;
    console.error = originalError;
    restoreTrace();
  }

  assert.equal(exitCode, 1);
  const nextLease = acquireSessionLock(platform);
  assert.ok(nextLease);
  nextLease.release();
});
