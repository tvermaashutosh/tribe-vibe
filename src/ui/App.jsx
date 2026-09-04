import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import MainMenu from './MainMenu.jsx';
import Play from './Play.jsx';
import AliasScreen from './AliasScreen.jsx';
import Playlists from './Playlists.jsx';
import Settings from './Settings.jsx';
import { theme } from './theme.js';
import { exitCleanly } from './exitCleanly.js';

export default function App({ ctx }) {
  const [screen, setScreen] = useState('main');

  // Every sub-screen's own escape handler already routes back to 'main' — this
  // only needs to cover the terminal case: escape at the main menu itself exits.
  useInput((input, key) => {
    if (key.escape && screen === 'main') exitCleanly(ctx.platform);
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color={theme.accent}>
        tribe-vibe
      </Text>
      {screen === 'main' && <MainMenu onNavigate={setScreen} />}
      {screen === 'play' && <Play ctx={ctx} onBack={() => setScreen('main')} />}
      {screen === 'songs' && <AliasScreen ctx={ctx} type="song" onBack={() => setScreen('main')} />}
      {screen === 'playlists' && <Playlists ctx={ctx} onBack={() => setScreen('main')} />}
      {screen === 'artists' && <AliasScreen ctx={ctx} type="artist" onBack={() => setScreen('main')} />}
      {screen === 'settings' && <Settings ctx={ctx} onBack={() => setScreen('main')} />}
    </Box>
  );
}
