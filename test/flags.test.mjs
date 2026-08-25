import test from 'node:test';
import assert from 'node:assert/strict';
import { extractLoopFlag } from '../src/pipeline/flags.js';

test('extracts -loop and -l with a value, case-insensitively', () => {
  assert.deepEqual(extractLoopFlag(['-loop=10', 'foo', 'bar']), { loop: '10', remaining: ['foo', 'bar'] });
  assert.deepEqual(extractLoopFlag(['-l=5', 'foo']), { loop: '5', remaining: ['foo'] });
  assert.deepEqual(extractLoopFlag(['foo', '-LOOP=3', 'bar']), { loop: '3', remaining: ['foo', 'bar'] });
});

test('a bare -loop or -l (no value) means infinite', () => {
  assert.deepEqual(extractLoopFlag(['-loop', 'foo']), { loop: true, remaining: ['foo'] });
  assert.deepEqual(extractLoopFlag(['-l', 'foo']), { loop: true, remaining: ['foo'] });
});

// tswift, this app's own predecessor, accepted --loop (double-dash) too —
// without this, a token starting with -- would silently fall through as
// literal search text instead of being recognized as the flag at all.
test('double-dash --loop and --l are accepted the same as single-dash', () => {
  assert.deepEqual(extractLoopFlag(['--loop=10', 'foo', 'bar']), { loop: '10', remaining: ['foo', 'bar'] });
  assert.deepEqual(extractLoopFlag(['--l=5', 'foo']), { loop: '5', remaining: ['foo'] });
  assert.deepEqual(extractLoopFlag(['--loop', 'foo']), { loop: true, remaining: ['foo'] });
  assert.deepEqual(extractLoopFlag(['--l', 'foo']), { loop: true, remaining: ['foo'] });
});

test('order never matters — the flag can appear anywhere among the tokens', () => {
  assert.deepEqual(extractLoopFlag(['foo', 'bar', '-loop=10']), { loop: '10', remaining: ['foo', 'bar'] });
  assert.deepEqual(extractLoopFlag(['-loop=10', 'foo', 'bar']), { loop: '10', remaining: ['foo', 'bar'] });
});

test('nothing is extracted, and loop stays undefined, when the flag is absent', () => {
  assert.deepEqual(extractLoopFlag(['foo', 'bar']), { loop: undefined, remaining: ['foo', 'bar'] });
});

test('a plain word "loop" or "loop=10" (no dash) is not the flag — it stays in remaining', () => {
  assert.deepEqual(extractLoopFlag(['loop', 'loop=10', 'foo']), { loop: undefined, remaining: ['loop', 'loop=10', 'foo'] });
});
