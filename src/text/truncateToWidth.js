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
