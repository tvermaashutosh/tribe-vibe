import React from 'react';
import { Box } from 'ink';
import SelectInput from 'ink-select-input';

const ITEMS = [
  { label: 'Play', value: 'play' },
  { label: 'Songs', value: 'songs' },
  { label: 'Playlists', value: 'playlists' },
  { label: 'Artists', value: 'artists' },
  { label: 'Settings', value: 'settings' },
];

// No Exit row — esc already exits from here (App.jsx's own escape handler
// fires exitCleanly whenever screen === 'main'), so a click-to-exit item
// would just be a second way to do the same thing.
export default function MainMenu({ onNavigate }) {
  return (
    <Box flexDirection="column">
      <SelectInput items={ITEMS} onSelect={(item) => onNavigate(item.value)} />
    </Box>
  );
}
