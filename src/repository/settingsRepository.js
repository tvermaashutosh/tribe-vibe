import path from 'node:path';
import fs from 'node:fs';
import { DEFAULT_SETTINGS } from '../constants.js';
import { writeJsonAtomic } from './jsonStore.js';

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

  // Mutates this.settings in place rather than reassigning it — cli.js
  // hands the same object out once, by reference, as ctx.settings, and
  // every screen (Play.jsx, Aliases.jsx, Playlists.jsx, ...) holds onto
  // that same reference. Reassigning here would leave every one of them
  // reading a stale object unless the caller separately re-patched it by
  // hand after every save() — which used to be true, and easy to forget.
  // save() is always handed a complete settings object (never a partial
  // patch), so a plain Object.assign is enough to keep the two in sync.
  save(next) {
    Object.assign(this.settings, next);
    writeJsonAtomic(this.filePath, this.settings);
  }
}
