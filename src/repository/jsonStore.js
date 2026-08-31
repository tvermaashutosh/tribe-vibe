import fs from 'node:fs';
import path from 'node:path';

// A truncated/corrupted file (a partial disk write, a crash mid-save
// despite the atomic-rename hygiene below, a manual edit gone wrong) used to
// throw uncaught here, crashing every single tv invocation — even tv -pause
// — since AliasRepository/PlaylistRepository are constructed unconditionally
// at the top of runSession(). Falls back to empty, matching how
// SettingsRepository._load() already self-heals from the same kind of
// corruption instead of taking the whole app down over one bad file.
export function readJsonArray(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Write to a temp file then rename over the real one — protects against a
// half-written, corrupted config file if the process dies mid-save. Still
// zero DB complexity, just one bit of hygiene worth having.
export function writeJsonArrayAtomic(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, filePath);
}
