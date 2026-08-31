import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnAndCollect } from '../src/spawnAndCollect.js';

function fakeBin(script) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-spawn-test-'));
  const binPath = path.join(dir, 'fake-bin');
  fs.writeFileSync(binPath, `#!/bin/sh\n${script}`, { mode: 0o755 });
  return binPath;
}

test('spawnAndCollect resolves with stdout/stderr and code on a normal exit', async () => {
  const bin = fakeBin('echo "out line"\necho "err line" >&2\nexit 0\n');
  const result = await spawnAndCollect(bin, []);
  assert.equal(result.code, 0);
  assert.equal(result.stdout.trim(), 'out line');
  assert.equal(result.stderr.trim(), 'err line');
  assert.equal(result.spawnError, null);
});

test('spawnAndCollect resolves (never rejects) with the non-zero exit code', async () => {
  const bin = fakeBin('echo "failure detail" >&2\nexit 7\n');
  const result = await spawnAndCollect(bin, []);
  assert.equal(result.code, 7);
  assert.equal(result.stderr.trim(), 'failure detail');
  assert.equal(result.spawnError, null);
});

test('spawnAndCollect resolves with code:null and the raw spawn error when the binary does not exist', async () => {
  const result = await spawnAndCollect('definitely-not-a-real-binary-xyz', []);
  assert.equal(result.code, null);
  assert.ok(result.spawnError instanceof Error);
  assert.match(result.spawnError.message, /ENOENT/);
});

test('spawnAndCollect passes args through to the spawned command', async () => {
  const bin = fakeBin('echo "$@"\n');
  const result = await spawnAndCollect(bin, ['one', 'two', 'three']);
  assert.equal(result.stdout.trim(), 'one two three');
});
