import fs from 'node:fs';

// Called once, at the start of every real play session (the interactive
// menu, or a direct typed play) — the audio cache has no eviction, so
// without this it would only ever grow. Wiping it clean there keeps it
// bounded to just what the current session actually plays, at the cost of
// never reusing a download across separate sessions.
//
// Deliberately NOT called for a hotkey control command (see cli.js) — those
// never download anything themselves, and firing this while a SEPARATE tv
// process's foreground playlist is still mid-download would delete a file
// that process already saved but hasn't handed to mpv yet (confirmed by
// reproducing exactly that: songs downloaded before the wipe vanish, songs
// downloaded after it survive — precisely the "some songs fail to open"
// symptom this fix resolves).
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
