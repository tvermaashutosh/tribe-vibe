import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export class WindowsPlatform {
  getMpvSocketPath() {
    // mpv speaks its JSON IPC protocol over a named pipe on Windows — Node's
    // net.connect accepts this path the same way it accepts a Unix socket path.
    return '\\\\.\\pipe\\tribevibe';
  }

  // debugTrace.js's own log — plain os.tmpdir()-backed file, same as
  // macOS/Linux, since (unlike the mpv socket above) there's no
  // Windows-specific transport question here, just a scratch-dir file path.
  getDebugLogPath() {
    return path.join(os.tmpdir(), 'tribe-vibe-debug.log');
  }

  getConfigDir() {
    return path.join(process.env.APPDATA || os.homedir(), 'tribe-vibe');
  }

  getDownloadsDir() {
    return path.join(os.homedir(), 'Downloads');
  }

  // Downloaded audio persists here, keyed by videoId — unlike a one-shot CLI,
  // tribe-vibe's aliases/playlists are meant to be replayed, so re-downloading
  // every time would waste real time on every repeat play.
  getCacheDir() {
    return path.join(process.env.LOCALAPPDATA || os.homedir(), 'tribe-vibe', 'Cache', 'audio');
  }

  getHotkeyToolName() {
    return 'AutoHotkey';
  }

  generateHotkeyConfig(bindings) {
    return bindings.map(({ key, flag }) => `${key}::Run, tv -${flag}`).join('\n');
  }

  getInstallInstructions() {
    return 'scoop install mpv yt-dlp autohotkey';
  }

  getYtDlpUpgradeInstructions() {
    return 'scoop update yt-dlp';
  }

  // yt-dlp's own recommended user-config location per OS (its README lists
  // several accepted paths; this is the one it recommends on this platform —
  // %APPDATA%, not ~/.config, which yt-dlp doesn't check here at all).
  getYtDlpConfigHint() {
    return '%APPDATA%\\yt-dlp\\config';
  }

  // A binary on PATH here needs .exe appended to actually find it
  // (findAllOnPath in diagnostics/runDiagnostics.js) — unlike macOS/Linux,
  // where a binary has no filename suffix at all.
  getExecutableExtension() {
    return '.exe';
  }

  // npm itself is a .cmd shim here, not a real .exe — spawning the bare
  // 'npm' name without shell:true throws ENOENT on Windows, a well-known
  // Node cross-platform gotcha (see scripts/setup.mjs's own use of this).
  // Not the same question getExecutableExtension() answers: that's .exe,
  // this is .cmd, so it needed its own method rather than reusing that one.
  getNpmCommand() {
    return 'npm.cmd';
  }

  // No stty here — a raw-mode child (mpv) leaving the terminal stuck is not
  // something playForeground.js's stty-based restoration can fix on this
  // platform, so it skips attempting it entirely.
  canRestoreTerminal() {
    return false;
  }

  // Unverified live (no Windows machine available in this project) — based
  // on tasklist's documented CSV output: one process per line, quoted image
  // name first, quoted PID second. IMAGENAME eq is an exact match on
  // Windows too, same contract as pgrep -x on macOS/Linux.
  findProcessPidsByExactName(name) {
    try {
      const output = execFileSync('tasklist', ['/FI', `IMAGENAME eq ${name}.exe`, '/NH', '/FO', 'CSV'], { encoding: 'utf8' });
      return output
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => Number(line.split(',')[1]?.replace(/"/g, '')))
        .filter((pid) => Number.isInteger(pid));
    } catch {
      return [];
    }
  }
}
