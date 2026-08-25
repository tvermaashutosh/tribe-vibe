import { execFileSync, spawn } from 'node:child_process';
import { trace } from '../debugTrace.js';
import { SIGNAL_EXIT_CODES } from '../constants.js';
import { recordMpvPid, removeMpvPid } from '../repository/mpvPidRegistry.js';

// Guards only the window between "mpv just exited" and this process's own
// controlled exit — confirmed by tracing a real hang that this process can
// die here without ever running its own shutdown code (no further trace
// lines at all), from something external signaling it (mpv shares this
// process's group by default, so a shell/job-control hiccup around mpv's own
// terminal-ownership handling can catch this process too, and Node's default
// disposition for these signals is immediate termination with zero cleanup).
// Deliberately NOT active while mpv is still running — a real terminal
// signal reaches mpv and this process at the same instant then, and running
// stty sane concurrently with mpv still legitimately owning raw mode would
// fight its own cleanup instead of helping.
function guardVulnerableWindow() {
  const onSignal = (signal) => {
    trace(`playForeground: caught ${signal} in the post-mpv-exit window, restoring terminal before exit`);
    if (process.platform !== 'win32' && process.stdin.isTTY) {
      try {
        execFileSync('stty', ['sane'], { stdio: 'inherit' });
      } catch {
        // best-effort only
      }
    }
    process.exit(SIGNAL_EXIT_CODES[signal]);
  };
  const signals = Object.keys(SIGNAL_EXIT_CODES);
  for (const signal of signals) process.on(signal, onSignal);
  return () => {
    for (const signal of signals) process.removeListener(signal, onSignal);
  };
}

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
export function playForeground({ files, loop, platform }) {
  // The ${media-title} substitution is colored cyan (matching
  // theme.secondary), leaving the "Now playing: " prefix plain — mpv just
  // echoes this template verbatim to the terminal, so embedding a raw ANSI
  // code in a param we already fully own doesn't touch mpv's own behavior
  // at all (verified live: mpv passes it straight through, no shell/quoting
  // involved since this is a literal argv element, not a shell string).
  const args = ['--no-video', '--term-osd-bar', '--term-playing-msg=Now playing: \x1b[36m${media-title}\x1b[39m'];
  if (loop) args.push(`--loop=${loop === true ? 'inf' : loop}`);

  for (const file of files) {
    if (file.title) args.push('--{', `--force-media-title=${file.title}`, file.path, '--}');
    else args.push(file.path);
  }

  // Confirmed by reproducing a real hang: after Ink unmounts, its own
  // 'readable' listener on stdin is gone, but the stream itself is never
  // explicitly paused — and pressing Enter (a full line) was reliably the
  // only thing that unstuck it, well before mpv's own 'exit' event ever even
  // fired in this process's JS callbacks. mpv doesn't need Node's own stream
  // wrapper active at all — it reads the raw inherited fd directly — so
  // there's nothing to lose by fully detaching Node's interest in stdin
  // before mpv ever starts.
  if (process.stdin.isTTY) process.stdin.pause();

  trace(`playForeground: spawning mpv, args=${JSON.stringify(args)}`);
  return new Promise((resolve, reject) => {
    const child = spawn('mpv', args, { stdio: 'inherit' });
    // Recorded so `tv -kill` can find this process later even if it outlives
    // this one — mpv is known to survive its own terminal closing (some
    // terminal media players deliberately ignore SIGHUP so an accidental
    // window close doesn't kill playback), which orphans it with no
    // controlling terminal and no way back in short of a real PID.
    if (platform) recordMpvPid(platform, child.pid);
    child.once('error', (err) => {
      trace(`playForeground: mpv spawn error: ${err.message}`);
      // tswift's own dependency check names the exact install command for
      // every missing tool, not just "is it installed?" — matching that here.
      reject(new Error(`mpv is not available — is it installed? (${err.message}) Try: ${platform.getInstallInstructions()}`));
    });
    child.once('exit', (code, signal) => {
      trace(`playForeground: mpv exited code=${code} signal=${signal}, calling restoreTerminal()`);
      if (platform) removeMpvPid(platform, child.pid);
      const unguard = guardVulnerableWindow();
      const finish = () => {
        unguard();
        trace('playForeground: vulnerable window closed, resolving playForeground promise');
        resolve();
      };
      const restorePromise = restoreTerminal();
      if (restorePromise) restorePromise.then(finish);
      else finish();
    });
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
  trace(`restoreTerminal: platform=${process.platform} isTTY=${process.stdin.isTTY}`);
  if (process.platform === 'win32' || !process.stdin.isTTY) {
    trace('restoreTerminal: guard skipped, no stty spawned');
    return null;
  }
  return new Promise((resolve) => {
    trace('restoreTerminal: spawning stty sane');
    const stty = spawn('stty', ['sane'], { stdio: 'inherit' });
    stty.once('error', (err) => {
      trace(`restoreTerminal: stty spawn error: ${err.message}`);
      resolve();
    });
    stty.once('exit', (code, signal) => {
      trace(`restoreTerminal: stty exited code=${code} signal=${signal}`);
      resolve();
    });
  });
}
