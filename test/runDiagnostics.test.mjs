import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findAllOnPath, parseUpdateOutput, checkWritableDir, checkYtDlp } from '../src/diagnostics/runDiagnostics.js';

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

// The self-update-guard fix message used to hardcode "brew upgrade yt-dlp"
// regardless of OS — this locks in that it comes from the platform adapter
// instead, so a non-Mac platform never sees a brew-specific suggestion.
function withSelfUpdateBlockedYtdlp(fn) {
  return async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-blocked-ytdlp-'));
    fs.writeFileSync(
      path.join(dir, 'yt-dlp'),
      [
        '#!/bin/sh',
        'if [ "$1" = "--version" ]; then echo "2026.07.04"; exit 0; fi',
        'if [ "$1" = "-U" ]; then',
        '  echo "Current version: stable@2026.07.04 from yt-dlp/yt-dlp"',
        '  echo "Latest version: stable@2026.08.19 from yt-dlp/yt-dlp"',
        '  echo "ERROR: You installed yt-dlp with pip or using the wheel from PyPi; Use that to update" >&2',
        '  exit 1',
        'fi',
        'exit 0',
      ].join('\n'),
      { mode: 0o755 },
    );
    const originalPath = process.env.PATH;
    // A full replacement, not a prepend — findAllOnPath would otherwise also
    // find whatever real yt-dlp is installed on this machine and report
    // "multiple copies" instead of ever reaching the branch under test.
    process.env.PATH = dir;
    try {
      await fn();
    } finally {
      process.env.PATH = originalPath;
    }
  };
}

test(
  'checkYtDlp names the platform\'s own upgrade command when self-update is blocked, not a hardcoded one',
  withSelfUpdateBlockedYtdlp(async () => {
    const windowsStylePlatform = {
      getInstallInstructions: () => 'scoop install mpv yt-dlp autohotkey',
      getYtDlpUpgradeInstructions: () => 'scoop update yt-dlp',
    };
    const result = await checkYtDlp(windowsStylePlatform);
    assert.match(result.fix, /scoop update yt-dlp/);
    assert.doesNotMatch(result.fix, /brew/);
  }),
);

test('checkWritableDir reports success for a real writable directory, creating it if missing', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-writable-'));
  const nested = path.join(base, 'nested', 'dir');

  const result = checkWritableDir('Test dir', nested);

  assert.equal(result.status, 'success');
  assert.ok(fs.existsSync(nested));
});
