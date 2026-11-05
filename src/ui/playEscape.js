// Play's first Escape clears its query; a second consecutive Escape leaves
// the screen. This state transition is independent of whether the query was
// already empty, so the user always gets the same two-step navigation.
export function playEscapeAction(alreadyCleared) {
  return alreadyCleared ? 'back' : 'clear';
}
