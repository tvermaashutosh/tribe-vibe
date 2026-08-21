import os from 'node:os';
import path from 'node:path';

export class WindowsPlatform {
  getMpvSocketPath() {
    // mpv speaks its JSON IPC protocol over a named pipe on Windows — Node's
    // net.connect accepts this path the same way it accepts a Unix socket path.
    return '\\\\.\\pipe\\tribevibe';
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
}
