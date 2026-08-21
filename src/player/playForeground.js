import { spawn } from 'node:child_process';

// Runs mpv attached to this terminal — exactly the tswift model: inherited
// stdio, mpv's own --term-osd-bar, mpv reading space/arrow keys directly off
// stdin itself. Nothing here reimplements a bar or a keypress handler; mpv
// already has both, battle-tested, for free.
//
// This is a wholly separate mpv process from the background daemon (which
// exists so OS-level hotkeys and the Ink menu can control an already-running
// instance). While this is playing, `tv -pause` and friends have nothing to
// act on — that's the honest trade-off of matching tswift's own model, which
// never had cross-process control either. Resolves once mpv exits, i.e. once
// the song/playlist genuinely finishes or the user quits mpv themselves.
//
// Each file carries its own {path, title}. mpv applies command-line options
// to every file that follows them, not just the one right after — a title
// set before file 1 would silently leak onto file 2, 3, etc. mpv's own
// --{ / --} per-file markers are the real fix (verified live: without them,
// the last --force-media-title on the line wins for the whole playlist).
export function playForeground({ files, loop }) {
  const args = ['--no-video', '--term-osd-bar', '--term-playing-msg=Now playing: ${media-title}'];
  if (loop) args.push(`--loop=${loop === true ? 'inf' : loop}`);

  for (const file of files) {
    if (file.title) args.push('--{', `--force-media-title=${file.title}`, file.path, '--}');
    else args.push(file.path);
  }

  return new Promise((resolve, reject) => {
    const child = spawn('mpv', args, { stdio: 'inherit' });
    child.once('error', (err) => reject(new Error(`mpv is not available — is it installed? (${err.message})`)));
    child.once('exit', () => resolve(restoreTerminal()));
  });
}

// mpv puts the terminal into raw mode (no echo, no line buffering) for its
// own keyboard handling, and normally restores it cleanly on exit. Reported
// symptom this addresses: quitting mpv almost the instant it starts can
// leave the terminal stuck in that raw state afterward — prompt technically
// back, but keystrokes don't echo and nothing typed executes. `stty sane` is
// the standard fix any well-behaved parent runs after a raw-mode child exits
// (it's what a shell itself does after every foreground job) — terminal
// hygiene, not a reimplementation of any mpv control. Best-effort only: no
// real tty (tests, some CI) or no `stty` (Windows) means nothing to restore.
function restoreTerminal() {
  if (process.platform === 'win32' || !process.stdin.isTTY) return;
  return new Promise((resolve) => {
    const stty = spawn('stty', ['sane'], { stdio: 'inherit' });
    stty.once('error', () => resolve());
    stty.once('exit', () => resolve());
  });
}
