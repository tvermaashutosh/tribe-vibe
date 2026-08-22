import test from 'node:test';
import assert from 'node:assert/strict';
import { formatNowPlaying } from '../src/player/nowPlayingMessage.js';

test('formatNowPlaying leaves a short title untouched', () => {
  assert.equal(formatNowPlaying('Some Song'), 'Now playing: Some Song');
});

test('formatNowPlaying truncates a title that would otherwise wrap onto a second row', () => {
  const originalColumns = process.stdout.columns;
  Object.defineProperty(process.stdout, 'columns', { value: 30, configurable: true });
  try {
    const message = formatNowPlaying('A very long song title that would definitely wrap onto a second line');
    assert.ok(message.length <= 30, `expected within 30 columns, got ${message.length}: ${message}`);
    assert.ok(message.startsWith('Now playing: '));
    assert.match(message, /…$/);
  } finally {
    Object.defineProperty(process.stdout, 'columns', { value: originalColumns, configurable: true });
  }
});
