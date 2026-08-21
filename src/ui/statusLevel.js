import { theme } from './theme.js';

// One shared severity vocabulary for every inline status message across the
// app — success (something worked), warning (bad/duplicate input, or a
// heads-up that isn't a failure — the user can just fix it and retry), error
// (a genuine system failure: network, missing binary, unexpected exception).
export const STATUS_ICON = { success: '✓', warning: '⚠', error: '✗' };
export const STATUS_COLOR = { success: theme.success, warning: theme.warning, error: theme.error };
