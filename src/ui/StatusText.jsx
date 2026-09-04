import React from 'react';
import { Box, Text } from 'ink';
import { STATUS_ICON, STATUS_COLOR } from './statusLevel.js';

// Every inline warning/success/error message below a screen's own
// interactive content (a list, a text box, whatever) used to render flush
// against the line above it — this adds the same one-line gap Ink's own
// outer Box padding gives the whole app, so a message here reads with the
// same breathing room as the blank line that already separates the last
// Ink frame from whatever prints once handOffToForeground unmounts it.
export default function StatusText({ message, level = 'warning' }) {
  if (!message) return null;
  return (
    <Box marginTop={1}>
      <Text color={STATUS_COLOR[level]}>
        {STATUS_ICON[level]} {message}
      </Text>
    </Box>
  );
}
