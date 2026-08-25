import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { killAllByExactName } from '../src/player/killAllMpv.js';

// A copy of the real `sleep` binary, renamed — confirmed live that this
// matters: a #!/bin/sh script's actual process name (what pgrep -x sees) is
// "sh", the interpreter, not the script's own filename, since the kernel
// re-execs the interpreter for a shebang script. A real native binary's own
// process name matches whatever it was renamed/invoked as, which is what
// this needs to exercise. A unique name per test run so this can never
// collide with — or kill — a real process the machine running these tests
// happens to have running for any other reason.
function spawnFakeProcess(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-fake-proc-'));
  const binPath = path.join(dir, name);
  fs.copyFileSync('/bin/sleep', binPath);
  fs.chmodSync(binPath, 0o755);
  return spawn(binPath, ['30'], { stdio: 'ignore' });
}

const isWindows = process.platform === 'win32';

test(
  'killAllByExactName finds and terminates a real process by its exact name',
  { skip: isWindows && 'tasklist-based enumeration unverified on Windows in this environment' },
  async () => {
    const name = `tribevibe-test-${process.pid}-a`;
    const child = spawnFakeProcess(name);
    const exited = new Promise((resolve) => child.once('exit', resolve));

    // Give the OS a beat to register the new process under its real name
    // before searching for it.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const { killed, alreadyGone } = killAllByExactName(name);
    await exited;

    assert.deepEqual(killed, [child.pid]);
    assert.deepEqual(alreadyGone, []);
    assert.throws(() => process.kill(child.pid, 0));
  },
);

test(
  'killAllByExactName does not touch a process with a different name',
  { skip: isWindows && 'tasklist-based enumeration unverified on Windows in this environment' },
  async () => {
    const unrelatedName = `tribevibe-test-${process.pid}-unrelated`;
    const unrelated = spawnFakeProcess(unrelatedName);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const { killed, alreadyGone } = killAllByExactName(`tribevibe-test-${process.pid}-nonexistent`);

    assert.deepEqual(killed, []);
    assert.deepEqual(alreadyGone, []);
    assert.doesNotThrow(() => process.kill(unrelated.pid, 0));
    unrelated.kill();
  },
);

test('killAllByExactName returns empty arrays, does not throw, when nothing matches', () => {
  const result = killAllByExactName(`tribevibe-test-${process.pid}-definitely-nothing`);
  assert.deepEqual(result, { killed: [], alreadyGone: [] });
});
