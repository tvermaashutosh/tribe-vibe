// Ink renders its own colors via <Text color={...}>, using theme.js's named
// colors — this is for the handful of places that print straight to stdout
// with no Ink involved at all (the typed CLI's own warnings/errors, and
// anything printed after Ink has already unmounted). Same color names as
// theme.js map to their real ANSI SGR codes, so a warning/error/success
// message reads identically whether it came from the CLI or from Ink.
const ANSI_CODES = {
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  gray: 90,
};
const RESET = 39;

// Guarded by isTTY — a piped or redirected output should never see raw
// escape codes, same rule as everywhere else in the app that colors plain
// console output.
export function colorize(colorName, text) {
  if (!process.stdout.isTTY) return text;
  return `\x1b[${ANSI_CODES[colorName]}m${text}\x1b[${RESET}m`;
}
