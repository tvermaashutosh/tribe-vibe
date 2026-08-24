const CYAN = '\x1b[36m';
const RESET_COLOR = '\x1b[39m';

// Printed once, right before mpv takes over the terminal. This is a plain
// console.log, not Ink (Ink has already unmounted by the time this fires),
// so the title is colored with a raw ANSI code — matching theme.secondary's
// cyan — rather than anything Ink-specific. Only applied when actually
// attached to a real terminal; a piped or redirected output should never
// see raw escape codes.
export function formatNowPlaying(title) {
  const coloredTitle = process.stdout.isTTY ? `${CYAN}${title}${RESET_COLOR}` : title;
  return `Now playing: ${coloredTitle}`;
}
