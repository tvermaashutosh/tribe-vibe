import test from 'node:test';
import assert from 'node:assert/strict';
import { findFirstSelectable, moveSelection } from '../src/ui/skipListNav.js';

function items(...labels) {
  return labels.map((label) => (label === '---' ? { divider: true, value: '__divider__', label: '---' } : { value: label, label }));
}

test('findFirstSelectable returns the first non-divider index', () => {
  assert.equal(findFirstSelectable(items('a', 'b')), 0);
  assert.equal(findFirstSelectable(items('---', 'a', 'b')), 1);
});

test('findFirstSelectable falls back to 0 when every item is (implausibly) a divider', () => {
  assert.equal(findFirstSelectable(items('---', '---')), 0);
});

test('moveSelection down skips straight over a divider to the next real item', () => {
  const list = items('a', '---', 'b');
  assert.equal(moveSelection(list, 0, 1), 2);
});

test('moveSelection up skips straight over a divider to the previous real item', () => {
  const list = items('a', '---', 'b');
  assert.equal(moveSelection(list, 2, -1), 0);
});

test('moveSelection wraps around the end/start of the list, still skipping dividers', () => {
  const list = items('a', '---', 'b');
  assert.equal(moveSelection(list, 2, 1), 0); // down from last -> wraps to first real item
  assert.equal(moveSelection(list, 0, -1), 2); // up from first -> wraps to last real item
});

test('moveSelection behaves like plain ±1 stepping when there is no divider at all', () => {
  const list = items('a', 'b', 'c');
  assert.equal(moveSelection(list, 0, 1), 1);
  assert.equal(moveSelection(list, 1, 1), 2);
  assert.equal(moveSelection(list, 2, 1), 0);
});

test('moveSelection skips multiple consecutive dividers in one step', () => {
  const list = items('a', '---', '---', 'b');
  assert.equal(moveSelection(list, 0, 1), 3);
  assert.equal(moveSelection(list, 3, -1), 0);
});
