import fs from 'node:fs';

// Called once, by whichever process wins the session lock in cli.js — the
// audio cache has no eviction, so without this it would only ever grow.
// Wiping it clean there keeps it bounded to just what's actually in use, at
// the cost of never reusing a download across separate sessions.
//
// Gated behind that lock deliberately: firing this while ANOTHER tv process
// still has an in-progress playlist download, or is still playing back what
// it already downloaded, deletes files out from under it (confirmed by
// reproducing exactly that: files saved before the wipe vanish, files saved
// after it survive — precisely the "some songs fail to open" symptom this
// fix resolves). A hotkey control command never contends for the lock at
// all, since it never downloads anything itself.
//
// A failure here is still swallowed rather than thrown — e.g. a locked file
// on Windows — since routine housekeeping must never block an actual play.
export function clearCacheDir(platform) {
  try {
    fs.rmSync(platform.getCacheDir(), { recursive: true, force: true });
  } catch {
    // Best-effort — see comment above.
  }
}
