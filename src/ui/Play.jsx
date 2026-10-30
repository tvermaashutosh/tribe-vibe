import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Picker from './Picker.jsx';
import StatusText from './StatusText.jsx';
import { resolveTypedInput } from '../pipeline/index.js';
import { buildBrowseItems } from './browseItems.js';
import { theme } from './theme.js';

// Runs the exact same Pipeline the typed CLI uses (normalize -> classify ->
// resolve) — so "tsw tt loop=10" behaves identically whether you typed it in
// a terminal or right here. A confirmed play (deterministic intent, or a
// Picker pick) opens the Now Playing screen and hands the terminal to MPV for
// its native logs, progress bar, and keyboard controls.
export default function Play({ ctx, onBack, onPlayIntent }) {
  // Computed before query below, not after — its very first item is already
  // shown highlighted (❯) the moment this screen opens, so the search box
  // should already match it too, not just once you actually press an arrow.
  const browseItems = buildBrowseItems(ctx.aliasRepo, ctx.playlistRepo);

  const [query, setQuery] = useState(() => browseItems[0]?.token ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  // An ambiguous search still carries whatever -l/-loop the user typed —
  // remembered here since the Picker below is a whole separate render pass,
  // away from the original intent object, and applied once a candidate is
  // actually confirmed.
  const [searchLoop, setSearchLoop] = useState(undefined);
  // Every message shown in this screen is a heads-up ("nothing to play",
  // "ignoring X") — never a success (a successful play exits the process
  // entirely) or a system error (that's handled separately below, after Ink
  // is already torn down) — so it's always a warning. Cleared at the start
  // of every submit so a stale one never lingers onto whatever comes next.
  const [status, setStatus] = useState(null);
  const [picking, setPicking] = useState(false);
  const [browseIndex, setBrowseIndex] = useState(0);
  // Bumped every time browsing overwrites query below — forces TextInput to
  // remount, since ink-text-input only resets its own internal cursor to the
  // end of an externally-set value under specific conditions (it doesn't
  // reliably do so from an empty box), and typing right after a fill should
  // always append, not land wherever a stale cursor position happened to be.
  const [fillNonce, setFillNonce] = useState(0);

  // The one place both the typed box and the browse list end up — same
  // branching the typed CLI does for song/playlist/search, so an item picked
  // from the list plays exactly the way typing its token would.
  const playIntent = (intent) => {
    if (intent.kind === 'empty') {
      setStatus('Nothing to play — try a song, playlist, or artist alias.');
      return;
    }
    if (intent.note) setStatus(intent.note);

    if (intent.kind === 'song') {
      onPlayIntent(intent);
      return;
    }

    if (intent.kind === 'playlist') {
      // Checked here, before ever unmounting the menu — an empty playlist is
      // nothing to play, not a reason to tear down the whole session and drop
      // the user back to a shell prompt. Staying put also means they can just
      // pick something else immediately, same as the plain "nothing typed" case.
      const playlist = ctx.playlistRepo.all().find((entry) => entry.name === intent.playlistName);
      if (playlist.songs.length === 0) {
        setStatus(`Playlist "${intent.playlistName}" has no songs yet — add some songs to it first.`);
        return;
      }
      onPlayIntent(intent);
      return;
    }

    setSearchQuery(intent.query);
    setSearchLoop(intent.modifiers?.loop);
    setPicking(true);
  };

  useInput(
    (input, key) => {
      if (key.escape) return onBack();
    },
    { isActive: !picking },
  );

  // ink-text-input's own useInput explicitly ignores up/down arrows (it only
  // handles left/right for cursor movement and backspace/typing) — so this
  // moves the browse-list selection with no conflict, whether or not the
  // search box currently has focus/content. Clamped, not wrapped, matching
  // Picker's own listing navigation.
  //
  // Browsing also overwrites the search box with the highlighted item's own
  // token, replacing whatever was typed there — rather than a separate
  // one-keystroke way to play it outright, this is now just a fast way to
  // fill in what you'd have typed anyway, leaving room to append a modifier
  // (loop=10, say) before actually submitting. Submitting then runs through
  // the exact same resolveTypedInput path a manually-typed token would: an
  // untouched fill plays outright (still deterministic), an edited one
  // searches instead if it no longer resolves to anything exact.
  useInput(
    (input, key) => {
      if (!key.upArrow && !key.downArrow) return;
      setStatus(null);
      const nextIndex = key.upArrow ? Math.max(0, browseIndex - 1) : Math.min(browseItems.length - 1, browseIndex + 1);
      setBrowseIndex(nextIndex);
      setQuery(browseItems[nextIndex].token);
      setFillNonce((n) => n + 1);
    },
    { isActive: !picking && browseItems.length > 0 },
  );

  if (!picking) {
    return (
      <Box flexDirection="column">
        <Text bold color={theme.secondary}>Play</Text>
        <Text color={theme.dim}>Same grammar as the terminal — order, case, and spacing never matter.</Text>
        <TextInput
          key={fillNonce}
          value={query}
          onChange={(value) => {
            setStatus(null);
            setQuery(value);
          }}
          onSubmit={() => {
            setStatus(null);
            playIntent(resolveTypedInput(query, { aliasRepo: ctx.aliasRepo, playlistRepo: ctx.playlistRepo }));
          }}
        />
        <Text color={theme.dim}>{'─'.repeat(30)}</Text>
        {browseItems.length === 0 ? (
          <Text color={theme.dim}>No aliases or playlists yet.</Text>
        ) : (
          <Box flexDirection="column">
            {browseItems.map((item, i) => (
              <Text key={item.token} color={i === browseIndex ? theme.selected : undefined}>
                {i === browseIndex ? '❯ ' : '  '}
                {item.columns[0]}  {item.columns[1]}  {item.columns[2]}  {item.columns[3]}
              </Text>
            ))}
            <Text color={theme.dim}>(↑/↓ browse — fills the box, edit freely, enter to play or search)</Text>
          </Box>
        )}
        <StatusText message={status} />
      </Box>
    );
  }

  return (
    <Picker
      initialQuery={searchQuery}
      top={ctx.settings.top}
      resolver={ctx.resolver}
      player={ctx.player}
      onConfirm={(candidate) => {
        onPlayIntent({ kind: 'song', videoId: candidate.videoId, title: candidate.title, modifiers: { loop: searchLoop } });
      }}
      onCancel={() => {
        setStatus(null);
        setPicking(false);
      }}
      onSaveAlias={(candidate, token) =>
        ctx.aliasRepo.addSongAlias(token, candidate.videoId, candidate.title, ctx.tokenRegistry)
      }
      onAddToPlaylist={(candidate, playlistName) =>
        ctx.playlistRepo.addSong(playlistName, { videoId: candidate.videoId, title: candidate.title })
      }
      playlists={ctx.playlistRepo.all().map((playlist) => playlist.name)}
    />
  );
}
