import { spawn } from 'node:child_process';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { MPV_BINARY } from '../constants.js';

// Singleton/Supervisor: exactly one mpv daemon per session. Checks whether
// the IPC socket is already alive before spawning — never risks two
// competing mpv processes fighting over the same output device.
export class MpvDaemonSupervisor {
  constructor(platform) {
    this.platform = platform;
  }

  // Public alias so diagnostics can check reachability without duplicating
  // the socket-probe logic below.
  isRunning() {
    return this._isSocketAlive();
  }

  async ensureRunning() {
    if (await this._isSocketAlive()) return;
    this._spawn();
    // mpv's first cold start (loading libplacebo/ffmpeg) can take a few
    // seconds — 3s was too tight and produced a false "not installed" error
    // on an otherwise-working install. 10s covers a cold start comfortably.
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await this._isSocketAlive()) return;
      await delay(100);
    }
    throw new Error(
      `mpv daemon did not become reachable — is mpv installed? Try: ${this.platform.getInstallInstructions()}`,
    );
  }

  _isSocketAlive() {
    return new Promise((resolve) => {
      const probe = net.createConnection(this.platform.getMpvSocketPath());
      probe.once('connect', () => {
        probe.end();
        resolve(true);
      });
      probe.once('error', () => resolve(false));
    });
  }

  // Volume is left at mpv's own default — controlled entirely through mpv
  // itself (its own config, or runtime volume keys during foreground play),
  // not something tribe-vibe sets on its behalf.
  _spawn() {
    const args = ['--idle=yes', '--no-video', `--input-ipc-server=${this.platform.getMpvSocketPath()}`];
    const child = spawn(MPV_BINARY, args, { detached: true, stdio: 'ignore' });
    // Without this, a missing `mpv` binary throws an unhandled 'error' event
    // and crashes the whole process instead of letting ensureRunning()'s
    // poll-then-timeout produce the friendly "is mpv installed?" message.
    child.once('error', () => {});
    child.unref();
  }
}
