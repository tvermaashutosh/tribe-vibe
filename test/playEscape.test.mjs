import test from 'node:test';
import assert from 'node:assert/strict';
import { playEscapeAction } from '../src/ui/playEscape.js';

test('the first Escape clears the Play query even when it is already empty', () => {
  assert.equal(playEscapeAction(false), 'clear');
});

test('a second consecutive Escape leaves the Play screen', () => {
  assert.equal(playEscapeAction(true), 'back');
});
