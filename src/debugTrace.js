import fs from 'node:fs';

// TEMPORARY — tracing the mpv-exit -> terminal-restore -> process-exit chain
// to pin down a hard-to-reproduce hang. Writes to a file, not stdout, since
// stdout/stdin are exactly what's suspected of being in a broken state when
// this matters. Remove once the root cause is found.
const LOG_PATH = '/tmp/tribe-vibe-debug.log';

export function trace(msg) {
  try {
    fs.appendFileSync(LOG_PATH, `${new Date().toISOString()} ${msg}\n`);
  } catch {
    // best-effort only
  }
}
