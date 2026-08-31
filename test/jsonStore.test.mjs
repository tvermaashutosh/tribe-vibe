import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readJsonArray, writeJsonAtomic } from '../src/repository/jsonStore.js';

function tempFilePath(name = 'store.json') {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-jsonstore-test-')), name);
}

test('readJsonArray returns an empty array when the file does not exist', () => {
  assert.deepEqual(readJsonArray(tempFilePath()), []);
});

test('readJsonArray returns an empty array for a blank/whitespace-only file', () => {
  const filePath = tempFilePath();
  fs.writeFileSync(filePath, '   \n');
  assert.deepEqual(readJsonArray(filePath), []);
});

test('readJsonArray round-trips real data written by writeJsonAtomic', () => {
  const filePath = tempFilePath();
  const data = [{ token: 'tsw', type: 'artist', value: 'Taylor Swift' }];
  writeJsonAtomic(filePath, data);
  assert.deepEqual(readJsonArray(filePath), data);
});

// Bug: this used to throw uncaught, crashing every single tv invocation —
// even tv -pause, since AliasRepository/PlaylistRepository are constructed
// unconditionally at the top of runSession(). Matches how
// SettingsRepository._load() already self-heals from the same corruption.
test('readJsonArray falls back to an empty array for truncated/corrupted JSON, instead of throwing', () => {
  const filePath = tempFilePath();
  fs.writeFileSync(filePath, '[{"token": "tsw", "type": "artist"'); // truncated mid-write
  assert.doesNotThrow(() => readJsonArray(filePath));
  assert.deepEqual(readJsonArray(filePath), []);
});

test('readJsonArray falls back to an empty array for syntactically-valid JSON that is not an array', () => {
  const filePath = tempFilePath();
  fs.writeFileSync(filePath, '{"not": "an array"}');
  assert.deepEqual(readJsonArray(filePath), []);
});

test('writeJsonAtomic creates the parent directory if it does not exist yet', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-jsonstore-test-'));
  const filePath = path.join(base, 'nested', 'dir', 'store.json');
  writeJsonAtomic(filePath, [{ a: 1 }]);
  assert.deepEqual(readJsonArray(filePath), [{ a: 1 }]);
});

test('writeJsonAtomic never leaves a corrupted file behind mid-write — the old file stays valid until the rename completes', () => {
  const filePath = tempFilePath();
  writeJsonAtomic(filePath, [{ a: 1 }]);
  writeJsonAtomic(filePath, [{ a: 2 }]);
  // Only the real file should exist afterward — no leftover .tmp-<pid> file.
  const dir = path.dirname(filePath);
  const leftover = fs.readdirSync(dir).filter((name) => name.includes('.tmp-'));
  assert.deepEqual(leftover, []);
  assert.deepEqual(readJsonArray(filePath), [{ a: 2 }]);
});

// The actual point of the shared name: this now writes a plain object just
// as well as an array — SettingsRepository.save() relies on exactly this,
// having dropped its own duplicated copy of this same write logic.
test('writeJsonAtomic works with a plain object, not just an array', () => {
  const filePath = tempFilePath('settings.json');
  writeJsonAtomic(filePath, { top: 20 });
  assert.deepEqual(JSON.parse(fs.readFileSync(filePath, 'utf8')), { top: 20 });
});
