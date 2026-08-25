import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { YoutubeResolver } from '../src/resolvers/youtubeResolver.js';

function tempCacheDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-cache-test-'));
}

function fakePlatform() {
  return {
    getInstallInstructions: () => 'brew install mpv yt-dlp skhd',
    getYtDlpConfigHint: () => '~/.config/yt-dlp/config',
  };
}

test('downloadAudio returns an already-cached file without shelling out again', async () => {
  const cacheDir = tempCacheDir();
  const cachedPath = path.join(cacheDir, 'abc123.m4a');
  fs.writeFileSync(cachedPath, 'fake audio bytes');

  const resolver = new YoutubeResolver(fakePlatform());
  const result = await resolver.downloadAudio('abc123', cacheDir);

  assert.equal(result, cachedPath);
});

test('toWatchUrl builds a plain YouTube watch URL', () => {
  const resolver = new YoutubeResolver(fakePlatform());
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
    const resolver = new YoutubeResolver(fakePlatform());
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
    const resolver = new YoutubeResolver(fakePlatform());
    await resolver.downloadAudio('abc123', cacheDir).catch(() => {});
    const argv = fs.readFileSync(argvFile, 'utf8');
    assert.match(argv, /--socket-timeout 10/);
    assert.match(argv, /--retries 3/);
    assert.match(argv, /--fragment-retries 3/);
  }),
);

// Deliberately no flat wall-clock ceiling on the whole process — an earlier
// version of this fix added one, and it broke long songs, since a bigger
// file genuinely takes longer to transfer even on a healthy connection.
// --socket-timeout/--retries above are the correct, size-agnostic bound:
// they only fire when bytes actually stop arriving, so a slow-but-flowing
// download for a 1-hour compilation is never mistaken for a stall.

// tswift's own dependency check names the exact install command for every
// missing tool ("Install it: sudo apt install $cmd"), not just "is it
// installed?" — this locks in the same for the one binary this class needs.
function withMissingYtdlp(fn) {
  return async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-no-ytdlp-'));
    // An empty PATH entry with nothing named yt-dlp in it — spawn() will
    // fail with ENOENT, exactly like a genuinely missing binary would.
    const originalPath = process.env.PATH;
    process.env.PATH = dir;
    try {
      await fn();
    } finally {
      process.env.PATH = originalPath;
    }
  };
}

test(
  'search names the exact install command when yt-dlp is missing',
  withMissingYtdlp(async () => {
    const resolver = new YoutubeResolver(fakePlatform());
    await assert.rejects(() => resolver.search('some query', 5), /yt-dlp is not available.*Try: brew install mpv yt-dlp skhd/s);
  }),
);

test(
  'downloadAudio names the exact install command when yt-dlp is missing',
  withMissingYtdlp(async () => {
    const cacheDir = tempCacheDir();
    const resolver = new YoutubeResolver(fakePlatform());
    await assert.rejects(() => resolver.downloadAudio('abc123', cacheDir), /yt-dlp is not available.*Try: brew install mpv yt-dlp skhd/s);
  }),
);

// tswift's own remediation for exactly these two failures points at the same
// config file ("Check ~/.config/yt-dlp/config (player_client / remote-components)")
// alongside its yt-dlp -U / -F advice — matching that here too.
function withFailingYtdlp(stderrText) {
  return (fn) => async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-failing-ytdlp-'));
    fs.writeFileSync(path.join(dir, 'yt-dlp'), `#!/bin/sh\necho "${stderrText}" >&2\nexit 1\n`, { mode: 0o755 });
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
  'downloadAudio points at ~/.config/yt-dlp/config on a 403',
  withFailingYtdlp('ERROR: unable to download video data: HTTP Error 403: Forbidden')(async () => {
    const cacheDir = tempCacheDir();
    const resolver = new YoutubeResolver(fakePlatform());
    await assert.rejects(() => resolver.downloadAudio('abc123', cacheDir), /Check ~\/\.config\/yt-dlp\/config \(player_client \/ remote-components\)/);
  }),
);

test(
  'downloadAudio points at ~/.config/yt-dlp/config when the requested format is not available',
  withFailingYtdlp('ERROR: Requested format is not available')(async () => {
    const cacheDir = tempCacheDir();
    const resolver = new YoutubeResolver(fakePlatform());
    await assert.rejects(() => resolver.downloadAudio('abc123', cacheDir), /Check ~\/\.config\/yt-dlp\/config \(player_client \/ remote-components\)/);
  }),
);

// Locks in that the hint text actually comes from the platform adapter, not
// a hardcoded Unix path — yt-dlp doesn't even check ~/.config on Windows, so
// a fake platform standing in for it must be reflected verbatim here.
test(
  'downloadAudio uses whatever config hint the platform adapter gives it, not a hardcoded one',
  withFailingYtdlp('ERROR: unable to download video data: HTTP Error 403: Forbidden')(async () => {
    const cacheDir = tempCacheDir();
    const windowsStylePlatform = {
      getInstallInstructions: () => 'scoop install mpv yt-dlp autohotkey',
      getYtDlpConfigHint: () => '%APPDATA%\\yt-dlp\\config',
    };
    const resolver = new YoutubeResolver(windowsStylePlatform);
    await assert.rejects(() => resolver.downloadAudio('abc123', cacheDir), /Check %APPDATA%\\yt-dlp\\config \(player_client/);
  }),
);
