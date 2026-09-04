import { releaseSessionLock } from '../repository/sessionLock.js';

// process.exit() terminates the process immediately — it never lets cli.js's
// own try { ... } finally { releaseSessionLock(platform) } run, since the
// launchMenu() promise this short-circuits never gets a chance to
// resolve/unwind. Every UI-driven exit (Escape at the main menu, or handing
// off to a foreground play) needs its own explicit release instead, or the
// session lock leaks for up to STALE_AFTER_MS (10 minutes) before it
// self-heals.
export function exitCleanly(platform, code = 0) {
  releaseSessionLock(platform);
  process.exit(code);
}
