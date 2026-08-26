import { MacPlatform } from './macPlatform.js';
import { LinuxPlatform } from './linuxPlatform.js';
import { WindowsPlatform } from './windowsPlatform.js';

// Factory (closer to Abstract Factory, if you want the precise GoF name):
// this doesn't just pick one product, it picks a whole consistent *family*
// of them per OS — config dir, cache dir, socket path, hotkey tool, install
// instructions — bundled together as one PlatformAdapter, never mixed across
// platforms. The rest of the codebase only ever talks to that interface
// (getMpvSocketPath/getConfigDir/generateHotkeyConfig/getInstallInstructions)
// and never touches process.platform directly.
export function getPlatform() {
  switch (process.platform) {
    case 'darwin':
      return new MacPlatform();
    case 'linux':
      return new LinuxPlatform();
    case 'win32':
      return new WindowsPlatform();
    default:
      throw new Error(`Unsupported OS: ${process.platform}`);
  }
}
