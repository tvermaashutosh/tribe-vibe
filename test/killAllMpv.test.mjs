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

// A flat sleep before searching was flaky under load — a fixed delay can't
// promise the OS has registered the new process by then, on every machine,
// every time. Polling killAllByExactName itself until it actually finds the
// pid (or times out) removes the race entirely instead of guessing a number.
async function killAllByExactNameEventually(name, { maxAttempts = 30, intervalMs = 100 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await killAllByExactName(name);
    if (result.killed.length > 0 || result.alreadyGone.length > 0) return result;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return { killed: [], alreadyGone: [], stillRunning: [] };
}

test(
  'killAllByExactName finds and terminates a real process by its exact name',
  { skip: isWindows && 'tasklist-based enumeration unverified on Windows in this environment' },
  async () => {
    const name = `tribevibe-test-${process.pid}-a`;
    const child = spawnFakeProcess(name);
    const exited = new Promise((resolve) => child.once('exit', resolve));

    const { killed, alreadyGone, stillRunning } = await killAllByExactNameEventually(name);
    await exited;

    assert.deepEqual(killed, [child.pid]);
    assert.deepEqual(alreadyGone, []);
    assert.deepEqual(stillRunning, []);
    assert.throws(() => process.kill(child.pid, 0));
  },
);

test(
  'killAllByExactName does not touch a process with a different name',
  { skip: isWindows && 'tasklist-based enumeration unverified on Windows in this environment' },
  async () => {
    const unrelatedName = `tribevibe-test-${process.pid}-unrelated`;
    const unrelated = spawnFakeProcess(unrelatedName);
    // Deliberately brief and immediate, not a long observation window — a
    // sandboxed test environment can reap an orphaned spawned child on its
    // own after a few hundred ms regardless of this test, which would make
    // "still alive" wrongly look like a failure of this function. A new
    // process registers under pgrep within single-digit ms in practice, so
    // there's nothing to gain from waiting longer to prove the negative.
    await new Promise((resolve) => setTimeout(resolve, 50));

    const { killed, alreadyGone, stillRunning } = await killAllByExactName(`tribevibe-test-${process.pid}-nonexistent`);

    assert.deepEqual(killed, []);
    assert.deepEqual(alreadyGone, []);
    assert.deepEqual(stillRunning, []);
    assert.doesNotThrow(() => process.kill(unrelated.pid, 0));
    unrelated.kill();
  },
);

test('killAllByExactName returns empty arrays, does not throw, when nothing matches', async () => {
  const result = await killAllByExactName(`tribevibe-test-${process.pid}-definitely-nothing`);
  assert.deepEqual(result, { killed: [], alreadyGone: [], stillRunning: [] });
});

// Bug: killAllByExactName used to report "killed" the instant SIGTERM was
// sent, not when the process actually died — SIGTERM is asynchronous, so a
// signaled process ignoring it (or just slow) could still be alive when
// "Stopped" printed. A process that traps and ignores SIGTERM entirely
// proves the fix: it must show up as stillRunning, never as killed.
test(
  'a process that ignores SIGTERM shows up as stillRunning, never as killed',
  { skip: isWindows && 'SIGTERM-trapping via process.on is POSIX-only' },
  async () => {
    const name = `tribevibe-test-${process.pid}-stubborn`;
    // A copy of the real node binary, renamed — same reasoning as
    // spawnFakeProcess above: a #!/bin/sh script's real process name is
    // "sh", the interpreter, not the script's own filename (confirmed the
    // hard way writing this exact test), so a genuine renamed binary is
    // needed to make SIGTERM-ignoring behavior show up under the right name.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-fake-proc-'));
    const binPath = path.join(dir, name);
    const readyMarker = path.join(dir, 'ready');
    fs.copyFileSync(process.execPath, binPath);
    fs.chmodSync(binPath, 0o755);
    // The child writes its own readiness marker right after registering the
    // handler — polling for that instead of guessing a fixed delay
    // eliminates the race between "the process exists" (which pgrep can see
    // almost immediately) and "the SIGTERM handler is actually registered"
    // (which needs V8 to finish starting up first — confirmed the hard way:
    // a fixed 200ms wasn't reliably enough for a freshly copied node binary).
    const childScript = `process.on('SIGTERM', () => {}); require('fs').writeFileSync(${JSON.stringify(readyMarker)}, ''); setInterval(() => {}, 1000);`;
    const child = spawn(binPath, ['-e', childScript], { stdio: 'ignore' });

    // A SIGTERM-immune child that loops forever (setInterval, no natural
    // exit) must never be left running if an assertion below throws — only
    // SIGKILL can actually stop it, and only a finally block guarantees
    // that cleanup runs on every path, not just the happy one.
    try {
      for (let attempt = 0; attempt < 50 && !fs.existsSync(readyMarker); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.ok(fs.existsSync(readyMarker), 'the child never signaled it was ready');

      const { killed, alreadyGone, stillRunning } = await killAllByExactName(name);

      assert.deepEqual(killed, []);
      assert.deepEqual(alreadyGone, []);
      assert.deepEqual(stillRunning, [child.pid]);
      assert.doesNotThrow(() => process.kill(child.pid, 0), 'the process must genuinely still be alive');
    } finally {
      child.kill('SIGKILL');
    }
  },
);
