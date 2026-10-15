import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireSessionLock, releaseSessionLock } from '../src/repository/sessionLock.js';

const lockDriver = fileURLToPath(new URL('./helpers/sessionLockDriver.mjs', import.meta.url));

function fakePlatform() {
  // A real platform's getConfigDir() always returns the same fixed path —
  // computed once here too, not freshly created on every call, otherwise
  // two calls within the same test would never actually contend for the
  // same lock.
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-test-'));
  return { getConfigDir: () => configDir };
}

// Distinct from fakePlatform() above: mkdtempSync there already creates the
// directory, so no existing test exercises a genuinely fresh install, where
// nothing has created the config dir (or its parent) at all yet — exactly
// the state cli.js's run() sees on a brand-new machine, since acquireSessionLock
// is called before any repository's own mkdirSync ever runs.
function fakeFreshInstallPlatform() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-test-'));
  const configDir = path.join(base, 'not-yet-created', 'tribe-vibe');
  return { getConfigDir: () => configDir };
}

function startLockProcess(configDir) {
  const child = spawn(process.execPath, [lockDriver, configDir], { stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  const ready = new Promise((resolve, reject) => {
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      const newline = stdout.indexOf('\n');
      if (newline !== -1) resolve(JSON.parse(stdout.slice(0, newline)));
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (!stdout.includes('\n')) reject(new Error(`lock driver exited ${code} before reporting; ${stderr}`));
    });
  });
  return { child, ready };
}

function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve, reject) => {
    child.once('exit', resolve);
    child.once('error', reject);
  });
}

async function stopLockProcess(processInfo) {
  if (processInfo.child.exitCode === null && processInfo.child.signalCode === null) {
    processInfo.child.stdin.end('release');
    await waitForExit(processInfo.child);
  }
}

async function killLockProcess(processInfo) {
  if (processInfo.child.exitCode === null && processInfo.child.signalCode === null) {
    processInfo.child.kill('SIGTERM');
    await waitForExit(processInfo.child);
  }
}

test('acquireSessionLock wins the lock when nothing else holds it', () => {
  const platform = fakePlatform();
  const lease = acquireSessionLock(platform);
  assert.ok(lease);
  releaseSessionLock(platform, lease);
});

test('acquireSessionLock loses to a lock another process already holds', () => {
  const platform = fakePlatform();
  const lease = acquireSessionLock(platform);
  assert.ok(lease);
  assert.equal(acquireSessionLock(platform), false);
  releaseSessionLock(platform, lease);
});

test('releaseSessionLock frees the lock for the next process to win', () => {
  const platform = fakePlatform();
  const lease = acquireSessionLock(platform);
  assert.ok(lease);
  releaseSessionLock(platform, lease);
  const nextLease = acquireSessionLock(platform);
  assert.ok(nextLease);
  releaseSessionLock(platform, nextLease);
});

test('releaseSessionLock does not throw when no lock is held', () => {
  const platform = fakePlatform();
  assert.doesNotThrow(() => releaseSessionLock(platform));
});

test('a process without the lease cannot release another session lock', () => {
  const platform = fakePlatform();
  const owner = acquireSessionLock(platform);
  assert.ok(owner);

  assert.equal(releaseSessionLock(platform), false);
  assert.equal(fs.existsSync(path.join(platform.getConfigDir(), '.session-lock')), true);
  releaseSessionLock(platform, owner);
});

test('acquireSessionLock self-heals a stale lock left behind by a crashed process', () => {
  const platform = fakePlatform();
  const dir = path.join(platform.getConfigDir(), '.session-lock');
  fs.mkdirSync(dir);
  // Back-date the lock well past the staleness threshold, simulating a
  // process that crashed without ever releasing it.
  const staleTime = new Date(Date.now() - 20 * 60 * 1000);
  fs.utimesSync(dir, staleTime, staleTime);

  const lease = acquireSessionLock(platform);
  assert.ok(lease);
  releaseSessionLock(platform, lease);
});

test('acquireSessionLock does not treat a fresh lock as stale', () => {
  const platform = fakePlatform();
  const lease = acquireSessionLock(platform);
  assert.ok(lease);
  // Still fresh — a second process must not be able to steal it.
  assert.equal(acquireSessionLock(platform), false);
  releaseSessionLock(platform, lease);
});

test('a stale-looking lock held by a live process is not reclaimed', () => {
  const platform = fakePlatform();
  const lease = acquireSessionLock(platform);
  assert.ok(lease);
  const lockDir = path.join(platform.getConfigDir(), '.session-lock');
  const staleTime = new Date(Date.now() - 20 * 60 * 1000);
  fs.utimesSync(lockDir, staleTime, staleTime);

  assert.equal(acquireSessionLock(platform), false);
  assert.equal(fs.existsSync(lockDir), true);
  releaseSessionLock(platform, lease);
});

test('a lock from a crashed process can be reclaimed after it becomes stale', async () => {
  const platform = fakePlatform();
  const processInfo = startLockProcess(platform.getConfigDir());
  try {
    const { acquired } = await processInfo.ready;
    assert.equal(acquired, true);

    const lockDir = path.join(platform.getConfigDir(), '.session-lock');
    const staleTime = new Date(Date.now() - 20 * 60 * 1000);
    fs.utimesSync(lockDir, staleTime, staleTime);
    assert.equal(acquireSessionLock(platform), false, 'a stale timestamp must not displace a live process');

    await killLockProcess(processInfo);

    const lease = acquireSessionLock(platform);
    assert.ok(lease, 'the dead owner’s stale lock should be recoverable');
    releaseSessionLock(platform, lease);
  } finally {
    await killLockProcess(processInfo);
  }
});

test('an old lease cannot remove a replacement lock with a different owner token', () => {
  const platform = fakePlatform();
  const oldLease = acquireSessionLock(platform);
  assert.ok(oldLease);
  const lockDir = path.join(platform.getConfigDir(), '.session-lock');
  fs.rmSync(lockDir, { recursive: true, force: true });
  fs.mkdirSync(lockDir);
  fs.writeFileSync(path.join(lockDir, 'owner.json'), JSON.stringify({ pid: process.pid, token: 'replacement-owner' }));

  assert.equal(releaseSessionLock(platform, oldLease), false);
  assert.equal(fs.existsSync(lockDir), true);
  fs.rmSync(lockDir, { recursive: true, force: true });
});

// Bug: mkdirSync(dir) threw ENOENT when the parent config dir didn't exist
// yet (a genuinely fresh install), and the old code treated ANY non-EEXIST
// error as "lock won" — without ever actually creating the lock. This is
// the smoking gun: it must return true AND the lock must genuinely exist on
// disk afterward, not just claim to have won it.
test('acquireSessionLock actually creates the lock on a fresh install, not just claims to', () => {
  const platform = fakeFreshInstallPlatform();
  assert.equal(fs.existsSync(platform.getConfigDir()), false);

  const lease = acquireSessionLock(platform);
  assert.ok(lease);

  assert.equal(fs.existsSync(path.join(platform.getConfigDir(), '.session-lock')), true);
  releaseSessionLock(platform, lease);
});

// Exercise mkdir's atomicity across separate Node processes. Same-process
// calls only prove the already-created-directory path, not a real race.
test('two processes racing on a fresh install have exactly one lock owner', async () => {
  const platform = fakeFreshInstallPlatform();
  const contenders = [startLockProcess(platform.getConfigDir()), startLockProcess(platform.getConfigDir())];
  try {
    const results = await Promise.all(contenders.map((contender) => contender.ready));
    assert.equal(results.filter((result) => result.acquired).length, 1);
    assert.equal(results.filter((result) => !result.acquired).length, 1);
  } finally {
    await Promise.all(contenders.map(stopLockProcess));
  }
});

test('two processes racing to reclaim a stale lock cannot both take ownership', async () => {
  const platform = fakePlatform();
  const originalOwner = startLockProcess(platform.getConfigDir());
  try {
    assert.equal((await originalOwner.ready).acquired, true);
    const lockDir = path.join(platform.getConfigDir(), '.session-lock');
    const staleTime = new Date(Date.now() - 20 * 60 * 1000);
    fs.utimesSync(lockDir, staleTime, staleTime);
    await killLockProcess(originalOwner);

    const contenders = [startLockProcess(platform.getConfigDir()), startLockProcess(platform.getConfigDir())];
    try {
      const results = await Promise.all(contenders.map((contender) => contender.ready));
      assert.equal(results.filter((result) => result.acquired).length, 1);
      assert.equal(results.filter((result) => !result.acquired).length, 1);
    } finally {
      await Promise.all(contenders.map(stopLockProcess));
    }
  } finally {
    await killLockProcess(originalOwner);
  }
});
