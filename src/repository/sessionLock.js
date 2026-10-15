import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// A stale timestamp alone must never let a second process steal a lock from a
// live (possibly long playlist) session. Heartbeats keep normal sessions
// fresh; the PID check below is the final guard if a process is suspended.
const STALE_AFTER_MS = 10 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 30 * 1000;
const OWNER_FILE = 'owner.json';

function lockPath(platform) {
  return path.join(platform.getConfigDir(), '.session-lock');
}

function readOwner(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, OWNER_FILE), 'utf8'));
  } catch {
    return null;
  }
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

function isStale(dir) {
  try {
    if (Date.now() - fs.statSync(dir).mtimeMs < STALE_AFTER_MS) return false;
  } catch {
    return false;
  }

  const owner = readOwner(dir);
  // Older versions only created the directory, so an aged lock without
  // readable owner metadata is reclaimable. A known live PID is not.
  return !owner || !isProcessAlive(owner.pid);
}

function createLease(dir, token) {
  let released = false;
  let transferred = false;

  const stopHeartbeat = () => clearInterval(heartbeat);
  const heartbeat = setInterval(() => {
    const owner = readOwner(dir);
    if (!owner || owner.token !== token) {
      stopHeartbeat();
      return;
    }
    const now = new Date();
    try {
      fs.utimesSync(dir, now, now);
    } catch {
      // Best-effort; release and stale-lock recovery remain safe without it.
    }
  }, HEARTBEAT_INTERVAL_MS);
  heartbeat.unref();

  return {
    path: dir,
    get transferred() {
      return transferred;
    },
    transfer() {
      transferred = true;
    },
    release() {
      if (released) return false;
      released = true;
      stopHeartbeat();

      const owner = readOwner(dir);
      if (!owner || owner.token !== token) return false;
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        return true;
      } catch {
        return false;
      }
    },
  };
}

function createLock(dir) {
  fs.mkdirSync(dir);
  const token = randomUUID();
  try {
    fs.writeFileSync(path.join(dir, OWNER_FILE), JSON.stringify({ pid: process.pid, token }), { flag: 'wx' });
  } catch (err) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw err;
  }
  return createLease(dir, token);
}

function replaceStaleLock(dir) {
  // Rename is atomic: only one contender can move this exact stale directory.
  // Removing the quarantined directory cannot delete a new owner's lock.
  const quarantine = `${dir}.stale-${randomUUID()}`;
  try {
    fs.renameSync(dir, quarantine);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    return false;
  }

  try {
    fs.rmSync(quarantine, { recursive: true, force: true });
    return createLock(dir);
  } catch {
    return false;
  }
}

// Atomically creates a lease used to gate cache cleanup. Returns false when a
// different live session owns the cache. The lease is required to release
// the lock, so a non-owner can never remove another process's protection.
export function acquireSessionLock(platform) {
  const dir = lockPath(platform);
  try {
    fs.mkdirSync(path.dirname(dir), { recursive: true });
  } catch {
    return false;
  }

  try {
    return createLock(dir);
  } catch (err) {
    if (err.code !== 'EEXIST' || !isStale(dir)) return false;
  }

  const reclaimed = replaceStaleLock(dir);
  if (reclaimed) return reclaimed;
  // Another contender may have moved the stale directory between our stat
  // and rename. Retry once against the now-empty path; mkdir remains atomic.
  if (reclaimed === null) {
    try {
      return createLock(dir);
    } catch {
      return false;
    }
  }
  return false;
}

export function releaseSessionLock(platform, lease) {
  if (!lease || lease.path !== lockPath(platform)) return false;
  return lease.release();
}
