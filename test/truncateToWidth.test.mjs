import test from 'node:test';
import assert from 'node:assert/strict';
import { truncateToWidth, getTerminalWidth, fitLine, SELECTION_INDICATOR_WIDTH } from '../src/text/truncateToWidth.js';

test('truncateToWidth leaves text under the limit untouched', () => {
  assert.equal(truncateToWidth('short', 10), 'short');
});

test('truncateToWidth leaves text exactly at the limit untouched', () => {
  assert.equal(truncateToWidth('exact', 5), 'exact');
});

test('truncateToWidth truncates and adds an ellipsis when text exceeds the limit', () => {
  assert.equal(truncateToWidth('a long piece of text', 10), 'a long pi…');
  assert.equal(truncateToWidth('a long piece of text', 10).length, 10);
});

test('truncateToWidth returns just the ellipsis when maxWidth is 1', () => {
  assert.equal(truncateToWidth('anything', 1), '…');
});

test('truncateToWidth returns an empty string when maxWidth is 0 or negative', () => {
  assert.equal(truncateToWidth('anything', 0), '');
  assert.equal(truncateToWidth('anything', -5), '');
});

test('getTerminalWidth reads process.stdout.columns', () => {
  const original = process.stdout.columns;
  Object.defineProperty(process.stdout, 'columns', { value: 120, configurable: true });
  try {
    assert.equal(getTerminalWidth(), 120);
  } finally {
    Object.defineProperty(process.stdout, 'columns', { value: original, configurable: true });
  }
});

test('getTerminalWidth falls back to 80 when not attached to a real tty', () => {
  const original = process.stdout.columns;
  Object.defineProperty(process.stdout, 'columns', { value: undefined, configurable: true });
  try {
    assert.equal(getTerminalWidth(), 80);
  } finally {
    Object.defineProperty(process.stdout, 'columns', { value: original, configurable: true });
  }
});

test('fitLine leaves prefix, middle, and suffix untouched when the whole line already fits', () => {
  assert.equal(fitLine('tt  →  ', 'Some Song', '  (song)', 80), 'tt  →  Some Song  (song)');
});

test('fitLine truncates only the middle, never the prefix or suffix, when the line is too long', () => {
  const result = fitLine('tt  →  ', 'A very long song title that would definitely overflow', '  (song)', 30);
  assert.ok(result.startsWith('tt  →  '));
  assert.ok(result.endsWith('  (song)'));
  assert.ok(result.includes('…'));
  assert.equal(result.length, 30);
});

test('fitLine never goes negative on the middle width when prefix+suffix alone exceed availableWidth', () => {
  const result = fitLine('a very long fixed prefix  →  ', 'title', '  (song)', 10);
  assert.equal(result, 'a very long fixed prefix  →    (song)');
});

test('SELECTION_INDICATOR_WIDTH is the 2-character "❯ "/"  " reservation used by every list', () => {
  assert.equal(SELECTION_INDICATOR_WIDTH, 2);
});
