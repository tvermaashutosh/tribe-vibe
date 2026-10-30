import React, { useEffect, useReducer } from 'react';
import { Box, Text, useInput } from 'ink';
import MainMenu from './MainMenu.jsx';
import Play from './Play.jsx';
import AliasScreen from './AliasScreen.jsx';
import Playlists from './Playlists.jsx';
import Settings from './Settings.jsx';
import NowPlaying from './NowPlaying.jsx';
import { theme } from './theme.js';
import { exitCleanly } from './exitCleanly.js';
import { playSongForeground, playPlaylistForeground } from '../player/directPlay.js';
import { formatPlaylistSongList } from '../player/playlistSongList.js';
import { handOffToForeground } from './handOffToForeground.js';
import { createInitialAppState, appNavigationReducer } from './appNavigation.js';

export default function App({ ctx }) {
  const [navigation, dispatch] = useReducer(appNavigationReducer, ctx.initialIntent, createInitialAppState);

  const playIntent = (intent) => dispatch({ type: 'play', intent });

  const playNow = async (intent) => handOffToForeground(ctx, async () => {
    if (intent.kind === 'song') {
      await playSongForeground({
        resolver: ctx.resolver,
        platform: ctx.platform,
        videoId: intent.videoId,
        title: intent.title,
        loop: intent.modifiers?.loop,
        onReady: (localFile) => console.log(`Playing: ${localFile}`),
      });
      return;
    }

    if (intent.kind === 'playlist') {
      await playPlaylistForeground({
        resolver: ctx.resolver,
        platform: ctx.platform,
        playlistRepo: ctx.playlistRepo,
        playlistName: intent.playlistName,
        loop: intent.modifiers?.loop,
        concurrency: ctx.settings.concurrentDownloads,
        onPlaylistFound: (playlist) => console.log(formatPlaylistSongList(playlist, 1)),
        onEmpty: (playlist) => console.log(`Playlist "${playlist.name}" has no songs yet — add some songs to it first.`),
        onSongFailed: (song, err) => console.log(`Skipping "${song.title}" — ${err.message}`),
      });
    }
  });

  useEffect(() => {
    if (!navigation.pendingIntent) return;
    const intent = navigation.pendingIntent;
    dispatch({ type: 'play-started' });
    playNow(intent);
  }, [navigation.pendingIntent]);

  // Every sub-screen's own escape handler already routes back to 'main' — this
  // only needs to cover the terminal case: escape at the main menu itself exits.
  useInput((input, key) => {
    if (key.escape && navigation.screen === 'main') exitCleanly(ctx.platform, 0, ctx.sessionLock);
  });

  return (
    <Box
      flexDirection="column"
      paddingLeft={1}
      paddingRight={1}
    >
      <Text bold color={theme.accent}>tribe-vibe</Text>
      {navigation.screen === 'main' && <MainMenu onNavigate={(screen) => dispatch({ type: 'navigate', screen })} />}
      {navigation.screen === 'nowPlaying' && <NowPlaying />}
      {navigation.screen === 'play' && <Play ctx={ctx} onBack={() => dispatch({ type: 'navigate', screen: 'main' })} onPlayIntent={playIntent} />}
      {navigation.screen === 'songs' && <AliasScreen ctx={ctx} type="song" onBack={() => dispatch({ type: 'navigate', screen: 'main' })} onPlayIntent={playIntent} />}
      {navigation.screen === 'playlists' && <Playlists ctx={ctx} onBack={() => dispatch({ type: 'navigate', screen: 'main' })} onPlayIntent={playIntent} />}
      {navigation.screen === 'artists' && <AliasScreen ctx={ctx} type="artist" onBack={() => dispatch({ type: 'navigate', screen: 'main' })} />}
      {navigation.screen === 'settings' && <Settings ctx={ctx} onBack={() => dispatch({ type: 'navigate', screen: 'main' })} />}
    </Box>
  );
}
