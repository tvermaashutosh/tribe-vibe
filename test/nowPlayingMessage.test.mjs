import test from 'node:test';
import assert from 'node:assert/strict';
import { formatNowPlaying, formatNowPlayingPlaylist } from '../src/player/nowPlayingMessage.js';

test('formatNowPlaying leaves a short title untouched', () => {
  assert.equal(formatNowPlaying('Some Song'), 'Now playing song: Some Song');
});

test('formatNowPlaying keeps a long title in full — Ink wraps it onto another line rather than losing any of it', () => {
  const message = formatNowPlaying('A very long song title that would definitely wrap onto a second line');
  assert.equal(message, 'Now playing song: A very long song title that would definitely wrap onto a second line');
});

test('formatNowPlaying colors the title with cyan ANSI codes when attached to a real terminal', () => {
  const originalIsTTY = process.stdout.isTTY;
  Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
  try {
    assert.equal(formatNowPlaying('Some Song'), 'Now playing song: \x1b[36mSome Song\x1b[39m');
  } finally {
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true });
  }
});

test('formatNowPlaying leaves the title uncolored when not attached to a real terminal (piped/redirected output)', () => {
  const originalIsTTY = process.stdout.isTTY;
  Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
  try {
    assert.equal(formatNowPlaying('Some Song'), 'Now playing song: Some Song');
  } finally {
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true });
  }
});

test('formatNowPlayingPlaylist leaves a short name untouched', () => {
  assert.equal(formatNowPlayingPlaylist('bpmix'), 'Now playing playlist: bpmix');
});

test('formatNowPlayingPlaylist colors the name with cyan ANSI codes when attached to a real terminal', () => {
  const originalIsTTY = process.stdout.isTTY;
  Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
  try {
    assert.equal(formatNowPlayingPlaylist('bpmix'), 'Now playing playlist: \x1b[36mbpmix\x1b[39m');
  } finally {
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true });
  }
});

test('formatNowPlayingPlaylist leaves the name uncolored when not attached to a real terminal (piped/redirected output)', () => {
  const originalIsTTY = process.stdout.isTTY;
  Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
  try {
    assert.equal(formatNowPlayingPlaylist('bpmix'), 'Now playing playlist: bpmix');
  } finally {
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true });
  }
});
