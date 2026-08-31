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
  return {
    getCacheDir: () => '/cache',
    getInstallInstructions: () => 'brew install mpv yt-dlp skhd',
    canRestoreTerminal: () => true,
  };
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
  'playSongForeground passes the downloaded file\'s local path to onReady',
  withFakeMpv(async () => {
    let receivedPath = null;
    await playSongForeground({
      resolver: fakeResolver(),
      platform: fakePlatform(),
      videoId: 'abc123',
      title: 'Some Song',
      onReady: (localFile) => {
        receivedPath = localFile;
      },
    });
    assert.equal(receivedPath, '/cache/abc123.m4a');
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
  'playPlaylistForeground calls onEmpty instead of throwing, when a caller opts in',
  withFakeMpv(async () => {
    let readyCalled = false;
    let receivedPlaylist = null;
    const playlistRepo = { all: () => [{ name: 'empty', songs: [] }] };

    await playPlaylistForeground({
      resolver: fakeResolver(),
      platform: fakePlatform(),
      playlistRepo,
      playlistName: 'empty',
      onEmpty: (playlist) => {
        receivedPlaylist = playlist;
      },
      onReady: () => {
        readyCalled = true;
      },
    });

    assert.deepEqual(receivedPlaylist, { name: 'empty', songs: [] });
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

// Bug: one bad song (deleted from YouTube, a genuine download failure) used
// to abort the entire playlist play, discarding every song already
// downloaded. This is the actual reported scenario: a 10-song playlist
// where song #3 fails — the other 9 should still play.
test(
  'playPlaylistForeground skips a song whose download fails, and still plays the rest',
  withArgvCapturingMpv(async (argvFile) => {
    const playlistRepo = {
      all: () => [
        {
          name: 'focus',
          songs: [
            { videoId: 'a', title: 'Song A' },
            { videoId: 'bad', title: 'Deleted Song' },
            { videoId: 'c', title: 'Song C' },
          ],
        },
      ],
    };
    const resolver = {
      downloadAudio: async (videoId) => {
        if (videoId === 'bad') throw new Error('Video unavailable');
        return `/cache/${videoId}.m4a`;
      },
      toWatchUrl: (videoId) => `https://www.youtube.com/watch?v=${videoId}`,
    };

    const failed = [];
    await playPlaylistForeground({
      resolver,
      platform: fakePlatform(),
      playlistRepo,
      playlistName: 'focus',
      onSongFailed: (song, err) => failed.push({ title: song.title, message: err.message }),
    });

    assert.deepEqual(failed, [{ title: 'Deleted Song', message: 'Video unavailable' }]);
    const argv = fs.readFileSync(argvFile, 'utf8');
    assert.match(argv, /\/cache\/a\.m4a/);
    assert.match(argv, /\/cache\/c\.m4a/);
    assert.doesNotMatch(argv, /bad/);
  }),
);

test(
  'playPlaylistForeground works with no onSongFailed given — the song is still skipped, not fatal',
  withArgvCapturingMpv(async (argvFile) => {
    const playlistRepo = {
      all: () => [{ name: 'focus', songs: [{ videoId: 'a', title: 'Song A' }, { videoId: 'bad', title: 'Deleted Song' }] }],
    };
    const resolver = {
      downloadAudio: async (videoId) => {
        if (videoId === 'bad') throw new Error('Video unavailable');
        return `/cache/${videoId}.m4a`;
      },
      toWatchUrl: (videoId) => `https://www.youtube.com/watch?v=${videoId}`,
    };

    await playPlaylistForeground({ resolver, platform: fakePlatform(), playlistRepo, playlistName: 'focus' });

    const argv = fs.readFileSync(argvFile, 'utf8');
    assert.match(argv, /\/cache\/a\.m4a/);
  }),
);

test(
  'playPlaylistForeground throws a clear error when every song fails to download — never hands mpv an empty file list',
  withFakeMpv(async () => {
    const playlistRepo = {
      all: () => [{ name: 'focus', songs: [{ videoId: 'a', title: 'Song A' }, { videoId: 'b', title: 'Song B' }] }],
    };
    const resolver = {
      downloadAudio: async () => {
        throw new Error('network down');
      },
      toWatchUrl: (videoId) => `https://www.youtube.com/watch?v=${videoId}`,
    };

    await assert.rejects(
      () => playPlaylistForeground({ resolver, platform: fakePlatform(), playlistRepo, playlistName: 'focus' }),
      /every song failed to download/,
    );
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
