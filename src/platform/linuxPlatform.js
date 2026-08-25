import os from 'node:os';
import path from 'node:path';

export class LinuxPlatform {
  getMpvSocketPath() {
    return path.join(os.tmpdir(), 'tribe-vibe-mpv.sock');
  }

  getConfigDir() {
    return path.join(os.homedir(), '.config', 'tribe-vibe');
  }

  getDownloadsDir() {
    return path.join(os.homedir(), 'Downloads');
  }

  // Downloaded audio persists here, keyed by videoId — unlike a one-shot CLI,
  // tribe-vibe's aliases/playlists are meant to be replayed, so re-downloading
  // every time would waste real time on every repeat play.
  getCacheDir() {
    return path.join(os.homedir(), '.cache', 'tribe-vibe', 'audio');
  }

  getHotkeyToolName() {
    return 'sxhkd';
  }

  generateHotkeyConfig(bindings) {
    return bindings.map(({ key, flag }) => `${key}\n  tv -${flag}`).join('\n\n');
  }

  getInstallInstructions() {
    return 'sudo apt install mpv yt-dlp sxhkd';
  }

  getYtDlpUpgradeInstructions() {
    return 'sudo apt install --only-upgrade yt-dlp';
  }

  // yt-dlp's own recommended user-config location per OS (its README lists
  // several accepted paths; this is the one it recommends on this platform).
  getYtDlpConfigHint() {
    return '~/.config/yt-dlp/config';
  }
}
