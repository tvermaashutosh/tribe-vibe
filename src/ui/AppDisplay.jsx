import React, { createContext, useContext } from 'react';
import { Text } from 'ink';
import { theme } from './theme.js';

const AppDisplayContext = createContext({ privateMode: false });

export function AppDisplayProvider({ privateMode, children }) {
  return (
    <AppDisplayContext.Provider value={{ privateMode }}>
      {children}
    </AppDisplayContext.Provider>
  );
}

export function ViewHeading({ children, brand = false }) {
  const { privateMode } = useContext(AppDisplayContext);
  if (privateMode) return null;

  return <Text bold color={brand ? theme.accent : theme.secondary}>{children}</Text>;
}
