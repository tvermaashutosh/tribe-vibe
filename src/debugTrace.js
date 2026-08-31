import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// On by default — set TRIBE_VIBE_TRACE=0 to opt out. Traces the full
// lifecycle of a play (download -> foreground mpv -> terminal restore ->
// exit) and the background daemon's own IPC — exactly the chain that's
// hardest to reason about after the fact, since mpv and Ink both take over
// stdio/raw-mode at different points, leaving nothing in a normal terminal
// to look back at once something goes wrong. Written to a file, not
// stdout, for the same reason: stdout/stdin are exactly what's suspected
// of being in a broken state when this matters most. Every call site
// prefixes its own message with "functionName: ..." for easy grep.
export const LOG_PATH = path.join(os.tmpdir(), 'tribe-vibe-debug.log');

// Truncated once per process, on this run's first trace() call — never left
// to grow across runs forever, since tracing is on by default now for every
// invocation, not just a deliberate one-off debug session. Every trace()
// call within that same run still appends normally after that, which is
// what actually captures a whole lifecycle (a single play needs several
// lines, not one) — only the boundary between one run and the next resets.
let truncatedThisRun = false;

export function trace(msg) {
  if (process.env.TRIBE_VIBE_TRACE === '0') return;
  try {
    if (!truncatedThisRun) {
      fs.writeFileSync(LOG_PATH, '');
      truncatedThisRun = true;
    }
    fs.appendFileSync(LOG_PATH, `${new Date().toISOString()} ${msg}\n`);
  } catch {
    // best-effort only
  }
}
