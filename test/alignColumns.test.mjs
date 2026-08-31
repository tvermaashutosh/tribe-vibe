import test from 'node:test';
import assert from 'node:assert/strict';
import { alignColumns } from '../src/ui/alignColumns.js';

test('alignColumns returns an empty array for no rows', () => {
  assert.deepEqual(alignColumns([]), []);
});

test('alignColumns pads every column except the last to the width of its longest value', () => {
  const rows = [
    ['tt', '→', 'A short title', '(song)'],
    ['long-token', '→', 'A much longer title here', '(artist)'],
  ];

  const result = alignColumns(rows);

  // Column 0 (token): widened to 'long-token'.length === 10.
  assert.equal(result[0][0], 'tt'.padEnd(10));
  assert.equal(result[1][0], 'long-token');
  // Column 1 (arrow): both already 1 char, so unchanged.
  assert.equal(result[0][1], '→');
  assert.equal(result[1][1], '→');
  // Column 2 (value): widened to the longer row's length.
  assert.equal(result[0][2], 'A short title'.padEnd('A much longer title here'.length));
  assert.equal(result[1][2], 'A much longer title here');
  // Column 3 is the last column — left exactly as-is, never padded.
  assert.equal(result[0][3], '(song)');
  assert.equal(result[1][3], '(artist)');
});

test('alignColumns never truncates — the longest value in a column is untouched and every shorter one grows to match it', () => {
  const rows = [['a'], ['much-longer-value'], ['mid']];
  const result = alignColumns(rows);
  // Single-column rows: that column IS the last column, so nothing is padded
  // at all — there's nothing after it to align.
  assert.deepEqual(result, rows);
});

test('alignColumns leaves a single row unchanged (its own values are already the widest)', () => {
  const rows = [['solo', '→', 'value', '(song)']];
  assert.deepEqual(alignColumns(rows), rows);
});

test('alignColumns handles more than two rows, taking the max across all of them, not just the first two', () => {
  const rows = [
    ['a', 'x'],
    ['bb', 'y'],
    ['ccccc', 'z'],
    ['d', 'w'],
  ];
  const result = alignColumns(rows);
  assert.equal(result[0][0], 'a'.padEnd(5));
  assert.equal(result[1][0], 'bb'.padEnd(5));
  assert.equal(result[2][0], 'ccccc');
  assert.equal(result[3][0], 'd'.padEnd(5));
  // Last column (index 1) is never padded regardless of row count.
  assert.deepEqual(result.map((row) => row[1]), ['x', 'y', 'z', 'w']);
});
