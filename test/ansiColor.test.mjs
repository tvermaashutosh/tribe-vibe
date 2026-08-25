import test from 'node:test';
import assert from 'node:assert/strict';
import { colorize } from '../src/text/ansiColor.js';

function withTTY(value, fn) {
  return () => {
    const original = process.stdout.isTTY;
    Object.defineProperty(process.stdout, 'isTTY', { value, configurable: true });
    try {
      fn();
    } finally {
      Object.defineProperty(process.stdout, 'isTTY', { value: original, configurable: true });
    }
  };
}

test(
  'colorize wraps text in the color\'s ANSI code when attached to a real terminal',
  withTTY(true, () => {
    assert.equal(colorize('red', 'oops'), '\x1b[31moops\x1b[39m');
    assert.equal(colorize('green', 'ok'), '\x1b[32mok\x1b[39m');
    assert.equal(colorize('yellow', 'heads up'), '\x1b[33mheads up\x1b[39m');
    assert.equal(colorize('cyan', 'title'), '\x1b[36mtitle\x1b[39m');
  }),
);

test(
  'colorize leaves text untouched when not attached to a real terminal (piped/redirected output)',
  withTTY(false, () => {
    assert.equal(colorize('red', 'oops'), 'oops');
  }),
);
