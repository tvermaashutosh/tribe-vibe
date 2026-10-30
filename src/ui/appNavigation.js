export function createInitialAppState(initialIntent) {
  return {
    screen: initialIntent ? 'nowPlaying' : 'main',
    pendingIntent: initialIntent ?? null,
  };
}

export function appNavigationReducer(state, action) {
  if (action.type === 'navigate') return { ...state, screen: action.screen };
  if (action.type === 'play') return { screen: 'nowPlaying', pendingIntent: action.intent };
  if (action.type === 'play-started') return { ...state, pendingIntent: null };
  return state;
}
