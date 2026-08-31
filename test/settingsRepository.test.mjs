import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SettingsRepository } from '../src/repository/settingsRepository.js';

function tempConfigDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-settings-test-'));
}

test('all() returns the defaults on a fresh install with no settings.json yet', () => {
  const repo = new SettingsRepository(tempConfigDir());
  assert.deepEqual(repo.all(), { top: 5 });
});

test('save() persists to disk and a fresh repository instance reads it back', () => {
  const configDir = tempConfigDir();
  new SettingsRepository(configDir).save({ top: 20 });

  const reloaded = new SettingsRepository(configDir);
  assert.deepEqual(reloaded.all(), { top: 20 });
});

// Bug: save() used to reassign this.settings = next, so a caller holding
// the object returned by an earlier all() (like ctx.settings in cli.js,
// captured once at menu-launch and shared by every screen) kept reading
// the OLD object forever — every existing caller worked around this by
// manually re-patching that object by hand after every save(), a step
// that's easy to forget for any future caller. save() must mutate the same
// object in place instead, so all() keeps returning something current.
test('save() mutates the object already handed out by all(), instead of replacing it', () => {
  const repo = new SettingsRepository(tempConfigDir());
  const capturedReference = repo.all();

  repo.save({ top: 42 });

  assert.equal(repo.all(), capturedReference, 'all() must still return the exact same object identity');
  assert.deepEqual(capturedReference, { top: 42 }, 'the captured reference itself must reflect the save');
});

test('a caller that captured settings before any save() sees every later save() without re-fetching', () => {
  const repo = new SettingsRepository(tempConfigDir());
  const ctxSettings = repo.all();

  repo.save({ top: 10 });
  assert.equal(ctxSettings.top, 10);

  repo.save({ top: 99 });
  assert.equal(ctxSettings.top, 99);
});

test('save() falls back to defaults for a corrupted settings.json', () => {
  const configDir = tempConfigDir();
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(path.join(configDir, 'settings.json'), '{not valid json');

  const repo = new SettingsRepository(configDir);
  assert.deepEqual(repo.all(), { top: 5 });
});
