import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAliasListItems } from '../src/ui/aliasListItems.js';

test('buildAliasListItems puts all songs before all artists, regardless of storage order', () => {
  const aliases = [
    { token: 'a1', type: 'artist', value: 'Artist One' },
    { token: 's1', type: 'song', title: 'Song One' },
    { token: 'a2', type: 'artist', value: 'Artist Two' },
    { token: 's2', type: 'song', title: 'Song Two' },
  ];
  const items = buildAliasListItems(aliases);
  assert.deepEqual(items.map((item) => item.value), ['s1', 's2', 'a1', 'a2']);
});

test('buildAliasListItems returns "token → value (type)" for each row, with value in full', () => {
  const aliases = [{ token: 'tt', type: 'song', title: 'A Song' }];
  const items = buildAliasListItems(aliases);
  assert.equal(items[0].label, 'tt  →  A Song  (song)');
  assert.equal(items[0].value, 'tt');
});

test('buildAliasListItems columnar-aligns the token column and the "(type)" column across songs and artists together', () => {
  const aliases = [
    { token: 'a-very-long-token', type: 'song', title: 'Short' },
    { token: 'a1', type: 'artist', value: 'A much longer canonical artist name' },
  ];
  const items = buildAliasListItems(aliases);
  const arrowStarts = items.map((item) => item.label.indexOf('→'));
  const parenStarts = items.map((item) => item.label.indexOf('('));

  assert.equal(new Set(arrowStarts).size, 1);
  assert.equal(new Set(parenStarts).size, 1);
  assert.equal(arrowStarts[0], 'a-very-long-token'.length + 2);
});

test('buildAliasListItems returns an empty list when there are no aliases', () => {
  assert.deepEqual(buildAliasListItems([]), []);
});
