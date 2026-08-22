import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { playSongForeground, playPlaylistForeground } from '../src/player/directPlay.js';

function fakeResolver() {
  const downloadCalls = [];
  return {
    downloadCalls,
    downloadAudio: async (videoId) => {
      downloadCalls.push(videoId);
      return `/cache/${videoId}.m4a`;
    },
    toWatchUrl: (videoId) => `https://www.youtube.com/watch?v=${videoId}`,
  };
}

function fakePlatform() {
  return { getCacheDir: () => '/cache' };
}

function withFakeMpv(fn) {
  return async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-fake-mpv-'));
    fs.writeFileSync(path.join(dir, 'mpv'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    const originalPath = process.env.PATH;
    process.env.PATH = `${dir}:${originalPath}`;
    try {
      await fn();
    } finally {
      process.env.PATH = originalPath;
    }
  };
}

// Same as withFakeMpv, but the fake mpv also dumps its argv to a file — used
// to prove exactly which paths/URLs mpv was actually handed.
function withArgvCapturingMpv(fn) {
  return async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-fake-mpv-'));
    const argvFile = path.join(dir, 'argv.txt');
    fs.writeFileSync(path.join(dir, 'mpv'), `#!/bin/sh\necho "$@" > "${argvFile}"\nexit 0\n`, { mode: 0o755 });
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
  'playSongForeground downloads first, fires onReady once ready, then hands off to mpv',
  withFakeMpv(async () => {
    const events = [];
    await playSongForeground({
      resolver: fakeResolver(),
      platform: fakePlatform(),
      videoId: 'abc123',
      title: 'Some Song',
      onReady: () => events.push('ready'),
    });
    assert.deepEqual(events, ['ready']);
  }),
);

test(
  'playPlaylistForeground rejects a name that does not exist, or one with no songs — before ever calling onPlaylistFound or onReady',
  withFakeMpv(async () => {
    let foundCalled = false;
    let readyCalled = false;
    const playlistRepo = { all: () => [{ name: 'empty', songs: [] }] };
    const callbacks = {
      onPlaylistFound: () => {
        foundCalled = true;
      },
      onReady: () => {
        readyCalled = true;
      },
    };

    await assert.rejects(
      () =>
        playPlaylistForeground({
          resolver: fakeResolver(),
          platform: fakePlatform(),
          playlistRepo,
          playlistName: 'missing',
          ...callbacks,
        }),
      /No playlist named/,
    );
    await assert.rejects(
      () =>
        playPlaylistForeground({
          resolver: fakeResolver(),
          platform: fakePlatform(),
          playlistRepo,
          playlistName: 'empty',
          ...callbacks,
        }),
      /has no songs yet/,
    );
    assert.equal(foundCalled, false);
    assert.equal(readyCalled, false);
  }),
);

test(
  'playPlaylistForeground fires onPlaylistFound immediately, before any downloading starts',
  withFakeMpv(async () => {
    const events = [];
    const playlistRepo = {
      all: () => [{ name: 'focus', songs: [{ videoId: 'a', title: 'Song A' }, { videoId: 'b', title: 'Song B' }] }],
    };
    const resolver = {
      downloadAudio: async (videoId) => {
        events.push(`download:${videoId}`);
        return `/cache/${videoId}.m4a`;
      },
      toWatchUrl: (videoId) => `https://www.youtube.com/watch?v=${videoId}`,
    };

    await playPlaylistForeground({
      resolver,
      platform: fakePlatform(),
      playlistRepo,
      playlistName: 'focus',
      onPlaylistFound: (playlist) => events.push(`found:${playlist.name}`),
    });

    assert.deepEqual(events, ['found:focus', 'download:a', 'download:b']);
  }),
);

test(
  'playPlaylistForeground fires onReady once every song is downloaded',
  withFakeMpv(async () => {
    const events = [];
    const playlistRepo = {
      all: () => [{ name: 'focus', songs: [{ videoId: 'a', title: 'Song A' }, { videoId: 'b', title: 'Song B' }] }],
    };
    await playPlaylistForeground({
      resolver: fakeResolver(),
      platform: fakePlatform(),
      playlistRepo,
      playlistName: 'focus',
      onReady: () => events.push('ready'),
    });
    assert.deepEqual(events, ['ready']);
  }),
);

test(
  'playPlaylistForeground downloads every song, one at a time in playlist order, before mpv ever starts — never a raw URL',
  withArgvCapturingMpv(async (argvFile) => {
    const resolver = fakeResolver();
    const playlistRepo = {
      all: () => [
        {
          name: 'focus',
          songs: [
            { videoId: 'a', title: 'Song A' },
            { videoId: 'b', title: 'Song B' },
            { videoId: 'c', title: 'Song C' },
          ],
        },
      ],
    };

    await playPlaylistForeground({ resolver, platform: fakePlatform(), playlistRepo, playlistName: 'focus' });

    assert.deepEqual(resolver.downloadCalls, ['a', 'b', 'c']);
    const argv = fs.readFileSync(argvFile, 'utf8');
    assert.match(argv, /\/cache\/a\.m4a/);
    assert.match(argv, /\/cache\/b\.m4a/);
    assert.match(argv, /\/cache\/c\.m4a/);
    assert.doesNotMatch(argv, /youtube\.com/);
  }),
);

test(
  'playPlaylistForeground passes the whole playlist (name + songs) to onReady, not just its name',
  withFakeMpv(async () => {
    let received = null;
    const playlist = { name: 'focus', songs: [{ videoId: 'a', title: 'Song A' }, { videoId: 'b', title: 'Song B' }] };
    const playlistRepo = { all: () => [playlist] };
    await playPlaylistForeground({
      resolver: fakeResolver(),
      platform: fakePlatform(),
      playlistRepo,
      playlistName: 'focus',
      onReady: (playedPlaylist) => {
        received = playedPlaylist;
      },
    });
    assert.deepEqual(received, playlist);
  }),
);
