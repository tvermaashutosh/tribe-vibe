import test from 'node:test';
import assert from 'node:assert/strict';
import { formatNowPlaying } from '../src/player/nowPlayingMessage.js';

test('formatNowPlaying leaves a short title untouched', () => {
  assert.equal(formatNowPlaying('Some Song'), 'Now playing: Some Song');
});

test('formatNowPlaying keeps a long title in full — Ink wraps it onto another line rather than losing any of it', () => {
  const message = formatNowPlaying('A very long song title that would definitely wrap onto a second line');
  assert.equal(message, 'Now playing: A very long song title that would definitely wrap onto a second line');
});

test('formatNowPlaying colors the title with cyan ANSI codes when attached to a real terminal', () => {
  const originalIsTTY = process.stdout.isTTY;
  Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
  try {
    assert.equal(formatNowPlaying('Some Song'), 'Now playing: \x1b[36mSome Song\x1b[39m');
  } finally {
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true });
  }
});

test('formatNowPlaying leaves the title uncolored when not attached to a real terminal (piped/redirected output)', () => {
  const originalIsTTY = process.stdout.isTTY;
  Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
  try {
    assert.equal(formatNowPlaying('Some Song'), 'Now playing: Some Song');
  } finally {
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true });
  }
});
