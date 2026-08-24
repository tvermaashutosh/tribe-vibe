import fs from 'node:fs';
import path from 'node:path';

// Generous even for a long playlist's sequential download — this only
// exists to self-heal after a crash that never released the lock; it should
// almost never actually trigger during normal use.
const STALE_AFTER_MS = 10 * 60 * 1000;

function lockPath(platform) {
  return path.join(platform.getConfigDir(), '.session-lock');
}

// A real, race-free lock — mkdirSync is atomic, so two processes racing to
// create the same directory can never both "win" it, unlike a check-then-act
// pattern. Used only to decide whether it's safe to wipe the audio cache:
// wiping while ANOTHER tv process still has an in-progress playlist download,
// or hasn't yet finished playing what it already downloaded, deletes files
// out from under it (confirmed by reproducing exactly that data loss with
// the real playPlaylistForeground + clearCacheDir). Returns true if this
// process won the lock, false if another one already holds it — never
// throws, since a lock this app owns should never block the app itself from
// running.
export function acquireSessionLock(platform) {
  const dir = lockPath(platform);
  try {
    fs.mkdirSync(dir);
    return true;
  } catch (err) {
    if (err.code !== 'EEXIST') return true;
  }
  try {
    const age = Date.now() - fs.statSync(dir).mtimeMs;
    if (age < STALE_AFTER_MS) return false;
    // Whatever held this crashed without releasing it — treat it as
    // abandoned rather than wedging the cache wipe off forever.
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir);
    return true;
  } catch {
    return false;
  }
}

export function releaseSessionLock(platform) {
  try {
    fs.rmSync(lockPath(platform), { recursive: true, force: true });
  } catch {
    // Best-effort — a stale lock still self-heals via STALE_AFTER_MS.
  }
}
