import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { YoutubeResolver } from '../src/resolvers/youtubeResolver.js';

function tempCacheDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-cache-test-'));
}

test('downloadAudio returns an already-cached file without shelling out again', async () => {
  const cacheDir = tempCacheDir();
  const cachedPath = path.join(cacheDir, 'abc123.m4a');
  fs.writeFileSync(cachedPath, 'fake audio bytes');

  const resolver = new YoutubeResolver();
  const result = await resolver.downloadAudio('abc123', cacheDir);

  assert.equal(result, cachedPath);
});

test('toWatchUrl builds a plain YouTube watch URL', () => {
  const resolver = new YoutubeResolver();
  assert.equal(resolver.toWatchUrl('abc123'), 'https://www.youtube.com/watch?v=abc123');
});

// yt-dlp's own defaults (10 retries, no socket-timeout unless told) can
// compound into a long, silent, unbounded wait on a stalled connection —
// exactly what a "sometimes 1-2 minute hang while playing" turned out to be.
// These lock in that every network-touching call is explicitly bounded,
// rather than trusting yt-dlp's own defaults to stay reasonable.
function withFakeYtdlpCapturingArgv(fn) {
  return async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-fake-ytdlp-'));
    const argvFile = path.join(dir, 'argv.txt');
    fs.writeFileSync(path.join(dir, 'yt-dlp'), `#!/bin/sh\necho "$@" > "${argvFile}"\necho '{"id":"x","title":"x"}'\nexit 0\n`, {
      mode: 0o755,
    });
    const originalPath = process.env.PATH;
    process.env.PATH = `${dir}:${originalPath}`;
    try {
      await fn(argvFile);
    } finally {
      process.env.PATH = originalPath;
    }
  };
}

test(
  'search bounds every attempt instead of trusting yt-dlp\'s own retry/timeout defaults',
  withFakeYtdlpCapturingArgv(async (argvFile) => {
    const resolver = new YoutubeResolver();
    await resolver.search('some query', 5);
    const argv = fs.readFileSync(argvFile, 'utf8');
    assert.match(argv, /--socket-timeout 10/);
    assert.match(argv, /--retries 3/);
    assert.match(argv, /--fragment-retries 3/);
  }),
);

test(
  'downloadAudio bounds every attempt instead of trusting yt-dlp\'s own retry/timeout defaults',
  withFakeYtdlpCapturingArgv(async (argvFile) => {
    const cacheDir = tempCacheDir();
    // The fake script above doesn't actually write a file, so downloadAudio
    // will reject after checking — that's fine, we only care about the argv
    // it was invoked with before that happens.
    const resolver = new YoutubeResolver();
    await resolver.downloadAudio('abc123', cacheDir).catch(() => {});
    const argv = fs.readFileSync(argvFile, 'utf8');
    assert.match(argv, /--socket-timeout 10/);
    assert.match(argv, /--retries 3/);
    assert.match(argv, /--fragment-retries 3/);
  }),
);

// --socket-timeout only catches a fully stalled connection (no data at all)
// — it does nothing for one that's still trickling in, just very slowly,
// which was confirmed live to take well over a minute on its own. This is
// the actual fix for that: a hard ceiling on the whole process, regardless
// of why it's slow. processTimeoutMs is overridden here (a real test can't
// wait out the real 90s default) with a fake yt-dlp that never exits on its
// own, proving the process actually gets killed once the ceiling is hit.
function withFakeYtdlpThatNeverExits(fn) {
  return async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-fake-ytdlp-hang-'));
    fs.writeFileSync(path.join(dir, 'yt-dlp'), '#!/bin/sh\nsleep 300\n', { mode: 0o755 });
    const originalPath = process.env.PATH;
    process.env.PATH = `${dir}:${originalPath}`;
    try {
      await fn();
    } finally {
      process.env.PATH = originalPath;
    }
  };
}

test(
  'search rejects with a clear timeout error instead of hanging when yt-dlp never exits',
  withFakeYtdlpThatNeverExits(async () => {
    const resolver = new YoutubeResolver({ processTimeoutMs: 100 });
    await assert.rejects(() => resolver.search('some query', 5), /timed out after 0\.1s/);
  }),
);

test(
  'downloadAudio rejects with a clear timeout error instead of hanging when yt-dlp never exits',
  withFakeYtdlpThatNeverExits(async () => {
    const cacheDir = tempCacheDir();
    const resolver = new YoutubeResolver({ processTimeoutMs: 100 });
    await assert.rejects(() => resolver.downloadAudio('abc123', cacheDir), /timed out after 0\.1s/);
  }),
);
