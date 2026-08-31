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

export function trace(msg) {
  if (process.env.TRIBE_VIBE_TRACE === '0') return;
  try {
    fs.appendFileSync(LOG_PATH, `${new Date().toISOString()} ${msg}\n`);
  } catch {
    // best-effort only
  }
}

// Bug this fixes: every tv invocation is its own OS process (a play, -pause,
// -kill, ...), all sharing this one LOG_PATH file. An earlier version
// truncated on each process's own first trace() call — but a hotkey fired
// while a play is still running (the documented, everyday way hotkeys are
// meant to be used) is a SEPARATE process, so its first trace() call wiped
// out everything the still-running play had already written. Called
// exactly once, only by cli.js, only when holdsSessionLock is true — the
// same primitive clearCacheDir already gates on for exactly this "is this
// genuinely a new session" question, and control-flag commands never
// acquire it in the first place. A second play process that loses the
// lock race never calls this either, so it never stomps on the winner's
// still-in-progress log.
export function truncateTraceLogForNewSession() {
  if (process.env.TRIBE_VIBE_TRACE === '0') return;
  try {
    fs.writeFileSync(LOG_PATH, '');
  } catch {
    // best-effort only
  }
}
