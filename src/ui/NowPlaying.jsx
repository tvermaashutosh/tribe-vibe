import React from 'react';
import { Text } from 'ink';
import { theme } from './theme.js';

// This screen is committed by Ink before MPV takes over the terminal. That
// lets Ink replace the current app view in place, just like Play and Results.
export default function NowPlaying() {
  return <Text bold color={theme.secondary}>Now Playing</Text>;
}
