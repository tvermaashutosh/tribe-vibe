import fs from 'node:fs';
import { DEFAULT_SETTINGS } from '../constants.js';

// Wipes every piece of persisted state tribe-vibe itself owns: aliases,
// playlists, settings (back to defaults), and the downloaded-audio cache.
// Deliberately never touches platform.getDownloadsDir() — that's the user's
// own OS Downloads folder, borrowed only as an export destination, not
// storage tribe-vibe owns; wiping it would delete files that have nothing to
// do with this app.
export function resetAllData({ aliasRepo, playlistRepo, settings, saveSettings, platform }) {
  aliasRepo.clear();
  playlistRepo.clear();

  const defaults = { ...DEFAULT_SETTINGS };
  saveSettings(defaults);
  Object.assign(settings, defaults);

  fs.rmSync(platform.getCacheDir(), { recursive: true, force: true });
}
