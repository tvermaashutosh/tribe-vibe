import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findAllOnPath, parseUpdateOutput, checkWritableDir } from '../src/diagnostics/runDiagnostics.js';

test('findAllOnPath finds every matching binary across PATH, including duplicates', () => {
  const dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-path-a-'));
  const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-path-b-'));
  const dirC = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-path-c-'));
  fs.writeFileSync(path.join(dirA, 'yt-dlp'), '#!/bin/sh\n');
  fs.writeFileSync(path.join(dirB, 'yt-dlp'), '#!/bin/sh\n');
  // dirC deliberately has no yt-dlp — confirms it's not just returning every PATH dir

  const originalPath = process.env.PATH;
  process.env.PATH = [dirA, dirB, dirC].join(path.delimiter);
  try {
    const found = findAllOnPath('yt-dlp');
    assert.deepEqual(found, [path.join(dirA, 'yt-dlp'), path.join(dirB, 'yt-dlp')]);
  } finally {
    process.env.PATH = originalPath;
  }
});

test('findAllOnPath returns empty when nothing matches', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-path-empty-'));
  const originalPath = process.env.PATH;
  process.env.PATH = dir;
  try {
    assert.deepEqual(findAllOnPath('definitely-not-a-real-binary'), []);
  } finally {
    process.env.PATH = originalPath;
  }
});

test('parseUpdateOutput extracts current/latest even from a self-update-blocked, non-zero-exit response', () => {
  const output = [
    'Current version: stable@2026.07.04 from yt-dlp/yt-dlp',
    'Latest version: stable@2026.08.19 from yt-dlp/yt-dlp',
    'ERROR: You installed yt-dlp with pip or using the wheel from PyPi; Use that to update',
  ].join('\n');

  const result = parseUpdateOutput(output);

  assert.equal(result.current, '2026.07.04');
  assert.equal(result.latest, '2026.08.19');
  assert.equal(result.blockedBySelfUpdateGuard, true);
});

test('parseUpdateOutput reports no update blocker when self-update actually works', () => {
  const output = 'Current version: 2026.08.19\nLatest version: 2026.08.19\nyt-dlp is up to date';
  const result = parseUpdateOutput(output);

  assert.equal(result.current, '2026.08.19');
  assert.equal(result.latest, '2026.08.19');
  assert.equal(result.blockedBySelfUpdateGuard, false);
});

test('checkWritableDir reports success for a real writable directory, creating it if missing', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-writable-'));
  const nested = path.join(base, 'nested', 'dir');

  const result = checkWritableDir('Test dir', nested);

  assert.equal(result.status, 'success');
  assert.ok(fs.existsSync(nested));
});
