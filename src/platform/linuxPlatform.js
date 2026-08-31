import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

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

  // A binary on PATH here has no filename suffix — unlike Windows, which
  // needs .exe appended to actually find it (findAllOnPath in
  // diagnostics/runDiagnostics.js).
  getExecutableExtension() {
    return '';
  }

  // stty exists here; a raw-mode child (mpv) leaving the terminal stuck
  // afterward is fixable the standard way (playForeground.js's own
  // restoreTerminal/guardVulnerableWindow).
  canRestoreTerminal() {
    return true;
  }

  // Confirmed live on macOS (this project has no Linux machine to verify
  // on directly) — pgrep -x matches on a process's own short executable
  // name (argv[0]'s basename), a standard procps utility present on
  // virtually every Linux distro by default, same as macOS. Exact-name
  // matching only, never a command-line substring pattern like pkill -f
  // (the wrong scope of pattern can match a totally unrelated process,
  // confirmed the hard way earlier in this project's own history).
  findProcessPidsByExactName(name) {
    try {
      const output = execFileSync('pgrep', ['-x', name], { encoding: 'utf8' });
      return output
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map(Number);
    } catch (err) {
      // pgrep's own documented exit status for "nothing matched" — not a
      // real failure.
      if (err.status === 1) return [];
      throw err;
    }
  }
}
