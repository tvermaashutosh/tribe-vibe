import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAliasListItems } from '../src/ui/aliasListItems.js';

test('buildAliasListItems returns "token → value" for a song alias, using its title', () => {
  const items = buildAliasListItems([{ token: 'tt', type: 'song', title: 'A Song' }]);
  assert.equal(items[0].label, 'tt  →  A Song');
  assert.equal(items[0].value, 'tt');
});

test('buildAliasListItems returns "token → value" for an artist alias, using its canonical value', () => {
  const items = buildAliasListItems([{ token: 'tsw', type: 'artist', value: 'Taylor Swift' }]);
  assert.equal(items[0].label, 'tsw  →  Taylor Swift');
});

test('buildAliasListItems sorts most-recently-touched first', () => {
  const aliases = [
    { token: 's-old', type: 'song', title: 'Old Song', updatedAt: 100 },
    { token: 's-new', type: 'song', title: 'New Song', updatedAt: 300 },
  ];
  const items = buildAliasListItems(aliases);
  assert.deepEqual(items.map((item) => item.value), ['s-new', 's-old']);
});

test('buildAliasListItems columnar-aligns the token column across every row', () => {
  const aliases = [
    { token: 'a-very-long-token', type: 'song', title: 'Short' },
    { token: 'tt', type: 'song', title: 'A much longer song title here' },
  ];
  const items = buildAliasListItems(aliases);
  const arrowStarts = items.map((item) => item.label.indexOf('→'));

  assert.equal(new Set(arrowStarts).size, 1);
  assert.equal(arrowStarts[0], 'a-very-long-token'.length + 2);
});

test('buildAliasListItems returns an empty list when there are no aliases', () => {
  assert.deepEqual(buildAliasListItems([]), []);
});
