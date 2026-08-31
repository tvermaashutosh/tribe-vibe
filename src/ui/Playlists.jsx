import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Picker from './Picker.jsx';
import SkipList from './SkipList.jsx';
import { resolveTypedInput } from '../pipeline/index.js';
import { DIVIDER_ITEM } from './divider.js';
import { sortByRecency } from './sortByRecency.js';
import { theme } from './theme.js';

// One screen for everything playlist-related: the list of existing playlists
// (add/remove/reorder/replace songs, rename, delete), plus creating a brand
// new one. A playlist's name IS its invocable token — no separate alias list.
export default function Playlists({ ctx, onBack }) {
  const [mode, setMode] = useState('list');
  const [selected, setSelected] = useState(null);
  const [editIndex, setEditIndex] = useState(null);
  const [nameInput, setNameInput] = useState('');
  // Only ever a validation message here (bad/duplicate name, duplicate video)
  // — never a success or a genuine system error, so always shown as a
  // warning. Every pure-navigation handler clears both this and
  // songSearchStatus first, so a stale message never lingers onto a screen
  // it wasn't meant for; a handler about to show a fresh one just sets it
  // again afterward in the same call, so nothing flickers.
  const [error, setError] = useState(null);
  // Which action the song search screen resolves to — 'add' appends to the
  // playlist, 'replace' overwrites editIndex.
  const [pendingAction, setPendingAction] = useState(null);
  const [songQuery, setSongQuery] = useState('');
  const [songSearchStatus, setSongSearchStatus] = useState(null);
  const [pickerQuery, setPickerQuery] = useState('');

  // Most-recently-touched first — same model as Aliases/Play: creating,
  // renaming, or editing a playlist's songs all bump it back to the top.
  const playlists = sortByRecency(ctx.playlistRepo.all());
  const selectedPlaylist = playlists.find((entry) => entry.name === selected);

  const clearStatus = () => {
    setError(null);
    setSongSearchStatus(null);
  };

  // Escape always backs out one level, everywhere in this screen — disabled
  // only while a Picker child owns input (it handles its own escape).
  useInput(
    (input, key) => {
      if (!key.escape) return;
      clearStatus();
      if (mode === 'list') return onBack();
      if (mode === 'songMenu' || mode === 'rename') return setMode('detail');
      if (mode === 'songSearchInput') return setMode(pendingAction === 'add' ? 'detail' : 'songMenu');
      return setMode('list');
    },
    { isActive: mode !== 'addSong' && mode !== 'replaceSong' },
  );

  if (mode === 'list') {
    const items = [
      ...playlists.map((playlist) => ({
        label: `${playlist.name}  →  ${playlist.songs.length} songs`,
        value: playlist.name,
      })),
      ...(playlists.length > 0 ? [DIVIDER_ITEM] : []),
      { label: '+ New playlist', value: '__add__' },
      { label: '‹ Back', value: '__back__' },
    ];
    return (
      <Box flexDirection="column">
        <Text bold color={theme.secondary}>Playlists</Text>
        <SkipList
          items={items}
          onHighlight={() => setError(null)}
          onSelect={(item) => {
            setError(null);
            if (item.value === '__back__') return onBack();
            if (item.value === '__add__') return setMode('createName');
            setSelected(item.value);
            return setMode('detail');
          }}
        />
        {error && <Text color={theme.warning}>⚠ {error}</Text>}
      </Box>
    );
  }

  if (mode === 'createName') {
    return (
      <Box flexDirection="column">
        <Text>Playlist name (single word — this is also its alias):</Text>
        <TextInput
          value={nameInput}
          onChange={setNameInput}
          onSubmit={() => {
            try {
              ctx.playlistRepo.create(nameInput.trim(), ctx.tokenRegistry);
              setError(null);
            } catch (err) {
              setError(err.message);
            }
            setNameInput('');
            setMode('list');
          }}
        />
      </Box>
    );
  }

  if (mode === 'detail') {
    const items = [
      ...selectedPlaylist.songs.map((song, i) => ({
        label: `${i + 1}. ${song.title}`,
        value: `song:${i}`,
      })),
      ...(selectedPlaylist.songs.length > 0 ? [DIVIDER_ITEM] : []),
      { label: '+ Add song', value: '__addSong__' },
      { label: '⟳ Rename playlist', value: '__rename__' },
      { label: '- Delete playlist', value: '__delete__' },
      { label: '‹ Back', value: '__back__' },
    ];
    return (
      <Box flexDirection="column">
        <Text bold color={theme.secondary}>{selectedPlaylist.name}</Text>
        <SkipList
          items={items}
          onHighlight={() => setError(null)}
          onSelect={(item) => {
            setError(null);
            if (item.value === '__back__') return setMode('list');
            if (item.value === '__addSong__') {
              setPendingAction('add');
              return setMode('songSearchInput');
            }
            if (item.value === '__rename__') {
              setNameInput(selectedPlaylist.name);
              return setMode('rename');
            }
            if (item.value === '__delete__') {
              ctx.playlistRepo.delete(selected);
              return setMode('list');
            }
            setEditIndex(Number(item.value.split(':')[1]));
            return setMode('songMenu');
          }}
        />
        <Text color={theme.dim}>(select a song to reorder, replace, or remove it)</Text>
        {error && <Text color={theme.warning}>⚠ {error}</Text>}
      </Box>
    );
  }

  if (mode === 'rename') {
    return (
      <Box flexDirection="column">
        <Text>New name for "{selectedPlaylist.name}":</Text>
        <TextInput
          value={nameInput}
          onChange={setNameInput}
          onSubmit={() => {
            try {
              ctx.playlistRepo.rename(selectedPlaylist.name, nameInput.trim(), ctx.tokenRegistry);
              setSelected(nameInput.trim().toLowerCase());
              setError(null);
            } catch (err) {
              setError(err.message);
            }
            setNameInput('');
            setMode('detail');
          }}
        />
      </Box>
    );
  }

  // The exact same single search box Play uses — no separate "browse
  // existing aliases" screen, because typing a known alias token here
  // already resolves deterministically (no picker) the same way it does
  // there. An artist alias, a song alias, both, plain free text, or -q/-query
  // for a literal bypass all work identically.
  if (mode === 'songSearchInput') {
    return (
      <Box flexDirection="column">
        <Text bold color={theme.secondary}>{pendingAction === 'add' ? 'Add song' : 'Replace song'}</Text>
        <Text color={theme.dim}>Same grammar as Play — artist alias, song alias, both, or free text.</Text>
        <TextInput
          value={songQuery}
          onChange={(value) => {
            setSongSearchStatus(null);
            setSongQuery(value);
          }}
          onSubmit={() => {
            const intent = resolveTypedInput(songQuery, { aliasRepo: ctx.aliasRepo, playlistRepo: ctx.playlistRepo });
            setSongQuery('');
            clearStatus();

            if (intent.kind === 'empty') {
              setSongSearchStatus('Nothing to search for.');
              return;
            }

            if (intent.kind === 'playlist') {
              setSongSearchStatus(`"${songQuery.trim()}" resolves to a playlist, not a song — can't nest a playlist inside a playlist.`);
              return;
            }

            if (intent.kind === 'song') {
              const entry = { videoId: intent.videoId, title: intent.title };
              try {
                if (pendingAction === 'add') ctx.playlistRepo.addSong(selected, entry);
                else ctx.playlistRepo.replaceSong(selected, editIndex, entry);
              } catch (err) {
                setError(err.message);
              }
              setMode('detail');
              return;
            }

            setPickerQuery(intent.query);
            setMode(pendingAction === 'add' ? 'addSong' : 'replaceSong');
          }}
        />
        {songSearchStatus && <Text color={theme.warning}>⚠ {songSearchStatus}</Text>}
      </Box>
    );
  }

  if (mode === 'addSong') {
    return (
      <Picker
        initialQuery={pickerQuery}
        top={ctx.settings.top}
        resolver={ctx.resolver}
        player={ctx.player}
        onConfirm={(candidate) => {
          setError(null);
          try {
            ctx.playlistRepo.addSong(selected, { videoId: candidate.videoId, title: candidate.title });
          } catch (err) {
            setError(err.message);
          }
          setMode('detail');
        }}
        onCancel={() => {
          setError(null);
          setMode('detail');
        }}
      />
    );
  }

  if (mode === 'songMenu') {
    const items = [
      { label: '↑ Move up', value: 'up' },
      { label: '↓ Move down', value: 'down' },
      { label: '⟳ Replace song (listen & re-pick)', value: 'replace' },
      { label: '- Remove song', value: 'remove' },
      { label: '‹ Back', value: '__back__' },
    ];
    return (
      <SelectInput
        items={items}
        onSelect={(item) => {
          setError(null);
          if (item.value === '__back__') return setMode('detail');
          if (item.value === 'remove') {
            ctx.playlistRepo.removeSong(selected, editIndex);
            return setMode('detail');
          }
          if (item.value === 'up') {
            ctx.playlistRepo.reorder(selected, editIndex, editIndex - 1);
            return setMode('detail');
          }
          if (item.value === 'down') {
            ctx.playlistRepo.reorder(selected, editIndex, editIndex + 1);
            return setMode('detail');
          }
          setPendingAction('replace');
          return setMode('songSearchInput');
        }}
      />
    );
  }

  if (mode === 'replaceSong') {
    return (
      <Picker
        initialQuery={pickerQuery}
        top={ctx.settings.top}
        resolver={ctx.resolver}
        player={ctx.player}
        onConfirm={(candidate) => {
          setError(null);
          try {
            ctx.playlistRepo.replaceSong(selected, editIndex, { videoId: candidate.videoId, title: candidate.title });
          } catch (err) {
            setError(err.message);
          }
          setMode('detail');
        }}
        onCancel={() => {
          setError(null);
          setMode('detail');
        }}
      />
    );
  }

  return null;
}
