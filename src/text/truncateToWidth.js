// Pure text helpers — no wrapping, ever. A terminal (or Ink, for a <Text>
// that doesn't fit its Box) will otherwise wrap a long line onto a second
// row, which reads as stray blank-looking spacing rather than an obviously
// continued line. Truncating up front avoids that class of artifact
// entirely instead of trying to detect/undo a wrap after the fact.
export function truncateToWidth(text, maxWidth) {
  if (maxWidth <= 0) return '';
  if (text.length <= maxWidth) return text;
  if (maxWidth === 1) return '…';
  return `${text.slice(0, maxWidth - 1)}…`;
}

// Falls back to 80 when not attached to a real tty (piped output, tests) —
// the same fallback Ink itself uses internally.
export function getTerminalWidth() {
  return process.stdout.columns || 80;
}

// Every line in the app is really "a fixed prefix + one free-form value +
// a fixed suffix" — a token, an arrow, a title/name, a type label; a number,
// a dot, a song title. The token/type/number parts are always short and
// meant to be read in full; the title/name is the one thing that can
// genuinely be too long. So when a line doesn't fit, only that middle piece
// gets truncated — the fixed parts around it are never touched.
export function fitLine(prefix, middle, suffix, availableWidth) {
  const middleWidth = Math.max(availableWidth - prefix.length - suffix.length, 0);
  return `${prefix}${truncateToWidth(middle, middleWidth)}${suffix}`;
}

// Every selectable list in the app (SkipList, ink-select-input, Play's
// browse list) reserves exactly this much room in front of each row for the
// "❯ "/"  " selection indicator — one place to compute a list row's real
// available width instead of hardcoding 2 at every call site.
export const SELECTION_INDICATOR_WIDTH = 2;
