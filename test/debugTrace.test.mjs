import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { trace, truncateTraceLogForNewSession, LOG_PATH } from '../src/debugTrace.js';

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

test(
  'truncateTraceLogForNewSession() wipes existing content',
  withEnv(undefined, () => {
    fs.writeFileSync(LOG_PATH, 'stale content from a previous session\n');
    truncateTraceLogForNewSession();
    assert.equal(readLogTail(), '');
  }),
);

test(
  'trace() calls after truncateTraceLogForNewSession() still accumulate normally',
  withEnv(undefined, () => {
    truncateTraceLogForNewSession();
    trace('trace-test: first line of the session');
    trace('trace-test: second line of the same session');
    const contents = readLogTail();
    assert.match(contents, /first line of the session/);
    assert.match(contents, /second line of the same session/);
  }),
);

test(
  'truncateTraceLogForNewSession() does nothing when TRIBE_VIBE_TRACE=0',
  withEnv('0', () => {
    fs.writeFileSync(LOG_PATH, 'content that should survive since tracing is off\n');
    truncateTraceLogForNewSession();
    assert.match(readLogTail(), /content that should survive/);
  }),
);

test(
  'truncateTraceLogForNewSession() never throws, even if writing the log fails',
  withEnv(undefined, () => {
    const original = fs.writeFileSync;
    fs.writeFileSync = () => {
      throw new Error('simulated disk failure');
    };
    try {
      assert.doesNotThrow(() => truncateTraceLogForNewSession());
    } finally {
      fs.writeFileSync = original;
    }
  }),
);

// This is the actual bug that shipped: every tv invocation is its own OS
// process (a play, -pause, -kill, ...) sharing this one LOG_PATH file. An
// earlier version truncated on each process's own first trace() call — but
// a hotkey fired while a play is still running (the documented, everyday
// way hotkeys are meant to be used, per README's own "these control a
// background player, separate from a directly typed tv <song>") is a
// SEPARATE process, so its first trace() call wiped out everything the
// still-running play had already written. cli.js now only calls
// truncateTraceLogForNewSession() when it holds the session lock — which a
// control-flag command never acquires in the first place. This test proves
// the actual invariant that matters: a "process" that never calls
// truncate (standing in for a hotkey command, or a second play that lost
// the session-lock race) must never destroy what a "process" that already
// truncated and is still tracing has written.
test('a process that never truncates only ever appends, never wiping a still-running session\'s log', withEnv(undefined, () => {
  // Process A: wins the session lock, resets the log, starts tracing.
  truncateTraceLogForNewSession();
  trace('trace-test: process A — still-running play, line 1');

  // Process B: a hotkey command, or a play that lost the lock race — never
  // calls truncateTraceLogForNewSession() at all, only trace().
  trace('trace-test: process B — hotkey command, never truncates');

  // Process A keeps going, same as a real play continuing after a hotkey
  // fires mid-session.
  trace('trace-test: process A — still-running play, line 2');

  const contents = readLogTail();
  assert.match(contents, /process A — still-running play, line 1/);
  assert.match(contents, /process B — hotkey command, never truncates/);
  assert.match(contents, /process A — still-running play, line 2/);
}));
