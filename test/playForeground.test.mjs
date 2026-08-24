import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { playForeground } from '../src/player/playForeground.js';

const SIGNAL_GUARD_DRIVER = fileURLToPath(new URL('./helpers/signalGuardDriver.mjs', import.meta.url));

test('playForeground rejects clearly when mpv is not on PATH', async () => {
  const originalPath = process.env.PATH;
  process.env.PATH = '/definitely/not/a/real/path';
  try {
    await assert.rejects(
      () => playForeground({ files: [{ path: '/tmp/does-not-matter.m4a' }] }),
      /mpv is not available/,
    );
  } finally {
    process.env.PATH = originalPath;
  }
});

test('playForeground pauses process.stdin before spawning mpv, when stdin looks like a real tty', async () => {
  // Confirmed by reproducing a real hang: Ink removes its own 'readable'
  // listener on unmount but never pauses the stream itself, and mpv doesn't
  // need Node's own stream wrapper active at all (it reads the raw inherited
  // fd directly) — so this should always run before mpv starts, whenever
  // stdin is a real tty.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-fake-mpv-'));
  fs.writeFileSync(path.join(dir, 'mpv'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(dir, 'stty'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });

  const originalPath = process.env.PATH;
  const originalIsTTY = process.stdin.isTTY;
  const originalPause = process.stdin.pause;
  let pauseCalled = false;
  process.env.PATH = `${dir}:${originalPath}`;
  Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
  process.stdin.pause = () => {
    pauseCalled = true;
    return process.stdin;
  };
  try {
    await playForeground({ files: [{ path: '/tmp/does-not-matter.m4a' }] });
    assert.equal(pauseCalled, true);
  } finally {
    process.env.PATH = originalPath;
    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
    process.stdin.pause = originalPause;
  }
});

test('playForeground skips pausing stdin when it is not a real tty', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-fake-mpv-'));
  fs.writeFileSync(path.join(dir, 'mpv'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });

  const originalPath = process.env.PATH;
  const originalIsTTY = process.stdin.isTTY;
  const originalPause = process.stdin.pause;
  let pauseCalled = false;
  process.env.PATH = `${dir}:${originalPath}`;
  Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
  process.stdin.pause = () => {
    pauseCalled = true;
    return process.stdin;
  };
  try {
    await playForeground({ files: [{ path: '/tmp/does-not-matter.m4a' }] });
    assert.equal(pauseCalled, false);
  } finally {
    process.env.PATH = originalPath;
    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
    process.stdin.pause = originalPause;
  }
});

test('playForeground resolves once the spawned process exits', async () => {
  // Swap in a trivial fake "mpv" binary that exits immediately, to prove the
  // spawn -> inherit stdio -> resolve-on-exit wiring works, without depending
  // on real mpv being installed in the test environment.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-fake-mpv-'));
  const shimPath = path.join(dir, 'mpv');
  fs.writeFileSync(shimPath, '#!/bin/sh\nexit 0\n', { mode: 0o755 });

  const originalPath = process.env.PATH;
  process.env.PATH = `${dir}:${originalPath}`;
  try {
    await playForeground({ files: [{ path: '/tmp/does-not-matter.m4a' }] });
  } finally {
    process.env.PATH = originalPath;
  }
});

test('playForeground scopes each file\'s title with mpv\'s own --{ / --} markers, so one title never leaks onto another file', async () => {
  // mpv applies a bare option to every file that follows it, not just the
  // very next one — verified live against real mpv (the last of two plain
  // --force-media-title values silently won for both files). The --{ / --}
  // per-file markers are mpv's real fix for that, confirmed the same way.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-fake-mpv-'));
  const argvFile = path.join(dir, 'argv.txt');
  fs.writeFileSync(path.join(dir, 'mpv'), `#!/bin/sh\necho "$@" > "${argvFile}"\nexit 0\n`, { mode: 0o755 });

  const originalPath = process.env.PATH;
  process.env.PATH = `${dir}:${originalPath}`;
  try {
    await playForeground({
      files: [
        { path: '/cache/a.m4a', title: 'Song A' },
        { path: '/cache/b.m4a', title: 'Song B' },
        { path: '/cache/c.m4a' },
      ],
    });
    const argv = fs.readFileSync(argvFile, 'utf8');
    assert.match(argv, /--\{ --force-media-title=Song A \/cache\/a\.m4a --\}/);
    assert.match(argv, /--\{ --force-media-title=Song B \/cache\/b\.m4a --\}/);
    assert.match(argv, /(?:^|\s)\/cache\/c\.m4a(?:\s|$)/);
    assert.match(argv, /--term-playing-msg=\x1b\[36m\$\{media-title\}\x1b\[39m/);
  } finally {
    process.env.PATH = originalPath;
  }
});

test('playForeground runs "stty sane" after mpv exits, when stdin looks like a real tty', async () => {
  // Restoring the terminal after a raw-mode child is a real tty operation —
  // there's no way to assert the terminal actually ended up sane without one
  // (same limitation as the Ink UI screens, per README). This only proves
  // the attempt happens with the right command, on the same contract this
  // codebase already uses elsewhere (a PATH shim recording its own argv).
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-fake-mpv-'));
  fs.writeFileSync(path.join(dir, 'mpv'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const sttyCallsFile = path.join(dir, 'stty-calls.txt');
  fs.writeFileSync(path.join(dir, 'stty'), `#!/bin/sh\necho "$@" >> "${sttyCallsFile}"\nexit 0\n`, { mode: 0o755 });

  const originalPath = process.env.PATH;
  const originalIsTTY = process.stdin.isTTY;
  process.env.PATH = `${dir}:${originalPath}`;
  // stdin isn't a real tty in the test runner — stub it so the same code
  // path a real terminal session takes actually runs here.
  Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
  try {
    await playForeground({ files: [{ path: '/tmp/does-not-matter.m4a' }] });
    assert.equal(fs.readFileSync(sttyCallsFile, 'utf8').trim(), 'sane');
  } finally {
    process.env.PATH = originalPath;
    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
  }
});

test(
  'playForeground restores the terminal and still exits cleanly if this process itself is signaled right after mpv exits',
  async () => {
    // Confirmed by tracing a real hang: this process can die in the window
    // between "mpv just exited" and its own controlled exit without running
    // ANY shutdown code, if something external signals it. Exercised via a
    // real child process (not in-process) since it needs actual signal
    // delivery and process.exit(), which would otherwise risk killing the
    // test runner. The fake stty deliberately sleeps, widening the window
    // long enough for the signal to reliably land inside it.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-fake-mpv-'));
    fs.writeFileSync(path.join(dir, 'mpv'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    const sttyCallsFile = path.join(dir, 'stty-calls.txt');
    fs.writeFileSync(
      path.join(dir, 'stty'),
      `#!/bin/sh\nsleep 0.5\necho "$@" >> "${sttyCallsFile}"\nexit 0\n`,
      { mode: 0o755 },
    );

    const child = spawn('node', [SIGNAL_GUARD_DRIVER], {
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
    });

    const exited = new Promise((resolve) => {
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });

    // Long enough for the driver to spawn mpv, mpv to exit, and the
    // vulnerable-window guard to register — short enough that the
    // deliberately-slow fake stty is still in flight.
    await new Promise((resolve) => setTimeout(resolve, 400));
    child.kill('SIGTERM');

    const { code } = await exited;
    assert.equal(code, 143); // the guard's own SIGTERM exit code
    assert.match(fs.readFileSync(sttyCallsFile, 'utf8'), /sane/);
  },
);

test('playForeground skips "stty sane" entirely when stdin is not a real tty', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-fake-mpv-'));
  fs.writeFileSync(path.join(dir, 'mpv'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const sttyCallsFile = path.join(dir, 'stty-calls.txt');
  fs.writeFileSync(path.join(dir, 'stty'), `#!/bin/sh\necho "$@" >> "${sttyCallsFile}"\nexit 0\n`, { mode: 0o755 });

  const originalPath = process.env.PATH;
  const originalIsTTY = process.stdin.isTTY;
  process.env.PATH = `${dir}:${originalPath}`;
  Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
  try {
    await playForeground({ files: [{ path: '/tmp/does-not-matter.m4a' }] });
    assert.equal(fs.existsSync(sttyCallsFile), false);
  } finally {
    process.env.PATH = originalPath;
    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
  }
});
