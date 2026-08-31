import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { trace, LOG_PATH } from '../src/debugTrace.js';

function withEnv(value, fn) {
  return async () => {
    const original = process.env.TRIBE_VIBE_TRACE;
    if (value === undefined) delete process.env.TRIBE_VIBE_TRACE;
    else process.env.TRIBE_VIBE_TRACE = value;
    try {
      await fn();
    } finally {
      if (original === undefined) delete process.env.TRIBE_VIBE_TRACE;
      else process.env.TRIBE_VIBE_TRACE = original;
    }
  };
}

function readLogTail() {
  try {
    return fs.readFileSync(LOG_PATH, 'utf8');
  } catch {
    return '';
  }
}

// Off by default — zero cost in normal use. A real user or CI run never sets
// TRIBE_VIBE_TRACE, so this must be true without any setup here either.
test(
  'trace() writes nothing when TRIBE_VIBE_TRACE is unset',
  withEnv(undefined, () => {
    const before = readLogTail();
    trace('trace-test: should not appear');
    const after = readLogTail();
    assert.equal(after, before);
  }),
);

test(
  'trace() writes nothing when TRIBE_VIBE_TRACE is set to anything other than "1"',
  withEnv('true', () => {
    const before = readLogTail();
    trace('trace-test: should not appear either');
    const after = readLogTail();
    assert.equal(after, before);
  }),
);

test(
  'trace() appends a timestamped line when TRIBE_VIBE_TRACE=1',
  withEnv('1', () => {
    const marker = `trace-test: unique marker ${Date.now()}-${Math.random()}`;
    trace(marker);
    const contents = readLogTail();
    assert.match(contents, new RegExp(`\\d{4}-\\d{2}-\\d{2}T.*${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  }),
);

test(
  'trace() never throws, even if writing the log fails',
  withEnv('1', () => {
    const original = fs.appendFileSync;
    fs.appendFileSync = () => {
      throw new Error('simulated disk failure');
    };
    try {
      assert.doesNotThrow(() => trace('trace-test: should be best-effort'));
    } finally {
      fs.appendFileSync = original;
    }
  }),
);
