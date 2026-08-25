import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlatform } from '../src/platform/index.js';

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
