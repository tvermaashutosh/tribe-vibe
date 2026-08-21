import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import MainMenu from './MainMenu.jsx';
import Play from './Play.jsx';
import Aliases from './Aliases.jsx';
import ManagePlaylists from './ManagePlaylists.jsx';
import Settings from './Settings.jsx';
import { theme } from './theme.js';

export default function App({ ctx }) {
  const [screen, setScreen] = useState('main');

  // Every sub-screen's own escape handler already routes back to 'main' — this
  // only needs to cover the terminal case: escape at the main menu itself exits.
  useInput((input, key) => {
    if (key.escape && screen === 'main') process.exit(0);
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color={theme.accent}>
        tribe-vibe
      </Text>
      {screen === 'main' && <MainMenu ctx={ctx} onNavigate={setScreen} />}
      {screen === 'play' && <Play ctx={ctx} onBack={() => setScreen('main')} />}
      {screen === 'aliases' && <Aliases ctx={ctx} onBack={() => setScreen('main')} />}
      {screen === 'playlists' && <ManagePlaylists ctx={ctx} onBack={() => setScreen('main')} />}
      {screen === 'settings' && <Settings ctx={ctx} onBack={() => setScreen('main')} />}
    </Box>
  );
}
