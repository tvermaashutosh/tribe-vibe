import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { killAllByExactName } from '../src/player/killAllMpv.js';
import { getPlatform } from '../src/platform/index.js';

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
  return {
    child: spawn(binPath, ['30'], { stdio: 'ignore' }),
    cleanup: () => {
      fs.rmSync(binPath, { force: true });
      fs.rmdirSync(dir);
    },
  };
}

function spawnNamedNodeProcess(name, { ignoreSigterm = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-fake-proc-'));
  const readyMarker = path.join(dir, 'ready');
  const signalHandler = ignoreSigterm ? "process.on('SIGTERM', () => {});" : '';
  const childScript = [
    `process.title = ${JSON.stringify(name)};`,
    signalHandler,
    `require('fs').writeFileSync(${JSON.stringify(readyMarker)}, '');`,
    'setInterval(() => {}, 1000);',
  ].join('');
  const child = spawn(process.execPath, ['-e', childScript], { stdio: 'ignore' });
  return {
    child,
    ready: waitForFile(readyMarker),
    cleanup: () => {
      fs.rmSync(readyMarker, { force: true });
      fs.rmdirSync(dir);
    },
  };
}

async function waitForFile(filePath, maxAttempts = 50) {
  for (let attempt = 0; attempt < maxAttempts && !fs.existsSync(filePath); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.ok(fs.existsSync(filePath), `child process did not create its readiness marker: ${filePath}`);
}

function uniqueProcessName(suffix) {
  const name = `tv${process.pid}${suffix}`;
  assert.ok(name.length <= 15, 'test process names must fit Linux comm/pgrep -x limits');
  return name;
}

const isWindows = process.platform === 'win32';

// A flat sleep before searching was flaky under load — a fixed delay can't
// promise the OS has registered the new process by then, on every machine,
// every time. Polling killAllByExactName itself until it actually finds the
// pid (or times out) removes the race entirely instead of guessing a number.
async function killAllByExactNameEventually(name, { maxAttempts = 30, intervalMs = 100 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await killAllByExactName(name, getPlatform());
    if (result.killed.length > 0 || result.alreadyGone.length > 0) return result;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return { killed: [], alreadyGone: [], stillRunning: [] };
}

test(
  'killAllByExactName finds and terminates a real process by its exact name',
  { skip: isWindows && 'tasklist-based enumeration unverified on Windows in this environment' },
  async () => {
    const name = uniqueProcessName('a');
    const { child, cleanup } = spawnFakeProcess(name);
    const exited = new Promise((resolve) => child.once('exit', resolve));

    try {
      const { killed, alreadyGone, stillRunning } = await killAllByExactNameEventually(name);
      await exited;

      assert.deepEqual(killed, [child.pid]);
      assert.deepEqual(alreadyGone, []);
      assert.deepEqual(stillRunning, []);
      assert.throws(() => process.kill(child.pid, 0));
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      await exited;
      cleanup();
    }
  },
);

test(
  'killAllByExactName does not touch a process with a different name',
  { skip: isWindows && 'tasklist-based enumeration unverified on Windows in this environment' },
  async () => {
    const unrelatedName = uniqueProcessName('u');
    const { child: unrelated, ready, cleanup } = spawnNamedNodeProcess(unrelatedName);
    const exited = new Promise((resolve) => unrelated.once('exit', resolve));

    try {
      await ready;
      assert.deepEqual(getPlatform().findProcessPidsByExactName(unrelatedName), [unrelated.pid]);
      const { killed, alreadyGone, stillRunning } = await killAllByExactName(uniqueProcessName('x'), getPlatform());

      assert.deepEqual(killed, []);
      assert.deepEqual(alreadyGone, []);
      assert.deepEqual(stillRunning, []);
      assert.doesNotThrow(() => process.kill(unrelated.pid, 0));
    } finally {
      if (unrelated.exitCode === null && unrelated.signalCode === null) unrelated.kill('SIGKILL');
      await exited;
      cleanup();
    }
  },
);

test('killAllByExactName returns empty arrays, does not throw, when nothing matches', async () => {
  const result = await killAllByExactName(uniqueProcessName('n'), getPlatform());
  assert.deepEqual(result, { killed: [], alreadyGone: [], stillRunning: [] });
});

// The actual fix: enumeration is delegated to platform.findProcessPidsByExactName
// now, not a process.platform === 'win32' check baked in here — a fake
// platform proves it by returning a made-up pid that was never really
// spawned. killAllByExactName must try to signal exactly that pid (and
// report it alreadyGone, since it doesn't really exist) rather than ever
// calling any real OS process-enumeration tool itself.
test('killAllByExactName uses whatever the platform adapter finds, not its own enumeration', async () => {
  const fakePlatform = { findProcessPidsByExactName: () => [999999] };
  const result = await killAllByExactName('irrelevant-name', fakePlatform);
  assert.deepEqual(result.alreadyGone, [999999]);
  assert.deepEqual(result.killed, []);
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
    const name = uniqueProcessName('s');
    const { child, ready, cleanup } = spawnNamedNodeProcess(name, { ignoreSigterm: true });
    const exited = new Promise((resolve) => child.once('exit', resolve));

    // A SIGTERM-immune child that loops forever (setInterval, no natural
    // exit) must never be left running if an assertion below throws — only
    // SIGKILL can actually stop it, and only a finally block guarantees
    // that cleanup runs on every path, not just the happy one.
    try {
      await ready;

      const { killed, alreadyGone, stillRunning } = await killAllByExactName(name, getPlatform());

      assert.deepEqual(killed, []);
      assert.deepEqual(alreadyGone, []);
      assert.deepEqual(stillRunning, [child.pid]);
      assert.doesNotThrow(() => process.kill(child.pid, 0), 'the process must genuinely still be alive');
    } finally {
      child.kill('SIGKILL');
      await exited;
      cleanup();
    }
  },
);
