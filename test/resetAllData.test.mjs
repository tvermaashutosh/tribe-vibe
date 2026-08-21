import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resetAllData } from '../src/repository/resetAllData.js';
import { AliasRepository } from '../src/repository/aliasRepository.js';
import { PlaylistRepository } from '../src/repository/playlistRepository.js';
import { TokenRegistry } from '../src/repository/tokenRegistry.js';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-test-'));
}

function fakePlatform(cacheDir) {
  return { getCacheDir: () => cacheDir };
}

test('resetAllData clears aliases, playlists, resets settings to defaults, and deletes the cache dir', () => {
  const configDir = tempDir();
  const cacheDir = tempDir();
  fs.writeFileSync(path.join(cacheDir, 'abc123.m4a'), 'fake cached audio');

  const aliasRepo = new AliasRepository(configDir);
  const playlistRepo = new PlaylistRepository(configDir);
  const tokenRegistry = new TokenRegistry(aliasRepo, playlistRepo);
  aliasRepo.addArtistAlias(['ts'], 'Taylor Swift', tokenRegistry);
  playlistRepo.create('focus', tokenRegistry);

  const settings = { top: 20 };
  const saved = [];
  const saveSettings = (next) => saved.push(next);

  resetAllData({ aliasRepo, playlistRepo, settings, saveSettings, platform: fakePlatform(cacheDir) });

  assert.deepEqual(aliasRepo.all(), []);
  assert.deepEqual(playlistRepo.all(), []);
  assert.deepEqual(saved, [{ top: 5 }]);
  assert.deepEqual(settings, { top: 5 });
  assert.equal(fs.existsSync(cacheDir), false);
});

test('resetAllData never touches anything outside the cache dir it was given', () => {
  const configDir = tempDir();
  const cacheDir = tempDir();
  const unrelatedDir = tempDir();
  fs.writeFileSync(path.join(unrelatedDir, 'not-tribe-vibe.txt'), 'leave me alone');

  const aliasRepo = new AliasRepository(configDir);
  const playlistRepo = new PlaylistRepository(configDir);
  const settings = { top: 5 };

  resetAllData({ aliasRepo, playlistRepo, settings, saveSettings: () => {}, platform: fakePlatform(cacheDir) });

  assert.ok(fs.existsSync(path.join(unrelatedDir, 'not-tribe-vibe.txt')));
});
