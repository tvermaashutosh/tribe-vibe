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

// On by default — a real user or CI run never sets TRIBE_VIBE_TRACE, so
// this must trace without any setup here either.
test(
  'trace() appends a timestamped line when TRIBE_VIBE_TRACE is unset (on by default)',
  withEnv(undefined, () => {
    const marker = `trace-test: unset-env marker ${Date.now()}-${Math.random()}`;
    trace(marker);
    const contents = readLogTail();
    assert.match(contents, new RegExp(`\\d{4}-\\d{2}-\\d{2}T.*${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  }),
);

test(
  'trace() appends a timestamped line when TRIBE_VIBE_TRACE is set to anything other than "0"',
  withEnv('yes-please', () => {
    const marker = `trace-test: non-zero-value marker ${Date.now()}-${Math.random()}`;
    trace(marker);
    const contents = readLogTail();
    assert.match(contents, new RegExp(`\\d{4}-\\d{2}-\\d{2}T.*${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  }),
);

test(
  'trace() writes nothing when TRIBE_VIBE_TRACE=0 (the opt-out)',
  withEnv('0', () => {
    const before = readLogTail();
    trace('trace-test: should not appear');
    const after = readLogTail();
    assert.equal(after, before);
  }),
);

test(
  'trace() never throws, even if writing the log fails',
  withEnv(undefined, () => {
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

// Bug this addresses: tracing is on by default now for every invocation,
// not just a deliberate one-off debug session — appending forever would
// grow the log unbounded across normal, ongoing use. A fresh import (cache
// -busted with a query string, the standard technique for a genuinely
// fresh module instance in a test) stands in for a real new `tv` process,
// since debugTrace.js's own truncate-once state is otherwise shared for
// the whole lifetime of one real process (or, here, one test run).
test(
  "a new run's first trace() call replaces the log, not appends to whatever a previous run left",
  withEnv(undefined, async () => {
    const { trace: freshTrace, LOG_PATH: freshLogPath } = await import(`../src/debugTrace.js?fresh=${Date.now()}-${Math.random()}`);
    fs.writeFileSync(freshLogPath, 'stale content left behind by a previous run\n');

    freshTrace('trace-test: first line of the new run');
    const afterFirst = fs.readFileSync(freshLogPath, 'utf8');
    assert.doesNotMatch(afterFirst, /stale content/);
    assert.match(afterFirst, /first line of the new run/);

    // A second call within the SAME run must still append, not truncate
    // again — that's what actually captures a whole lifecycle.
    freshTrace('trace-test: second line of the same new run');
    const afterSecond = fs.readFileSync(freshLogPath, 'utf8');
    assert.match(afterSecond, /first line of the new run/);
    assert.match(afterSecond, /second line of the same new run/);
  }),
);
