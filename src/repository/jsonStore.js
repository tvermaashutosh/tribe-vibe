import fs from 'node:fs';
import path from 'node:path';

export function readJsonArray(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) return [];
  return JSON.parse(raw);
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
