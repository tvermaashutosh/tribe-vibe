import React, { useEffect, useReducer } from 'react';
import { Box, Text, useInput } from 'ink';
import MainMenu from './MainMenu.jsx';
import Play from './Play.jsx';
import AliasScreen from './AliasScreen.jsx';
import Playlists from './Playlists.jsx';
import Settings from './Settings.jsx';
import NowPlaying from './NowPlaying.jsx';
import { exitCleanly } from './exitCleanly.js';
import { createInitialAppState, appNavigationReducer, shouldRenderAppFrame } from './appNavigation.js';
import { AppDisplayProvider, ViewHeading } from './AppDisplay.jsx';

export default function App({ ctx }) {
  const [navigation, dispatch] = useReducer(
    appNavigationReducer,
    undefined,
    () => createInitialAppState(ctx.initialIntent, ctx.initialScreen),
  );
  const [, refreshAfterSettingsChange] = useReducer((revision) => revision + 1, 0);

  const playIntent = (intent) => dispatch({ type: 'play', intent });

  useEffect(() => {
    if (!navigation.pendingIntent) return;
    const intent = navigation.pendingIntent;
    dispatch({ type: 'play-started' });
    // Ink must release raw-mode stdin before foreground mpv can use the
    // terminal. cli.js owns playback and remounts this app at Play afterward.
    ctx.pendingPlayback = intent;
    ctx.unmountMenu();
  }, [navigation.pendingIntent]);

  // Every sub-screen's own escape handler already routes back to 'main' — this
  // only needs to cover the terminal case: escape at the main menu itself exits.
  useInput((input, key) => {
    if (key.escape && navigation.screen === 'main') exitCleanly(ctx.platform, 0, ctx.sessionLock);
  });

  const backFromPlay = () => {
    ctx.playScreenState = undefined;
    dispatch({ type: 'navigate', screen: 'main' });
  };
  const renderAppFrame = shouldRenderAppFrame(navigation.screen, ctx.settings.privateMode);

  if (!renderAppFrame) return null;

  return (
    <AppDisplayProvider privateMode={ctx.settings.privateMode}>
      <Box
        flexDirection="column"
        paddingLeft={1}
        paddingRight={1}
      >
        <ViewHeading brand>tribe-vibe</ViewHeading>
        {navigation.screen === 'main' && <MainMenu onNavigate={(screen) => dispatch({ type: 'navigate', screen })} />}
        {navigation.screen === 'nowPlaying' && <NowPlaying />}
        {navigation.screen === 'play' && <Play ctx={ctx} onBack={backFromPlay} onPlayIntent={playIntent} />}
        {navigation.screen === 'songs' && <AliasScreen ctx={ctx} type="song" onBack={() => dispatch({ type: 'navigate', screen: 'main' })} onPlayIntent={playIntent} />}
        {navigation.screen === 'playlists' && <Playlists ctx={ctx} onBack={() => dispatch({ type: 'navigate', screen: 'main' })} onPlayIntent={playIntent} />}
        {navigation.screen === 'artists' && <AliasScreen ctx={ctx} type="artist" onBack={() => dispatch({ type: 'navigate', screen: 'main' })} />}
        {navigation.screen === 'settings' && (
          <Settings
            ctx={ctx}
            onBack={() => dispatch({ type: 'navigate', screen: 'main' })}
            onSettingsChange={refreshAfterSettingsChange}
          />
        )}
      </Box>
    </AppDisplayProvider>
  );
}
