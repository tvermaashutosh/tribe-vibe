import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Picker from './Picker.jsx';
import { resolveTypedInput } from '../pipeline/index.js';
import { playSongForeground, playPlaylistForeground } from '../player/directPlay.js';
import { formatPlaylistSongList } from '../player/playlistSongList.js';
import { formatNowPlaying } from '../player/nowPlayingMessage.js';
import { buildBrowseItems, intentForBrowseItem } from './browseItems.js';
import { theme } from './theme.js';
import { trace } from '../debugTrace.js';

// Runs the exact same Pipeline the typed CLI uses (normalize -> classify ->
// resolve) — so "tsw tt loop=10" behaves identically whether you typed it in
// a terminal or right here. A confirmed play (deterministic intent, or a
// Picker pick) hands off exactly like the typed CLI does: tear down the Ink
// app and run a real foreground mpv, attached to the terminal, tswift-style
// — not a reimplemented bar/hotkey view. Ink and mpv can't both own raw-mode
// stdin at once, so the whole menu exits; that also means "Play" from the
// menu and typing `tv <song>` in a shell now behave identically end to end,
// down to handing your terminal back once playback actually finishes.
export default function Play({ ctx, onBack }) {
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  // Every message shown in this screen is a heads-up ("nothing to play",
  // "ignoring X") — never a success (a successful play exits the process
  // entirely) or a system error (that's handled separately below, after Ink
  // is already torn down) — so it's always a warning. Cleared at the start
  // of every submit so a stale one never lingers onto whatever comes next.
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [browseIndex, setBrowseIndex] = useState(0);

  const browseItems = buildBrowseItems(ctx.aliasRepo, ctx.playlistRepo);

  // Mirrors bin/tv.js's own top-level error format — an error here is
  // handled exactly like an error from the equivalent typed command would be,
  // since by this point the Ink UI is already gone and there's nothing left
  // to return to.
  const handOffToForeground = async (playFn) => {
    trace('handOffToForeground: calling unmountMenu()');
    ctx.unmountMenu();
    trace('handOffToForeground: unmountMenu() returned, calling playFn()');
    try {
      await playFn();
      trace('handOffToForeground: playFn() resolved, calling closeDaemon()');
      ctx.closeDaemon();
      trace('handOffToForeground: closeDaemon() returned, calling process.exit(0)');
      process.exit(0);
    } catch (err) {
      trace(`handOffToForeground: caught error: ${err.message}`);
      console.error(`tribe-vibe error: ${err.message}`);
      process.exit(1);
    }
  };

  // The one place both the typed box and the browse list end up — same
  // branching the typed CLI does for song/playlist/search, so an item picked
  // from the list plays exactly the way typing its token would.
  const playIntent = (intent) => {
    if (intent.kind === 'empty') {
      setStatus('Nothing to play.');
      return;
    }
    if (intent.note) setStatus(intent.note);

    if (intent.kind === 'song') {
      setBusy(true);
      handOffToForeground(() =>
        playSongForeground({
          resolver: ctx.resolver,
          platform: ctx.platform,
          videoId: intent.videoId,
          title: intent.title,
          loop: intent.modifiers?.loop,
          onReady: () => console.log(formatNowPlaying(intent.title)),
        }),
      );
      return;
    }

    if (intent.kind === 'playlist') {
      setBusy(true);
      handOffToForeground(() =>
        playPlaylistForeground({
          resolver: ctx.resolver,
          platform: ctx.platform,
          playlistRepo: ctx.playlistRepo,
          playlistName: intent.playlistName,
          loop: intent.modifiers?.loop,
          onPlaylistFound: (playlist) => console.log(formatPlaylistSongList(playlist)),
          onReady: () => console.log(`Now playing playlist: ${intent.playlistName}`),
        }),
      );
      return;
    }

    setSearchQuery(intent.query);
    setPicking(true);
  };

  useInput(
    (input, key) => {
      if (key.escape) return onBack();
    },
    { isActive: !busy && !picking },
  );

  // ink-text-input's own useInput explicitly ignores up/down arrows (it only
  // handles left/right for cursor movement and backspace/typing) — so this
  // moves the browse-list selection with no conflict, whether or not the
  // search box currently has focus/content. Clamped, not wrapped, matching
  // Picker's own listing navigation.
  useInput(
    (input, key) => {
      if (key.upArrow) setBrowseIndex((i) => Math.max(0, i - 1));
      if (key.downArrow) setBrowseIndex((i) => Math.min(browseItems.length - 1, i + 1));
    },
    { isActive: !busy && !picking && browseItems.length > 0 },
  );

  if (busy) {
    return (
      <Box flexDirection="column">
        <Text bold>Play</Text>
        <Text color={theme.dim}>{status || 'Resolving...'}</Text>
      </Box>
    );
  }

  if (!picking) {
    return (
      <Box flexDirection="column">
        <Text bold>Play</Text>
        <Text color={theme.dim}>Same grammar as the terminal — order, case, and spacing never matter.</Text>
        <TextInput
          value={query}
          onChange={setQuery}
          onSubmit={() => {
            setStatus(null);
            // An empty box plays whatever's highlighted below instead of
            // resolving an empty string — that's the whole point of listing
            // aliases/playlists here: browse instead of typing.
            if (query.trim() === '' && browseItems.length > 0) {
              playIntent(intentForBrowseItem(browseItems[browseIndex]));
              return;
            }
            playIntent(resolveTypedInput(query, { aliasRepo: ctx.aliasRepo, playlistRepo: ctx.playlistRepo }));
          }}
        />
        {status && <Text color={theme.warning}>⚠ {status}</Text>}
        <Text color={theme.dim}>{'─'.repeat(30)}</Text>
        {browseItems.length === 0 ? (
          <Text color={theme.dim}>No aliases or playlists yet.</Text>
        ) : (
          <Box flexDirection="column">
            {browseItems.map((item, i) => (
              <Text key={item.token} color={i === browseIndex ? theme.selected : undefined}>
                {i === browseIndex ? '❯ ' : '  '}
                {item.label}
              </Text>
            ))}
            <Text color={theme.dim}>(↑/↓ browse · enter plays the highlighted one when the box is empty)</Text>
          </Box>
        )}
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
        setBusy(true);
        handOffToForeground(() =>
          playSongForeground({
            resolver: ctx.resolver,
            platform: ctx.platform,
            videoId: candidate.videoId,
            title: candidate.title,
            onReady: () => console.log(formatNowPlaying(candidate.title)),
          }),
        );
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
