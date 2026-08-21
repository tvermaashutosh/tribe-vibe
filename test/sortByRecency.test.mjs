import test from 'node:test';
import assert from 'node:assert/strict';
import { sortByRecency } from '../src/ui/sortByRecency.js';

test('sortByRecency orders most-recently-touched first', () => {
  const items = [{ id: 'old', updatedAt: 100 }, { id: 'new', updatedAt: 300 }, { id: 'mid', updatedAt: 200 }];
  assert.deepEqual(sortByRecency(items).map((item) => item.id), ['new', 'mid', 'old']);
});

test('sortByRecency treats a missing updatedAt as the oldest, not a crash', () => {
  const items = [{ id: 'no-timestamp' }, { id: 'has-one', updatedAt: 50 }];
  assert.deepEqual(sortByRecency(items).map((item) => item.id), ['has-one', 'no-timestamp']);
});

test('sortByRecency does not mutate the input array', () => {
  const items = [{ id: 'a', updatedAt: 1 }, { id: 'b', updatedAt: 2 }];
  const result = sortByRecency(items);
  assert.notEqual(result, items);
  assert.deepEqual(items.map((item) => item.id), ['a', 'b']);
});
