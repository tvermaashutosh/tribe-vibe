import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { playForeground } from '../src/player/playForeground.js';

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
    assert.match(argv, /--term-playing-msg=Now playing: \$\{media-title\}/);
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
