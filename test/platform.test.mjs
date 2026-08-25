import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlatform } from '../src/platform/index.js';
import { MacPlatform } from '../src/platform/macPlatform.js';

test('platform factory returns an adapter matching the current OS', () => {
  const platform = getPlatform();
  assert.equal(typeof platform.getMpvSocketPath(), 'string');
  assert.equal(typeof platform.getConfigDir(), 'string');
  assert.equal(typeof platform.getDownloadsDir(), 'string');
  assert.equal(typeof platform.getCacheDir(), 'string');
  assert.equal(typeof platform.getInstallInstructions(), 'string');
  assert.equal(typeof platform.getYtDlpUpgradeInstructions(), 'string');
  assert.equal(typeof platform.getYtDlpConfigHint(), 'string');
  assert.equal(typeof platform.generateHotkeyConfig([{ key: 'cmd+alt+p', flag: 'pause' }]), 'string');
});

// Confirmed live against real Homebrew: skhd isn't in homebrew-core at all
// (`brew search skhd` finds nothing there) — it only resolves via its
// author's own tap, koekeishiya/formulae, which a fully-qualified install
// auto-taps with no separate `brew tap` step. A plain `skhd` name here would
// fail for every real user, every time.
test('MacPlatform names skhd via its actual tap, not the bare formula name', () => {
  assert.match(new MacPlatform().getInstallInstructions(), /koekeishiya\/formulae\/skhd/);
});
