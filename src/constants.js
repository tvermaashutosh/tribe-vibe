// Control actions never take a search target, so they're only ever invoked
// as `tv -flag` (meant for hotkey binding) — never part of the typed play grammar.
export const CONTROL_FLAGS = ['pause', 'resume', 'next', 'prev', 'shuffle'];

export const DEFAULT_SETTINGS = Object.freeze({ top: 5, concurrentDownloads: 2 });

// Conventional 128+signum exit codes — shared by every place in the app that
// needs to exit with the "correct" code after handling a signal itself,
// rather than letting Node's own default disposition (which wouldn't run
// any of this app's own cleanup first) decide.
export const SIGNAL_EXIT_CODES = { SIGINT: 130, SIGHUP: 129, SIGTERM: 143 };

// The two external binaries this app shells out to — shared so the literal
// never drifts between the several places that spawn them, search PATH for
// them, or just need to name them in a diagnostic message.
export const MPV_BINARY = 'mpv';
export const YTDLP_BINARY = 'yt-dlp';
