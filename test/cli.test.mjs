import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSingleFlag } from '../src/cli.js';

// Bug: aliases/playlists are legally allowed to be named a bare word like
// "pause" or "kill" (validateToken only forbids a leading -), but the old
// check stripped dashes before comparing, so an undashed alias matched the
// control-flag branch identically to its dashed form — silently hijacking a
// play into a hotkey command. Fixed by requiring the token to actually start
// with a dash before it's even considered a flag name.
test('parseSingleFlag returns null for a bare word — never treats an undashed alias as a flag', () => {
  assert.equal(parseSingleFlag(['pause']), null);
  assert.equal(parseSingleFlag(['kill']), null);
  assert.equal(parseSingleFlag(['next']), null);
});

test('parseSingleFlag returns the flag name, lowercased, for a dash-prefixed token', () => {
  assert.equal(parseSingleFlag(['-pause']), 'pause');
  assert.equal(parseSingleFlag(['-KILL']), 'kill');
  assert.equal(parseSingleFlag(['--pause']), 'pause');
});

test('parseSingleFlag returns null when there is more than one token, even if dash-prefixed', () => {
  assert.equal(parseSingleFlag(['-pause', 'extra']), null);
});

test('parseSingleFlag returns null for empty args', () => {
  assert.equal(parseSingleFlag([]), null);
});
