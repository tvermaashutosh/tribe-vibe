const CYAN = '\x1b[36m';
const RESET_COLOR = '\x1b[39m';

// These are plain console.log, not Ink (Ink has already unmounted by the
// time either fires), so the colored piece is a raw ANSI code — matching
// theme.secondary's cyan — rather than anything Ink-specific. Only applied
// when actually attached to a real terminal; a piped or redirected output
// should never see raw escape codes.
function colorize(text) {
  return process.stdout.isTTY ? `${CYAN}${text}${RESET_COLOR}` : text;
}

// Printed once, right before mpv takes over the terminal for a single song.
export function formatNowPlaying(title) {
  return `Now playing song: ${colorize(title)}`;
}

// Printed once, right before mpv takes over the terminal for a playlist.
export function formatNowPlayingPlaylist(name) {
  return `Now playing playlist: ${colorize(name)}`;
}
