import { DEFAULT_SETTINGS, isPrivateModeEnabled } from '../constants.js';

export function createInitialAppState(initialIntent, initialScreen = 'main') {
  return {
    screen: initialIntent ? 'nowPlaying' : initialScreen,
    pendingIntent: initialIntent ?? null,
  };
}

export function shouldRenderAppFrame(screen, privateMode = DEFAULT_SETTINGS.privateMode) {
  return screen !== 'nowPlaying' || !isPrivateModeEnabled(privateMode);
}

export function appNavigationReducer(state, action) {
  if (action.type === 'navigate') return { ...state, screen: action.screen };
  if (action.type === 'play') return { screen: 'nowPlaying', pendingIntent: action.intent };
  if (action.type === 'play-started') return { ...state, pendingIntent: null };
  return state;
}
