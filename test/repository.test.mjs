import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AliasRepository } from '../src/repository/aliasRepository.js';
import { PlaylistRepository } from '../src/repository/playlistRepository.js';
import { TokenRegistry } from '../src/repository/tokenRegistry.js';

function tempConfigDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-test-'));
}

test('many-to-one artist aliases resolve to the same canonical name', () => {
  const dir = tempConfigDir();
  const aliasRepo = new AliasRepository(dir);
  const playlistRepo = new PlaylistRepository(dir);
  const tokenRegistry = new TokenRegistry(aliasRepo, playlistRepo);

  aliasRepo.addArtistAlias(['ts', 'tswift'], 'Taylor Swift', tokenRegistry);

  assert.deepEqual(aliasRepo.resolveToken('ts'), { type: 'artist', value: 'Taylor Swift' });
  assert.deepEqual(aliasRepo.resolveToken('TSWIFT'), { type: 'artist', value: 'Taylor Swift' });
});

test('global token uniqueness rejects collisions across artist/song/playlist', () => {
  const dir = tempConfigDir();
  const aliasRepo = new AliasRepository(dir);
  const playlistRepo = new PlaylistRepository(dir);
  const tokenRegistry = new TokenRegistry(aliasRepo, playlistRepo);

  aliasRepo.addArtistAlias(['ts'], 'Taylor Swift', tokenRegistry);

  assert.throws(() => aliasRepo.addSongAlias('ts', 'xyz', 'Some Song', tokenRegistry), /already in use/);
  assert.throws(() => playlistRepo.create('ts', tokenRegistry), /already in use/);
});

test('describeTaken names the actual conflicting kind, not just "already in use"', () => {
  const dir = tempConfigDir();
  const aliasRepo = new AliasRepository(dir);
  const playlistRepo = new PlaylistRepository(dir);
  const tokenRegistry = new TokenRegistry(aliasRepo, playlistRepo);

  aliasRepo.addArtistAlias(['ts'], 'Taylor Swift', tokenRegistry);
  aliasRepo.addSongAlias('tt', 'abc123', 'Taylor Swift - 22', tokenRegistry);
  playlistRepo.create('dl', tokenRegistry);

  assert.equal(tokenRegistry.describeTaken('ts'), 'an artist alias');
  assert.equal(tokenRegistry.describeTaken('tt'), 'a song alias');
  assert.equal(tokenRegistry.describeTaken('dl'), 'a playlist name');
  assert.equal(tokenRegistry.describeTaken('unused'), null);
});

test('song aliases are self-contained — no live parent-artist join needed', () => {
  const dir = tempConfigDir();
  const aliasRepo = new AliasRepository(dir);
  const playlistRepo = new PlaylistRepository(dir);
  const tokenRegistry = new TokenRegistry(aliasRepo, playlistRepo);

  aliasRepo.addSongAlias('tt', 'abc123', 'Taylor Swift - 22', tokenRegistry);
  assert.deepEqual(aliasRepo.resolveToken('tt'), { type: 'song', videoId: 'abc123', title: 'Taylor Swift - 22' });
});

test('playlists support add, reorder, replace, and remove', () => {
  const dir = tempConfigDir();
  const playlistRepo = new PlaylistRepository(dir);
  const aliasRepo = new AliasRepository(dir);
  const tokenRegistry = new TokenRegistry(aliasRepo, playlistRepo);

  playlistRepo.create('focus', tokenRegistry);
  playlistRepo.addSong('focus', { videoId: 'a', title: 'Song A' });
  playlistRepo.addSong('focus', { videoId: 'b', title: 'Song B' });
  playlistRepo.reorder('focus', 0, 1);

  let playlist = playlistRepo.all().find((entry) => entry.name === 'focus');
  assert.deepEqual(playlist.songs.map((song) => song.videoId), ['b', 'a']);

  playlistRepo.replaceSong('focus', 0, { videoId: 'c', title: 'Song C' });
  playlist = playlistRepo.all().find((entry) => entry.name === 'focus');
  assert.deepEqual(playlist.songs.map((song) => song.videoId), ['c', 'a']);

  playlistRepo.removeSong('focus', 0);
  playlist = playlistRepo.all().find((entry) => entry.name === 'focus');
  assert.deepEqual(playlist.songs.map((song) => song.videoId), ['a']);
});

test('a playlist rejects adding the same video twice, by videoId', () => {
  const dir = tempConfigDir();
  const playlistRepo = new PlaylistRepository(dir);
  const aliasRepo = new AliasRepository(dir);
  const tokenRegistry = new TokenRegistry(aliasRepo, playlistRepo);

  playlistRepo.create('focus', tokenRegistry);
  playlistRepo.addSong('focus', { videoId: 'a', title: 'Song A' });

  assert.throws(() => playlistRepo.addSong('focus', { videoId: 'a', title: 'Song A (different title)' }), /already in this playlist/);

  const playlist = playlistRepo.all().find((entry) => entry.name === 'focus');
  assert.equal(playlist.songs.length, 1);
});

test('replaceSong rejects turning a slot into a duplicate of another song already in the playlist', () => {
  const dir = tempConfigDir();
  const playlistRepo = new PlaylistRepository(dir);
  const aliasRepo = new AliasRepository(dir);
  const tokenRegistry = new TokenRegistry(aliasRepo, playlistRepo);

  playlistRepo.create('focus', tokenRegistry);
  playlistRepo.addSong('focus', { videoId: 'a', title: 'Song A' });
  playlistRepo.addSong('focus', { videoId: 'b', title: 'Song B' });

  assert.throws(() => playlistRepo.replaceSong('focus', 1, { videoId: 'a', title: 'Song A' }), /already in this playlist/);

  // Replacing a slot with the exact same videoId it already holds is a
  // harmless no-op, not a duplicate — must not throw.
  playlistRepo.replaceSong('focus', 0, { videoId: 'a', title: 'Song A (renamed)' });
  const playlist = playlistRepo.all().find((entry) => entry.name === 'focus');
  assert.equal(playlist.songs[0].title, 'Song A (renamed)');
});

test('aliases containing spaces are rejected — they could never be typed as one token', () => {
  const dir = tempConfigDir();
  const aliasRepo = new AliasRepository(dir);
  const playlistRepo = new PlaylistRepository(dir);
  const tokenRegistry = new TokenRegistry(aliasRepo, playlistRepo);

  assert.throws(() => aliasRepo.addArtistAlias(['ts w'], 'Taylor Swift', tokenRegistry), /cannot contain spaces/);
  assert.throws(() => aliasRepo.addSongAlias('t t', 'abc123', 'Some Song', tokenRegistry), /cannot contain spaces/);
  assert.throws(() => aliasRepo.addArtistAlias([''], 'Taylor Swift', tokenRegistry), /cannot be empty/);
  assert.throws(() => playlistRepo.create('fo cus', tokenRegistry), /cannot contain spaces/);

  aliasRepo.addArtistAlias(['ts'], 'Taylor Swift', tokenRegistry);
  assert.throws(() => aliasRepo.renameToken('ts', 'tay lor', tokenRegistry), /cannot contain spaces/);

  playlistRepo.create('focus', tokenRegistry);
  assert.throws(() => playlistRepo.rename('focus', 'fo cus', tokenRegistry), /cannot contain spaces/);
});

test('aliases starting with "-" are rejected — that prefix is reserved for CLI flags', () => {
  const dir = tempConfigDir();
  const aliasRepo = new AliasRepository(dir);
  const playlistRepo = new PlaylistRepository(dir);
  const tokenRegistry = new TokenRegistry(aliasRepo, playlistRepo);

  assert.throws(() => aliasRepo.addArtistAlias(['-ts'], 'Taylor Swift', tokenRegistry), /cannot start with "-"/);
  assert.throws(() => aliasRepo.addSongAlias('-tt', 'abc123', 'Some Song', tokenRegistry), /cannot start with "-"/);
  assert.throws(() => playlistRepo.create('-focus', tokenRegistry), /cannot start with "-"/);
});

test('playlist name is its own alias — rename changes the invocable token, collisions rejected', () => {
  const dir = tempConfigDir();
  const playlistRepo = new PlaylistRepository(dir);
  const aliasRepo = new AliasRepository(dir);
  const tokenRegistry = new TokenRegistry(aliasRepo, playlistRepo);

  playlistRepo.create('focus', tokenRegistry);
  assert.deepEqual(playlistRepo.resolveToken('FOCUS'), { type: 'playlist', name: 'focus' });

  playlistRepo.create('chill', tokenRegistry);
  assert.throws(() => playlistRepo.rename('chill', 'focus', tokenRegistry), /already in use/);

  playlistRepo.rename('focus', 'focusmix', tokenRegistry);
  assert.equal(playlistRepo.resolveToken('focus'), null);
  assert.deepEqual(playlistRepo.resolveToken('focusmix'), { type: 'playlist', name: 'focusmix' });
});

test('alias entries are stamped with updatedAt on create, and it advances on every later touch', () => {
  const dir = tempConfigDir();
  const aliasRepo = new AliasRepository(dir);
  const playlistRepo = new PlaylistRepository(dir);
  const tokenRegistry = new TokenRegistry(aliasRepo, playlistRepo);

  aliasRepo.addArtistAlias(['ts'], 'Taylor Swift', tokenRegistry);
  aliasRepo.addSongAlias('tt', 'abc123', 'Taylor Swift - 22', tokenRegistry);
  const [artist] = aliasRepo.all().filter((alias) => alias.token === 'ts');
  const [song] = aliasRepo.all().filter((alias) => alias.token === 'tt');
  assert.equal(typeof artist.updatedAt, 'number');
  assert.equal(typeof song.updatedAt, 'number');

  const createdAt = song.updatedAt;
  aliasRepo.editSongAlias('tt', 'xyz789', 'A different song');
  const editedSong = aliasRepo.all().find((alias) => alias.token === 'tt');
  assert.ok(editedSong.updatedAt >= createdAt);

  const renamedAt = artist.updatedAt;
  aliasRepo.renameToken('ts', 'tsw', tokenRegistry);
  const renamed = aliasRepo.all().find((alias) => alias.token === 'tsw');
  assert.ok(renamed.updatedAt >= renamedAt);
});

test('playlists are stamped with updatedAt on create, and it advances on every later modification', () => {
  const dir = tempConfigDir();
  const playlistRepo = new PlaylistRepository(dir);
  const aliasRepo = new AliasRepository(dir);
  const tokenRegistry = new TokenRegistry(aliasRepo, playlistRepo);

  playlistRepo.create('focus', tokenRegistry);
  const created = playlistRepo.all().find((entry) => entry.name === 'focus');
  assert.equal(typeof created.updatedAt, 'number');

  const createdAt = created.updatedAt;
  playlistRepo.addSong('focus', { videoId: 'a', title: 'Song A' });
  const afterAdd = playlistRepo.all().find((entry) => entry.name === 'focus');
  assert.ok(afterAdd.updatedAt >= createdAt);
});

test('AliasRepository.clear wipes every alias and persists the empty state', () => {
  const dir = tempConfigDir();
  const aliasRepo = new AliasRepository(dir);
  const playlistRepo = new PlaylistRepository(dir);
  const tokenRegistry = new TokenRegistry(aliasRepo, playlistRepo);
  aliasRepo.addArtistAlias(['ts'], 'Taylor Swift', tokenRegistry);
  aliasRepo.addSongAlias('tt', 'abc123', 'Taylor Swift - 22', tokenRegistry);

  aliasRepo.clear();

  assert.deepEqual(aliasRepo.all(), []);
  assert.deepEqual(new AliasRepository(dir).all(), []);
});

test('PlaylistRepository.clear wipes every playlist and persists the empty state', () => {
  const dir = tempConfigDir();
  const playlistRepo = new PlaylistRepository(dir);
  const aliasRepo = new AliasRepository(dir);
  const tokenRegistry = new TokenRegistry(aliasRepo, playlistRepo);
  playlistRepo.create('focus', tokenRegistry);
  playlistRepo.addSong('focus', { videoId: 'a', title: 'Song A' });

  playlistRepo.clear();

  assert.deepEqual(playlistRepo.all(), []);
  assert.deepEqual(new PlaylistRepository(dir).all(), []);
});

test('storage persists across reload (JSON file, atomic write)', () => {
  const dir = tempConfigDir();
  const aliasRepo = new AliasRepository(dir);
  const playlistRepo = new PlaylistRepository(dir);
  const tokenRegistry = new TokenRegistry(aliasRepo, playlistRepo);
  aliasRepo.addArtistAlias(['ts'], 'Taylor Swift', tokenRegistry);

  const reloaded = new AliasRepository(dir);
  assert.deepEqual(reloaded.resolveToken('ts'), { type: 'artist', value: 'Taylor Swift' });
  assert.ok(fs.existsSync(path.join(dir, 'aliases.json')));
});
