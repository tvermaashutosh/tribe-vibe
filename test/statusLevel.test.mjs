import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCliStatus } from '../src/ui/statusLevel.js';

function withTTY(fn) {
  return () => {
    const original = process.stdout.isTTY;
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    try {
      fn();
    } finally {
      Object.defineProperty(process.stdout, 'isTTY', { value: original, configurable: true });
    }
  };
}

// The same icon + color as Ink's own STATUS_ICON/STATUS_COLOR, so a
// warning/error/success message reads identically whether the typed CLI
// printed it or Ink rendered it — the exact parity this exists to guarantee.
test(
  'formatCliStatus matches Ink\'s own warning icon and color',
  withTTY(() => {
    assert.equal(formatCliStatus('warning', 'Nothing to play'), '\x1b[33m⚠ Nothing to play\x1b[39m');
  }),
);

test(
  'formatCliStatus matches Ink\'s own error icon and color',
  withTTY(() => {
    assert.equal(formatCliStatus('error', 'tribe-vibe error: boom'), '\x1b[31m✗ tribe-vibe error: boom\x1b[39m');
  }),
);

test(
  'formatCliStatus matches Ink\'s own success icon and color',
  withTTY(() => {
    assert.equal(formatCliStatus('success', 'Saved'), '\x1b[32m✓ Saved\x1b[39m');
  }),
);
