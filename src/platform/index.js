import { MacPlatform } from './macPlatform.js';
import { LinuxPlatform } from './linuxPlatform.js';
import { WindowsPlatform } from './windowsPlatform.js';

// Factory: the rest of the codebase only ever talks to the PlatformAdapter
// interface (getMpvSocketPath/getConfigDir/generateHotkeyConfig/getInstallInstructions)
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
