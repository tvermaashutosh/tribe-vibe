import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Picker from './Picker.jsx';
import SkipList from './SkipList.jsx';
import StatusText from './StatusText.jsx';
import { resolveTypedInput } from '../pipeline/index.js';
import { playSongForeground } from '../player/directPlay.js';
import { handOffToForeground } from './handOffToForeground.js';
import { DIVIDER_ITEM } from './divider.js';
import { buildAliasListItems } from './aliasListItems.js';
import { theme } from './theme.js';

const SCREEN_LABEL = { song: 'Songs', artist: 'Artists' };

// One screen, reused for both the Songs and Artists menu entries — `type`
// ('song' or 'artist') is the only thing that changes: which slice of
// AliasRepository's flat alias list this screen manages, and the handful of
// genuinely type-specific flows (a song can be Played or Replaced via a
// Picker preview; an artist is added as a name plus a comma-separated token
// list, never a picker, and has no Play option — picking one is an
// ambiguous search, not a one-click play). Splitting the underlying storage
// was never on the table — same AliasRepository, same aliases.json, just
// two focused views onto it instead of one screen mixing both together.
export default function AliasScreen({ ctx, type, onBack }) {
  const [mode, setMode] = useState('list');
  const [selectedToken, setSelectedToken] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [aliasInput, setAliasInput] = useState('');
  const [pendingSong, setPendingSong] = useState(null);
  const [songQuery, setSongQuery] = useState('');
  const [pickerQuery, setPickerQuery] = useState('');
  // Only ever a validation message here (bad/duplicate token) — never a
  // success or a genuine system error, so it's always shown as a warning.
  // Every pure-navigation handler clears it first so it never lingers onto a
  // screen it wasn't meant for; a handler that's about to show a fresh one
  // just sets it again afterward in the same call, so nothing flickers.
  const [error, setError] = useState(null);

  const aliases = ctx.aliasRepo.all().filter((alias) => alias.type === type);
  const selectedEntry = aliases.find((alias) => alias.token === selectedToken);

  useInput(
    (input, key) => {
      if (!key.escape) return;
      setError(null);
      if (mode === 'list') return onBack();
      if (mode === 'rename' || mode === 'artistAliases') return setMode(mode === 'rename' ? 'detail' : 'artistName');
      return setMode('list');
    },
    { isActive: mode !== 'replace' && mode !== 'songSearch' },
  );

  if (mode === 'list') {
    // "+ New ..." sits above the list, but isn't where the screen opens —
    // skipDefault (see skipListNav.js) leaves it fully reachable by arrow
    // keys while SkipList's own default landing spot falls through to the
    // first real song/artist alias instead, same as it always used to.
    const items = [
      { label: type === 'song' ? '+ New song alias' : '+ New artist alias', value: '__add__', skipDefault: true },
      ...(aliases.length > 0 ? [DIVIDER_ITEM] : []),
      ...buildAliasListItems(aliases),
    ];
    return (
      <Box flexDirection="column">
        <Text bold color={theme.secondary}>{SCREEN_LABEL[type]}</Text>
        <SkipList
          items={items}
          onHighlight={() => setError(null)}
          onSelect={(item) => {
            setError(null);
            if (item.value === '__add__') return setMode(type === 'song' ? 'songSearchInput' : 'artistName');
            setSelectedToken(item.value);
            return setMode('detail');
          }}
        />
        <StatusText message={error} />
      </Box>
    );
  }

  if (mode === 'detail') {
    // A song alias is fully deterministic — playing it needs no picker, no
    // ambiguous search, nothing — so it's the very first option here,
    // exactly like Play view's own browse list would play it. An artist
    // alias has no such option: it's an ambiguous search by definition.
    const items = [
      ...(type === 'song' ? [{ label: '▶ Play', value: 'play' }] : []),
      { label: '⟳ Rename alias', value: 'rename' },
      ...(type === 'song' ? [{ label: '⟳ Replace (listen & re-pick)', value: 'replace' }] : []),
      { label: '- Delete alias', value: 'delete' },
    ];
    return (
      <Box flexDirection="column">
        <Text bold color={theme.secondary}>{selectedEntry.token}</Text>
        <Text color={theme.dim}>{type === 'artist' ? selectedEntry.value : selectedEntry.title}</Text>
        <SelectInput
          items={items}
          onHighlight={() => setError(null)}
          onSelect={(item) => {
            setError(null);
            if (item.value === 'play') {
              return handOffToForeground(ctx, () =>
                playSongForeground({
                  resolver: ctx.resolver,
                  platform: ctx.platform,
                  videoId: selectedEntry.videoId,
                  title: selectedEntry.title,
                  onReady: (localFile) => console.log(`Playing: ${localFile}`),
                }),
              );
            }
            if (item.value === 'delete') {
              ctx.aliasRepo.removeAlias(selectedEntry.token);
              return setMode('list');
            }
            if (item.value === 'rename') {
              setNameInput(selectedEntry.token);
              return setMode('rename');
            }
            return setMode('replace');
          }}
        />
        <StatusText message={error} />
      </Box>
    );
  }

  if (mode === 'rename') {
    return (
      <Box flexDirection="column">
        <Text>New token for "{selectedEntry.token}":</Text>
        <TextInput
          value={nameInput}
          onChange={setNameInput}
          onSubmit={() => {
            try {
              ctx.aliasRepo.renameToken(selectedEntry.token, nameInput.trim(), ctx.tokenRegistry);
              setSelectedToken(nameInput.trim().toLowerCase());
              setError(null);
            } catch (err) {
              setError(err.message);
            }
            setMode('detail');
          }}
        />
      </Box>
    );
  }

  if (mode === 'replace') {
    return (
      <Picker
        top={ctx.settings.top}
        resolver={ctx.resolver}
        player={ctx.player}
        onConfirm={(candidate) => {
          setError(null);
          ctx.aliasRepo.editSongAlias(selectedEntry.token, candidate.videoId, candidate.title);
          setMode('detail');
        }}
        onCancel={() => {
          setError(null);
          setMode('detail');
        }}
      />
    );
  }

  if (mode === 'artistName') {
    return (
      <Box flexDirection="column">
        <Text>Artist name:</Text>
        <TextInput value={nameInput} onChange={setNameInput} onSubmit={() => setMode('artistAliases')} />
      </Box>
    );
  }

  if (mode === 'artistAliases') {
    return (
      <Box flexDirection="column">
        <Text>Aliases for "{nameInput}" (comma-separated):</Text>
        <TextInput
          value={aliasInput}
          onChange={setAliasInput}
          onSubmit={() => {
            const tokens = aliasInput
              .split(',')
              .map((token) => token.trim())
              .filter(Boolean);
            try {
              ctx.aliasRepo.addArtistAlias(tokens, nameInput, ctx.tokenRegistry);
              setError(null);
            } catch (err) {
              setError(err.message);
            }
            setNameInput('');
            setAliasInput('');
            setMode('list');
          }}
        />
      </Box>
    );
  }

  // The exact same single search box Play and playlist add/replace use — an
  // artist alias, a song alias, both, plain free text, or -q/-query for a
  // literal bypass all work identically. A deterministic song-alias match
  // skips the picker entirely (it's already pinned, just needs a new
  // token); anything else hands the resolved query to the picker pre-filled
  // — so typing an artist alias here searches that artist's canonical name,
  // not the raw token.
  if (mode === 'songSearchInput') {
    return (
      <Box flexDirection="column">
        <Text>Search for a song to alias:</Text>
        <Text color={theme.dim}>Same grammar as Play — artist alias, song alias, both, or free text.</Text>
        <TextInput
          value={songQuery}
          onChange={(value) => {
            setError(null);
            setSongQuery(value);
          }}
          onSubmit={() => {
            const intent = resolveTypedInput(songQuery, { aliasRepo: ctx.aliasRepo, playlistRepo: ctx.playlistRepo });
            setSongQuery('');
            setError(null);

            if (intent.kind === 'empty') {
              setError('Nothing to search for.');
              return;
            }

            if (intent.kind === 'playlist') {
              setError(`"${songQuery.trim()}" resolves to a playlist, not a song.`);
              return;
            }

            if (intent.kind === 'song') {
              setPendingSong({ videoId: intent.videoId, title: intent.title });
              setMode('songToken');
              return;
            }

            setPickerQuery(intent.query);
            setMode('songSearch');
          }}
        />
        <StatusText message={error} />
      </Box>
    );
  }

  if (mode === 'songSearch') {
    return (
      <Picker
        initialQuery={pickerQuery}
        top={ctx.settings.top}
        resolver={ctx.resolver}
        player={ctx.player}
        onConfirm={(candidate) => {
          setError(null);
          setPendingSong(candidate);
          setMode('songToken');
        }}
        onCancel={() => {
          setError(null);
          setMode('list');
        }}
      />
    );
  }

  if (mode === 'songToken') {
    return (
      <Box flexDirection="column">
        <Text>Alias for "{pendingSong.title}":</Text>
        <TextInput
          value={aliasInput}
          onChange={setAliasInput}
          onSubmit={() => {
            try {
              ctx.aliasRepo.addSongAlias(aliasInput.trim(), pendingSong.videoId, pendingSong.title, ctx.tokenRegistry);
              setError(null);
            } catch (err) {
              setError(err.message);
            }
            setAliasInput('');
            setMode('list');
          }}
        />
      </Box>
    );
  }

  return null;
}
