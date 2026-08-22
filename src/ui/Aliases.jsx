import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Picker from './Picker.jsx';
import SkipList from './SkipList.jsx';
import { DIVIDER_ITEM } from './divider.js';
import { sortByRecency } from './sortByRecency.js';
import { fitLine, truncateToWidth, getTerminalWidth, SELECTION_INDICATOR_WIDTH } from '../text/truncateToWidth.js';
import { theme } from './theme.js';

// One screen for everything alias-related: the flat list of every existing
// artist/song alias (rename/replace/delete), plus creating new ones. Adding
// another alias for an artist that already exists isn't a separate feature —
// typing the same canonical name again just adds one more token pointing at
// it, since AliasRepository doesn't distinguish the two.
export default function Aliases({ ctx, onBack }) {
  const [mode, setMode] = useState('list');
  const [selectedToken, setSelectedToken] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [aliasInput, setAliasInput] = useState('');
  const [pendingSong, setPendingSong] = useState(null);
  // Only ever a validation message here (bad/duplicate token) — never a
  // success or a genuine system error, so it's always shown as a warning.
  // Every pure-navigation handler clears it first so it never lingers onto a
  // screen it wasn't meant for; a handler that's about to show a fresh one
  // just sets it again afterward in the same call, so nothing flickers.
  const [error, setError] = useState(null);

  const aliases = ctx.aliasRepo.all();
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
    // Songs then artists (most-specific first, mirrors Play's browse list),
    // most-recently-touched first within each chunk.
    const songAliases = sortByRecency(aliases.filter((alias) => alias.type === 'song'));
    const artistAliases = sortByRecency(aliases.filter((alias) => alias.type === 'artist'));
    // Only the title/value ever gets truncated — the token and type are
    // always short and shown in full — never wrapped onto a second row.
    const width = getTerminalWidth() - SELECTION_INDICATOR_WIDTH;
    const items = [
      ...songAliases.map((alias) => ({ label: fitLine(`${alias.token}  →  `, alias.title, '  (song)', width), value: alias.token })),
      ...artistAliases.map((alias) => ({ label: fitLine(`${alias.token}  →  `, alias.value, '  (artist)', width), value: alias.token })),
      ...(aliases.length > 0 ? [DIVIDER_ITEM] : []),
      { label: '+ New artist alias', value: '__addArtist__' },
      { label: '+ New song alias', value: '__addSong__' },
      { label: '‹ Back', value: '__back__' },
    ];
    return (
      <Box flexDirection="column">
        <Text bold>Aliases</Text>
        <SkipList
          items={items}
          onSelect={(item) => {
            setError(null);
            if (item.value === '__back__') return onBack();
            if (item.value === '__addArtist__') return setMode('artistName');
            if (item.value === '__addSong__') return setMode('songSearch');
            setSelectedToken(item.value);
            return setMode('detail');
          }}
        />
        {error && <Text color={theme.warning}>⚠ {error}</Text>}
      </Box>
    );
  }

  if (mode === 'detail') {
    const items = [
      { label: '⟳ Rename alias', value: 'rename' },
      ...(selectedEntry.type === 'song' ? [{ label: '⟳ Replace (listen & re-pick)', value: 'replace' }] : []),
      { label: '- Delete alias', value: 'delete' },
      { label: '‹ Back', value: '__back__' },
    ];
    return (
      <Box flexDirection="column">
        <Text bold>{selectedEntry.token}</Text>
        <Text color={theme.dim}>
          {truncateToWidth(selectedEntry.type === 'artist' ? selectedEntry.value : selectedEntry.title, getTerminalWidth())}
        </Text>
        <SelectInput
          items={items}
          onSelect={(item) => {
            setError(null);
            if (item.value === '__back__') return setMode('list');
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
        {error && <Text color={theme.warning}>⚠ {error}</Text>}
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

  if (mode === 'songSearch') {
    return (
      <Picker
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
