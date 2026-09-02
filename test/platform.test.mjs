import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlatform } from '../src/platform/index.js';
import { MacPlatform } from '../src/platform/macPlatform.js';
import { LinuxPlatform } from '../src/platform/linuxPlatform.js';
import { WindowsPlatform } from '../src/platform/windowsPlatform.js';

test('platform factory returns an adapter matching the current OS', () => {
  const platform = getPlatform();
  assert.equal(typeof platform.getMpvSocketPath(), 'string');
  assert.equal(typeof platform.getConfigDir(), 'string');
  assert.equal(typeof platform.getDownloadsDir(), 'string');
  assert.equal(typeof platform.getCacheDir(), 'string');
  assert.equal(typeof platform.getDebugLogPath(), 'string');
  assert.equal(typeof platform.getInstallInstructions(), 'string');
  assert.equal(typeof platform.getYtDlpUpgradeInstructions(), 'string');
  assert.equal(typeof platform.getYtDlpConfigHint(), 'string');
  assert.equal(typeof platform.generateHotkeyConfig([{ key: 'cmd+alt+p', flag: 'pause' }]), 'string');
  assert.equal(typeof platform.getExecutableExtension(), 'string');
  assert.equal(typeof platform.getNpmCommand(), 'string');
  assert.equal(typeof platform.canRestoreTerminal(), 'boolean');
  assert.ok(Array.isArray(platform.findProcessPidsByExactName('definitely-not-a-real-process-xyz')));
});

test('getDebugLogPath and getMpvSocketPath both live under the OS scratch dir, not tribe-vibe\'s own config/cache dirs', () => {
  const platform = getPlatform();
  assert.notEqual(platform.getDebugLogPath(), platform.getConfigDir());
  assert.notEqual(platform.getDebugLogPath(), platform.getCacheDir());
});

// The one Windows-specific fact this whole feature exists to capture: npm's
// own launcher there is a .cmd shim, never a real npm.exe — confirmed via
// Node's own well-known cross-platform spawn('npm', ...) ENOENT gotcha.
test('WindowsPlatform names npm as npm.cmd, not npm.exe or bare npm', () => {
  assert.equal(new WindowsPlatform().getNpmCommand(), 'npm.cmd');
});

test('MacPlatform and LinuxPlatform both name npm as the plain executable', () => {
  assert.equal(new MacPlatform().getNpmCommand(), 'npm');
  assert.equal(new LinuxPlatform().getNpmCommand(), 'npm');
});

// Confirmed live against real Homebrew: skhd isn't in homebrew-core at all
// (`brew search skhd` finds nothing there) — it only resolves via its
// author's own tap, koekeishiya/formulae, which a fully-qualified install
// auto-taps with no separate `brew tap` step. A plain `skhd` name here would
// fail for every real user, every time.
test('MacPlatform names skhd via its actual tap, not the bare formula name', () => {
  assert.match(new MacPlatform().getInstallInstructions(), /koekeishiya\/formulae\/skhd/);
});
