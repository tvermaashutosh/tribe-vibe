import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { findFirstSelectable, moveSelection } from './skipListNav.js';
import { theme } from './theme.js';

// A minimal stand-in for ink-select-input, used only for lists that include a
// non-interactive divider row (see divider.js). ink-select-input has no
// concept of a disabled/skippable item — every row is a real, focusable,
// number-key-selectable index — so a divider inserted into its items array
// would still be something you can arrow onto and get stuck on. This one
// actually skips over any item marked `divider: true`, in whichever
// direction you're moving, and never calls onSelect for one. Visual styling
// (theme.selected highlight, pointer indicator) matches ink-select-input's
// own default exactly, so switching components here doesn't change how
// anything looks.
export default function SkipList({ items, onSelect }) {
  const [selectedIndex, setSelectedIndex] = useState(findFirstSelectable(items));
  const previousValues = useRef(items.map((item) => item.value).join('|'));

  useEffect(() => {
    const nextValues = items.map((item) => item.value).join('|');
    if (nextValues !== previousValues.current) {
      previousValues.current = nextValues;
      setSelectedIndex(findFirstSelectable(items));
    }
  }, [items]);

  useInput((input, key) => {
    if (key.upArrow) setSelectedIndex((i) => moveSelection(items, i, -1));
    if (key.downArrow) setSelectedIndex((i) => moveSelection(items, i, 1));
    if (key.return) {
      const item = items[selectedIndex];
      if (item && !item.divider) onSelect(item);
    }
  });

  return (
    <Box flexDirection="column">
      {items.map((item, index) => {
        const isSelected = index === selectedIndex && !item.divider;
        return (
          <Box key={item.value}>
            <Box marginRight={1}>
              <Text color={isSelected ? theme.selected : undefined}>{isSelected ? '❯' : ' '}</Text>
            </Box>
            <Text color={isSelected ? theme.selected : undefined}>{item.label}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
