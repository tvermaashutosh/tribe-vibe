import path from 'node:path';
import fs from 'node:fs';
import { DEFAULT_SETTINGS } from '../constants.js';

// Settings live inside the Ink app only (Settings screen) — there is no typed
// CLI syntax for these, by design (see the typed-CLI-vs-Ink-only scope split).
export class SettingsRepository {
  constructor(configDir) {
    this.filePath = path.join(configDir, 'settings.json');
    this.settings = this._load();
  }

  _load() {
    if (!fs.existsSync(this.filePath)) return { ...DEFAULT_SETTINGS };
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(this.filePath, 'utf8')) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  all() {
    return this.settings;
  }

  save(next) {
    this.settings = next;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp-${process.pid}`;
    fs.writeFileSync(tmpPath, JSON.stringify(this.settings, null, 2));
    fs.renameSync(tmpPath, this.filePath);
  }
}
