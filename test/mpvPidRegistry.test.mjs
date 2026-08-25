import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { recordMpvPid, removeMpvPid, killAllTrackedMpv } from '../src/repository/mpvPidRegistry.js';

function fakePlatform() {
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-test-'));
  return { getConfigDir: () => configDir };
}

// A real, short-lived process (not a mock) — this is a process-management
// primitive, the same standard this project already holds playForeground's
// own signal handling to, so it's verified against real PIDs, not assumed.
function spawnLongRunning() {
  const isWindows = process.platform === 'win32';
  const child = isWindows
    ? spawn('cmd', ['/c', 'timeout', '/t', '30'])
    : spawn('sleep', ['30']);
  return child;
}

test('killAllTrackedMpv actually terminates a real tracked process', async () => {
  const platform = fakePlatform();
  const child = spawnLongRunning();
  recordMpvPid(platform, child.pid);

  const exited = new Promise((resolve) => child.once('exit', resolve));
  const { killed, alreadyGone } = killAllTrackedMpv(platform);
  await exited;

  assert.deepEqual(killed, [child.pid]);
  assert.deepEqual(alreadyGone, []);
  assert.throws(() => process.kill(child.pid, 0));
});

test('killAllTrackedMpv reports an already-dead pid as alreadyGone, not killed', () => {
  const platform = fakePlatform();
  // A pid that is guaranteed not to exist as a live process right now.
  const deadPid = 999999;
  recordMpvPid(platform, deadPid);

  const { killed, alreadyGone } = killAllTrackedMpv(platform);

  assert.deepEqual(killed, []);
  assert.deepEqual(alreadyGone, [deadPid]);
});

test('killAllTrackedMpv clears the registry — a second call finds nothing left', () => {
  const platform = fakePlatform();
  recordMpvPid(platform, 999999);

  killAllTrackedMpv(platform);
  const second = killAllTrackedMpv(platform);

  assert.deepEqual(second.killed, []);
  assert.deepEqual(second.alreadyGone, []);
});

test('recordMpvPid does not create duplicate entries for the same pid', async () => {
  const platform = fakePlatform();
  const child = spawnLongRunning();
  recordMpvPid(platform, child.pid);
  recordMpvPid(platform, child.pid);

  const { killed } = killAllTrackedMpv(platform);
  child.kill();

  assert.deepEqual(killed, [child.pid]);
});

test('removeMpvPid removes only the given pid, leaving the rest tracked', () => {
  const platform = fakePlatform();
  recordMpvPid(platform, 111111);
  recordMpvPid(platform, 999999);
  removeMpvPid(platform, 111111);

  const { alreadyGone } = killAllTrackedMpv(platform);
  assert.deepEqual(alreadyGone, [999999]);
});

test('killAllTrackedMpv on an empty/missing registry does nothing and does not throw', () => {
  const platform = fakePlatform();
  const result = killAllTrackedMpv(platform);
  assert.deepEqual(result, { killed: [], alreadyGone: [] });
});
