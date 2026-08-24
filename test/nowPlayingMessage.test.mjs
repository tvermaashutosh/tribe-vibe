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
