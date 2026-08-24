import fs from 'node:fs';

// Called once, at the very start of every run — the audio cache has no
// eviction, so without this it would only ever grow. Wiping it clean on
// every startup keeps it bounded to just what the current session actually
// plays, at the cost of never reusing a download across separate runs.
//
// This runs unconditionally, including ahead of hotkey commands aimed at an
// already-running background daemon that may still hold a cached file open
// (e.g. an in-progress preview). Deleting it is harmless there — an open
// file descriptor keeps working after its directory entry is removed — but
// on Windows the same delete can fail with the file still locked. Either
// way, routine housekeeping must never block an actual play/control command,
// so a failure here is swallowed rather than thrown.
export function clearCacheDir(platform) {
  try {
    fs.rmSync(platform.getCacheDir(), { recursive: true, force: true });
  } catch {
    // Best-effort — see comment above.
  }
}
