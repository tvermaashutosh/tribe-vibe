import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveIntent, resolveTypedInput } from '../src/pipeline/index.js';

function fakeAliasRepo(entries) {
  return {
    resolveToken(token) {
      const match = entries.find((entry) => entry.token.toLowerCase() === token.toLowerCase());
      if (!match) return null;
      return match.type === 'artist'
        ? { type: 'artist', value: match.value }
        : { type: 'song', videoId: match.videoId, title: match.title };
    },
  };
}

function fakePlaylistRepo(playlists = []) {
  return {
    resolveToken(token) {
      const match = playlists.find((playlist) => playlist.name.toLowerCase() === token.toLowerCase());
      return match ? { type: 'playlist', name: match.name } : null;
    },
  };
}

test('order of typed tokens never matters', () => {
  const aliasRepo = fakeAliasRepo([
    { token: 'tsw', type: 'artist', value: 'Taylor Swift' },
    { token: 'tt', type: 'song', videoId: 'abc123', title: 'Taylor Swift - 22' },
  ]);
  const playlistRepo = fakePlaylistRepo();

  const a = resolveIntent(['tsw', 'tt', '-loop'], { aliasRepo, playlistRepo });
  const b = resolveIntent(['-loop', 'tt', 'tsw'], { aliasRepo, playlistRepo });
  const c = resolveIntent(['TT', '-LOOP', 'TSW'], { aliasRepo, playlistRepo });

  for (const intent of [a, b, c]) {
    assert.equal(intent.kind, 'song');
    assert.equal(intent.deterministic, true);
    assert.equal(intent.videoId, 'abc123');
    assert.equal(intent.modifiers.loop, true);
  }
});

test('whitespace around = is tolerated', () => {
  const aliasRepo = fakeAliasRepo([]);
  const playlistRepo = fakePlaylistRepo();
  const intent = resolveIntent(['some', 'song', '-loop', '=', '10'], { aliasRepo, playlistRepo });
  assert.equal(intent.modifiers.loop, '10');
});

test('nothing is reserved except aliases/playlists — a bare "loop" (no dash) is just free text', () => {
  const aliasRepo = fakeAliasRepo([]);
  const playlistRepo = fakePlaylistRepo();
  const intent = resolveIntent(['some', 'song', 'loop', '=', '10'], { aliasRepo, playlistRepo });
  assert.equal(intent.kind, 'search');
  assert.equal(intent.query, 'some song loop=10');
  assert.equal(intent.modifiers.loop, undefined);
});

test('bare numbers fall into free text, never a positional flag value', () => {
  const aliasRepo = fakeAliasRepo([{ token: 'tsw', type: 'artist', value: 'Taylor Swift' }]);
  const playlistRepo = fakePlaylistRepo();
  const intent = resolveIntent(['tsw', '22'], { aliasRepo, playlistRepo });
  assert.equal(intent.kind, 'search');
  assert.equal(intent.query, 'Taylor Swift 22');
});

test('conflicting artist and song alias: the song wins and a note is attached', () => {
  const aliasRepo = fakeAliasRepo([
    { token: 'kanye', type: 'artist', value: 'Kanye West' },
    { token: 'tt', type: 'song', videoId: 'abc123', title: 'Taylor Swift - 22' },
  ]);
  const playlistRepo = fakePlaylistRepo();
  const intent = resolveIntent(['kanye', 'tt'], { aliasRepo, playlistRepo });
  assert.equal(intent.videoId, 'abc123');
  assert.match(intent.note, /ignoring "kanye"/);
});

test('playlist alias is deterministic and takes priority', () => {
  const aliasRepo = fakeAliasRepo([{ token: 'tsw', type: 'artist', value: 'Taylor Swift' }]);
  const playlistRepo = fakePlaylistRepo([{ name: 'focus' }]);
  const intent = resolveIntent(['focus'], { aliasRepo, playlistRepo });
  assert.equal(intent.kind, 'playlist');
  assert.equal(intent.playlistName, 'focus');
});

test('artist alias alone (no song, no free text) falls back to an ambiguous search', () => {
  const aliasRepo = fakeAliasRepo([{ token: 'tsw', type: 'artist', value: 'Taylor Swift' }]);
  const playlistRepo = fakePlaylistRepo();
  const intent = resolveIntent(['tsw'], { aliasRepo, playlistRepo });
  assert.equal(intent.kind, 'search');
  assert.equal(intent.deterministic, false);
  assert.equal(intent.query, 'Taylor Swift');
});

test('no tokens at all resolves to empty', () => {
  const aliasRepo = fakeAliasRepo([]);
  const playlistRepo = fakePlaylistRepo();
  const intent = resolveIntent([], { aliasRepo, playlistRepo });
  assert.equal(intent.kind, 'empty');
});

test('resolveTypedInput: -q/-query bypasses the classifier entirely for a literal search string', () => {
  const aliasRepo = fakeAliasRepo([{ token: 'tsw', type: 'artist', value: 'Taylor Swift' }]);
  const playlistRepo = fakePlaylistRepo();

  const a = resolveTypedInput('-q tsw literally not an alias', { aliasRepo, playlistRepo });
  assert.equal(a.kind, 'search');
  assert.equal(a.query, 'tsw literally not an alias');

  const b = resolveTypedInput('-query tsw literally not an alias', { aliasRepo, playlistRepo });
  assert.equal(b.kind, 'search');
  assert.equal(b.query, 'tsw literally not an alias');

  // Case-insensitive, same as every other flag in this grammar.
  const c = resolveTypedInput('-Q tsw', { aliasRepo, playlistRepo });
  assert.equal(c.kind, 'search');
  assert.equal(c.query, 'tsw');
});

test('resolveTypedInput: without -q, behaves exactly like resolveIntent (alias-aware)', () => {
  const aliasRepo = fakeAliasRepo([{ token: 'tsw', type: 'artist', value: 'Taylor Swift' }, { token: 'tt', type: 'song', videoId: 'abc123', title: 'Taylor Swift - 22' }]);
  const playlistRepo = fakePlaylistRepo();

  const intent = resolveTypedInput('tsw tt', { aliasRepo, playlistRepo });
  assert.equal(intent.kind, 'song');
  assert.equal(intent.videoId, 'abc123');
});

test('resolveTypedInput: -q with nothing after it, or empty input, resolves to empty', () => {
  const aliasRepo = fakeAliasRepo([]);
  const playlistRepo = fakePlaylistRepo();

  assert.equal(resolveTypedInput('-q', { aliasRepo, playlistRepo }).kind, 'empty');
  assert.equal(resolveTypedInput('', { aliasRepo, playlistRepo }).kind, 'empty');
  assert.equal(resolveTypedInput('   ', { aliasRepo, playlistRepo }).kind, 'empty');
});
