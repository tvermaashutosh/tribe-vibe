import { fitLine, getTerminalWidth } from '../text/truncateToWidth.js';

// Printed once, right before mpv takes over the terminal — only the title
// ever gets truncated, never wrapped onto a second row.
export function formatNowPlaying(title) {
  return fitLine('Now playing: ', title, '', getTerminalWidth());
}
