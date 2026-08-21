import path from 'node:path';
import { readJsonArray, writeJsonArrayAtomic } from './jsonStore.js';
import { assertValidToken } from './validateToken.js';

// Playlists: {name, songs:[{videoId, title}]} — cross-artist by construction,
// since entries are just pinned video references with no dependency on the
// artist/song alias tables at all. The name IS the invocable token (no
// separate alias list) — same single-word constraint as every other alias,
// since it has to be typeable as one token.
export class PlaylistRepository {
  constructor(configDir) {
    this.filePath = path.join(configDir, 'playlists.json');
    this.playlists = readJsonArray(this.filePath);
  }

  resolveToken(token) {
    const normalized = token.toLowerCase();
    const playlist = this.playlists.find((entry) => entry.name.toLowerCase() === normalized);
    return playlist ? { type: 'playlist', name: playlist.name } : null;
  }

  create(name, tokenRegistry) {
    assertValidToken(name);
    if (tokenRegistry.isTaken(name)) {
      throw new Error(`"${name}" is already in use — pick a different name or remove the existing one first`);
    }
    this.playlists.push({ name: name.toLowerCase(), songs: [], updatedAt: Date.now() });
    this._save();
  }

  rename(oldName, newName, tokenRegistry) {
    assertValidToken(newName);
    const playlist = this._find(oldName);
    if (oldName.toLowerCase() !== newName.toLowerCase() && tokenRegistry.isTaken(newName)) {
      throw new Error(`"${newName}" is already in use — pick a different name or remove the existing one first`);
    }
    playlist.name = newName.toLowerCase();
    playlist.updatedAt = Date.now();
    this._save();
  }

  addSong(name, entry, position) {
    const playlist = this._find(name);
    if (playlist.songs.some((song) => song.videoId === entry.videoId)) {
      throw new Error(`"${entry.title}" is already in this playlist`);
    }
    const index = position === undefined ? playlist.songs.length : position;
    playlist.songs.splice(index, 0, entry);
    playlist.updatedAt = Date.now();
    this._save();
  }

  replaceSong(name, index, entry) {
    const playlist = this._find(name);
    const duplicateIndex = playlist.songs.findIndex((song) => song.videoId === entry.videoId);
    if (duplicateIndex !== -1 && duplicateIndex !== index) {
      throw new Error(`"${entry.title}" is already in this playlist`);
    }
    playlist.songs[index] = entry;
    playlist.updatedAt = Date.now();
    this._save();
  }

  removeSong(name, index) {
    const playlist = this._find(name);
    playlist.songs.splice(index, 1);
    playlist.updatedAt = Date.now();
    this._save();
  }

  delete(name) {
    this.playlists = this.playlists.filter((entry) => entry.name !== name);
    this._save();
  }

  // Wipes every playlist, for the Settings "reset all data" action.
  clear() {
    this.playlists = [];
    this._save();
  }

  reorder(name, fromIndex, toIndex) {
    const playlist = this._find(name);
    if (toIndex < 0 || toIndex >= playlist.songs.length) return;
    const [moved] = playlist.songs.splice(fromIndex, 1);
    playlist.songs.splice(toIndex, 0, moved);
    playlist.updatedAt = Date.now();
    this._save();
  }

  all() {
    return this.playlists;
  }

  _find(name) {
    const playlist = this.playlists.find((entry) => entry.name === name);
    if (!playlist) throw new Error(`No playlist named "${name}"`);
    return playlist;
  }

  _save() {
    writeJsonArrayAtomic(this.filePath, this.playlists);
  }
}
