// Control actions never take a search target, so they're only ever invoked
// as `tv -flag` (meant for hotkey binding) — never part of the typed play grammar.
export const CONTROL_FLAGS = ['pause', 'resume', 'next', 'prev', 'shuffle'];

export const DEFAULT_SETTINGS = Object.freeze({ top: 5 });
