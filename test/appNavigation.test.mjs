import test from 'node:test';
import assert from 'node:assert/strict';
import { appNavigationReducer, createInitialAppState } from '../src/ui/appNavigation.js';

test('the app opens its regular menu when there is no startup playback intent', () => {
  assert.deepEqual(createInitialAppState(undefined), { screen: 'main', pendingIntent: null });
});

test('a typed startup intent renders Now Playing before playback begins', () => {
  const intent = { kind: 'song', videoId: 'song-id', title: 'A song' };
  assert.deepEqual(createInitialAppState(intent), { screen: 'nowPlaying', pendingIntent: intent });
});

test('choosing a song or playlist transitions the active Ink view to Now Playing with its intent', () => {
  for (const intent of [
    { kind: 'song', videoId: 'song-id', title: 'A song' },
    { kind: 'playlist', playlistName: 'mix' },
  ]) {
    assert.deepEqual(appNavigationReducer({ screen: 'play', pendingIntent: null }, { type: 'play', intent }), {
      screen: 'nowPlaying',
      pendingIntent: intent,
    });
  }
});

test('playback is handed off only after the Now Playing render has consumed its intent', () => {
  const intent = { kind: 'song', videoId: 'song-id', title: 'A song' };
  const nowPlaying = appNavigationReducer({ screen: 'nowPlaying', pendingIntent: intent }, { type: 'play-started' });
  assert.deepEqual(nowPlaying, { screen: 'nowPlaying', pendingIntent: null });
});

test('ordinary app navigation preserves the pending play state', () => {
  const pendingIntent = { kind: 'playlist', playlistName: 'mix' };
  assert.deepEqual(appNavigationReducer({ screen: 'main', pendingIntent }, { type: 'navigate', screen: 'settings' }), {
    screen: 'settings',
    pendingIntent,
  });
});
