import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SkipList from './SkipList.jsx';
import { DIVIDER_ITEM } from './divider.js';
import { STATUS_ICON, STATUS_COLOR } from './statusLevel.js';
import { theme } from './theme.js';
import { truncateToWidth, getTerminalWidth } from '../text/truncateToWidth.js';

// The shared Search -> List -> Listen -> Pick flow. Reused across several
// call sites: an ambiguous free-text play (confirm = play now), song-alias
// create/edit (confirm = save alias), and playlist add/edit (confirm = add or
// replace a slot). `onConfirm` differs between them; `onSaveAlias` and
// `onAddToPlaylist` are optional extras so a one-off search can *also* be
// pinned as a permanent shortcut in the same motion, without redoing it later.
export default function Picker({
  initialQuery = '',
  top = 5,
  resolver,
  player,
  onConfirm,
  onCancel,
  onSaveAlias,
  onAddToPlaylist,
  playlists = [],
}) {
  const [query, setQuery] = useState(initialQuery);
  const [phase, setPhase] = useState(initialQuery ? 'searching' : 'typing');
  const [results, setResults] = useState([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  // 'warning' for bad/duplicate input (the user can just fix it and retry),
  // 'error' for a genuine system failure (mpv/network), 'success' otherwise.
  const [statusLevel, setStatusLevel] = useState('success');
  const [pendingCandidate, setPendingCandidate] = useState(null);
  const [aliasInput, setAliasInput] = useState('');

  const showStatus = (message, level = 'success') => {
    setStatus(message);
    setStatusLevel(level);
  };

  useEffect(() => {
    if (phase !== 'searching') return undefined;
    let cancelled = false;
    resolver
      .search(query, top)
      .then((items) => {
        if (cancelled) return;
        setResults(items);
        setIndex(0);
        setPhase('listing');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setPhase('typing');
      });
    return () => {
      cancelled = true;
    };
  }, [phase, query, top, resolver]);

  useInput(
    (input, key) => {
      if (key.escape) return onCancel();
      if (phase !== 'listing') return;
      // Any interaction here invalidates whatever status was left over from
      // a previous attempt — moving the cursor, previewing, or starting a
      // fresh a/p flow are all "new actions," so nothing stale should carry
      // forward into what happens next.
      showStatus(null);
      if (key.upArrow) setIndex((i) => Math.max(0, i - 1));
      if (key.downArrow) setIndex((i) => Math.min(results.length - 1, i + 1));
      if (input === ' ') {
        const candidate = results[index];
        // Deliberately still a direct stream (not download-then-play): this is
        // a quick audition across several candidates, not the confirmed play,
        // so speed matters more than the extra reliability would here. Still
        // needs a .catch — an unhandled rejection here would crash the whole
        // session if mpv fails to resolve the URL. A real system failure, not
        // a validation problem, so it's an error, not a warning.
        if (candidate) {
          player
            .loadAndPlay(resolver.toWatchUrl(candidate.videoId))
            .catch((err) => showStatus(`Preview failed: ${err.message}`, 'error'));
        }
      }
      if (input === 'a' && onSaveAlias) {
        setPendingCandidate(results[index]);
        setPhase('namingAlias');
      }
      if (input === 'p' && onAddToPlaylist) {
        setPendingCandidate(results[index]);
        setPhase('choosingPlaylist');
      }
      if (key.return) {
        const candidate = results[index];
        if (candidate) onConfirm(candidate);
      }
    },
    { isActive: phase !== 'namingAlias' && phase !== 'choosingPlaylist' },
  );

  if (phase === 'typing') {
    return (
      <Box flexDirection="column">
        <Text>Search: </Text>
        <TextInput value={query} onChange={setQuery} onSubmit={() => setPhase('searching')} />
        {error && <Text color={theme.error}>✗ {error}</Text>}
      </Box>
    );
  }

  if (phase === 'searching') {
    return <Text color={theme.dim}>Searching for "{query}"...</Text>;
  }

  if (phase === 'namingAlias') {
    return (
      <Box flexDirection="column">
        <Text>Alias for "{pendingCandidate.title}":</Text>
        <TextInput
          value={aliasInput}
          onChange={setAliasInput}
          onSubmit={async () => {
            try {
              await onSaveAlias(pendingCandidate, aliasInput.trim());
              showStatus(`Saved alias "${aliasInput.trim()}"`, 'success');
            } catch (err) {
              // A bad/duplicate token — the user can just pick a different
              // one, not a system failure.
              showStatus(err.message, 'warning');
            }
            setAliasInput('');
            setPhase('listing');
          }}
        />
        <Text color={theme.dim}>(esc to cancel)</Text>
      </Box>
    );
  }

  if (phase === 'choosingPlaylist') {
    const items = [
      ...playlists.map((name) => ({ label: name, value: name })),
      ...(playlists.length > 0 ? [DIVIDER_ITEM] : []),
      { label: '‹ Cancel', value: '__back__' },
    ];
    return (
      <Box flexDirection="column">
        <Text>Add "{pendingCandidate.title}" to which playlist?</Text>
        {playlists.length === 0 && <Text color={theme.dim}>No playlists yet — create one from New Playlist.</Text>}
        <SkipList
          items={items}
          onSelect={async (item) => {
            if (item.value !== '__back__') {
              try {
                await onAddToPlaylist(pendingCandidate, item.value);
                showStatus(`Added to "${item.value}"`, 'success');
              } catch (err) {
                // Already in this playlist, or similar — a validation
                // problem, not a system failure.
                showStatus(err.message, 'warning');
              }
            }
            setPhase('listing');
          }}
        />
      </Box>
    );
  }

  const hints = ['↑/↓ select', 'space to preview', 'enter to confirm'];
  if (onSaveAlias) hints.push('a to save as alias');
  if (onAddToPlaylist) hints.push('p to add to playlist');
  hints.push('esc to cancel');

  return (
    <Box flexDirection="column">
      {results.length === 0 && <Text color={theme.warning}>⚠ No results found — press esc and try a different search.</Text>}
      {results.map((result, i) => {
        // Never wrap onto a second row — a title that just barely overflows
        // reads as stray blank-looking spacing rather than an obviously
        // continued line. Truncated up front to the real terminal width
        // instead.
        const prefix = i === index ? '❯ ' : '  ';
        const suffix = result.duration ? ` (${Math.round(result.duration)}s)` : '';
        const title = truncateToWidth(result.title, Math.max(getTerminalWidth() - prefix.length - suffix.length, 0));
        return (
          <Text key={result.videoId} color={i === index ? theme.selected : undefined}>
            {prefix}
            {title}
            {suffix}
          </Text>
        );
      })}
      {results.length > 0 && <Text color={theme.dim}>({hints.join(' · ')})</Text>}
      {status && (
        <Text color={STATUS_COLOR[statusLevel]}>
          {STATUS_ICON[statusLevel]} {status}
        </Text>
      )}
    </Box>
  );
}
