import { theme } from './theme.js';
import { colorize } from '../text/ansiColor.js';

// One shared severity vocabulary for every inline status message across the
// app — success (something worked), warning (bad/duplicate input, or a
// heads-up that isn't a failure — the user can just fix it and retry), error
// (a genuine system failure: network, missing binary, unexpected exception).
export const STATUS_ICON = { success: '✓', warning: '⚠', error: '✗' };
export const STATUS_COLOR = { success: theme.success, warning: theme.warning, error: theme.error };

// Same vocabulary, for the handful of places that print straight to stdout
// with no Ink involved (the typed CLI, and anything printed after Ink has
// already unmounted) — so the same situation reads with the same icon and
// color no matter which of the two ever shows it.
export function formatCliStatus(level, message) {
  return colorize(STATUS_COLOR[level], `${STATUS_ICON[level]} ${message}`);
}
