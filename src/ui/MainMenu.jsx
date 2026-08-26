import React from 'react';
import { Box } from 'ink';
import SelectInput from 'ink-select-input';
import { exitCleanly } from './exitCleanly.js';

const ITEMS = [
  { label: 'Play', value: 'play' },
  { label: 'Aliases', value: 'aliases' },
  { label: 'Playlists', value: 'playlists' },
  { label: 'Settings', value: 'settings' },
  { label: 'Exit', value: 'exit' },
];

export default function MainMenu({ ctx, onNavigate }) {
  const handleSelect = (item) => {
    if (item.value === 'exit') exitCleanly(ctx.platform);
    onNavigate(item.value);
  };

  return (
    <Box flexDirection="column">
      <SelectInput items={ITEMS} onSelect={handleSelect} />
    </Box>
  );
}
