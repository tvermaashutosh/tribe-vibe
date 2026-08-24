import path from 'node:path';
import { readJsonArray, writeJsonArrayAtomic } from './jsonStore.js';
import { assertValidToken } from './validateToken.js';

// Artist aliases: {token, type:'artist', value: canonicalName} — simple text,
// many-to-one (multiple tokens can share the same canonical value).
//
// Song aliases: {token, type:'song', videoId, title} — fully self-contained.
// Deliberately NOT nested under an artist: resolving a song alias must never
// require a live join back to a parent artist object, otherwise it isn't
// really deterministic (and it wouldn't handle collabs/compilations cleanly).
export class AliasRepository {
  constructor(configDir) {
    this.filePath = path.join(configDir, 'aliases.json');
    this.aliases = readJsonArray(this.filePath);
  }

  resolveToken(token) {
    const normalized = token.toLowerCase();
    const match = this.aliases.find((alias) => alias.token.toLowerCase() === normalized);
    if (!match) return null;
    return match.type === 'artist'
      ? { type: 'artist', value: match.value }
      : { type: 'song', videoId: match.videoId, title: match.title };
  }

  addArtistAlias(tokens, canonicalName, tokenRegistry) {
    this._assertAvailable(tokens, tokenRegistry);
    const updatedAt = Date.now();
    for (const token of tokens) {
      this.aliases.push({ token: token.toLowerCase(), type: 'artist', value: canonicalName, updatedAt });
    }
    this._save();
  }

  addSongAlias(token, videoId, title, tokenRegistry) {
    this._assertAvailable([token], tokenRegistry);
    this.aliases.push({ token: token.toLowerCase(), type: 'song', videoId, title, updatedAt: Date.now() });
    this._save();
  }

  editSongAlias(token, videoId, title) {
    const entry = this.aliases.find(
      (alias) => alias.type === 'song' && alias.token.toLowerCase() === token.toLowerCase(),
    );
    if (!entry) throw new Error(`No song alias named "${token}"`);
    entry.videoId = videoId;
    entry.title = title;
    entry.updatedAt = Date.now();
    this._save();
  }

  renameArtist(oldName, newName) {
    const updatedAt = Date.now();
    for (const alias of this.aliases) {
      if (alias.type === 'artist' && alias.value === oldName) {
        alias.value = newName;
        alias.updatedAt = updatedAt;
      }
    }
    this._save();
  }

  renameToken(oldToken, newToken, tokenRegistry) {
    assertValidToken(newToken);
    const entry = this.aliases.find((alias) => alias.token.toLowerCase() === oldToken.toLowerCase());
    if (!entry) throw new Error(`No alias named "${oldToken}"`);
    const takenAs = oldToken.toLowerCase() !== newToken.toLowerCase() ? tokenRegistry.describeTaken(newToken) : null;
    if (takenAs) {
      throw new Error(`"${newToken}" is already taken as ${takenAs} — pick a different alias or remove the existing one first`);
    }
    entry.token = newToken.toLowerCase();
    entry.updatedAt = Date.now();
    this._save();
  }

  removeAlias(token) {
    this.aliases = this.aliases.filter((alias) => alias.token.toLowerCase() !== token.toLowerCase());
    this._save();
  }

  // Wipes every artist/song alias, for the Settings "reset all data" action.
  clear() {
    this.aliases = [];
    this._save();
  }

  all() {
    return this.aliases;
  }

  _assertAvailable(tokens, tokenRegistry) {
    for (const token of tokens) {
      assertValidToken(token);
      const takenAs = tokenRegistry.describeTaken(token);
      if (takenAs) {
        throw new Error(`"${token}" is already taken as ${takenAs} — pick a different alias or remove the existing one first`);
      }
    }
  }

  _save() {
    writeJsonArrayAtomic(this.filePath, this.aliases);
  }
}
