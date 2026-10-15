import { formatCliStatus } from './statusLevel.js';
import { trace } from '../debugTrace.js';
import { exitCleanly } from './exitCleanly.js';

// Pulled out of Play.jsx so any screen with a deterministic play action
// (a song alias, a playlist) can hand off exactly the same way Play.jsx's
// own browse list and the typed CLI already do — tear the whole Ink app
// down, run a real foreground mpv attached to the terminal, then exit.
// Ink and mpv can't both own raw-mode stdin at once, so the whole menu
// exits; that also means playing from any of these screens behaves
// identically to typing `tv <token>` in a shell, down to handing the
// terminal back once playback actually finishes.
//
// Mirrors bin/tv.js's own top-level error format — an error here is
// handled exactly like an error from the equivalent typed command would be,
// since by this point the Ink UI is already gone and there's nothing left
// to return to.
export async function handOffToForeground(ctx, playFn) {
  // launchMenu() resolves as soon as Ink unmounts, which unwinds cli.js's
  // ordinary finally block. Transfer the acquired lease before unmounting so
  // that finally leaves it in place until foreground playback exits.
  const sessionLock = ctx.sessionLock;
  if (sessionLock) sessionLock.transfer();
  trace('handOffToForeground: calling unmountMenu()');
  ctx.unmountMenu();
  trace('handOffToForeground: unmountMenu() returned, calling playFn()');
  try {
    await playFn();
    trace('handOffToForeground: playFn() resolved, calling closeDaemon()');
    ctx.closeDaemon();
    trace('handOffToForeground: closeDaemon() returned, calling exitCleanly(0)');
    exitCleanly(ctx.platform, 0, sessionLock);
  } catch (err) {
    trace(`handOffToForeground: caught error: ${err.message}`);
    console.error(formatCliStatus('error', `tv error: ${err.message}`));
    exitCleanly(ctx.platform, 1, sessionLock);
  }
}
