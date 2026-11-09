import React, { createContext, useContext } from 'react';
import { Text } from 'ink';
import { DEFAULT_SETTINGS, isPrivateModeEnabled } from '../constants.js';
import { theme } from './theme.js';

const DEFAULT_PRIVATE_MODE = DEFAULT_SETTINGS.privateMode;
const AppDisplayContext = createContext({ privateMode: DEFAULT_PRIVATE_MODE });

export function AppDisplayProvider({ privateMode = DEFAULT_PRIVATE_MODE, children }) {
  return (
    <AppDisplayContext.Provider value={{ privateMode: isPrivateModeEnabled(privateMode) }}>
      {children}
    </AppDisplayContext.Provider>
  );
}

export function ViewHeading({ children, brand = false }) {
  const { privateMode } = useContext(AppDisplayContext);
  if (isPrivateModeEnabled(privateMode)) return null;

  return <Text bold color={brand ? theme.accent : theme.secondary}>{children}</Text>;
}
