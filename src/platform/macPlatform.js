import os from 'node:os';
import path from 'node:path';

export class MacPlatform {
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
    return path.join(os.homedir(), 'Library', 'Caches', 'tribe-vibe', 'audio');
  }

  getHotkeyToolName() {
    return 'skhd';
  }

  generateHotkeyConfig(bindings) {
    return bindings.map(({ key, flag }) => `${key} : tv -${flag}`).join('\n');
  }

  // skhd isn't in homebrew-core (confirmed live: `brew search skhd` finds
  // nothing there at all) — it only lives in its author's own tap. The
  // fully-qualified name below auto-taps koekeishiya/formulae on install, no
  // separate `brew tap` step needed first — confirmed the same way.
  getInstallInstructions() {
    return 'brew install mpv yt-dlp koekeishiya/formulae/skhd';
  }

  getYtDlpUpgradeInstructions() {
    return 'brew upgrade yt-dlp';
  }

  // yt-dlp's own recommended user-config location per OS (its README lists
  // several accepted paths; this is the one it recommends on this platform).
  getYtDlpConfigHint() {
    return '~/.config/yt-dlp/config';
  }
}
