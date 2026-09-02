import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export class MacPlatform {
  getMpvSocketPath() {
    return path.join(os.tmpdir(), 'tribe-vibe-mpv.sock');
  }

  // debugTrace.js's own log — same os.tmpdir()-backed shape as
  // getMpvSocketPath() above, for the same reason: a fixed-name file under
  // the OS's own scratch directory, not anything tribe-vibe's own config/
  // cache dirs should own.
  getDebugLogPath() {
    return path.join(os.tmpdir(), 'tribe-vibe-debug.log');
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

  // A binary on PATH here has no filename suffix — unlike Windows, which
  // needs .exe appended to actually find it (findAllOnPath in
  // diagnostics/runDiagnostics.js).
  getExecutableExtension() {
    return '';
  }

  // npm itself is a plain executable here — unlike Windows, where it's a
  // .cmd shim (see WindowsPlatform's own note). Not the same question
  // getExecutableExtension() answers: npm's Windows launcher is npm.cmd,
  // never npm.exe, so this needed its own method rather than reusing that one.
  getNpmCommand() {
    return 'npm';
  }

  // stty exists here; a raw-mode child (mpv) leaving the terminal stuck
  // afterward is fixable the standard way (playForeground.js's own
  // restoreTerminal/guardVulnerableWindow).
  canRestoreTerminal() {
    return true;
  }

  // Confirmed live: pgrep -x matches on a process's own short executable
  // name (argv[0]'s basename), not the full resolved path `ps -o comm=`
  // shows for the same process — exact-name matching only, never a
  // command-line substring pattern like pkill -f (the wrong scope of
  // pattern can match a totally unrelated process, confirmed the hard way
  // earlier in this project's own history).
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
