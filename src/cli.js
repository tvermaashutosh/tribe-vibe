import { getPlatform } from './platform/index.js';
import { AliasRepository } from './repository/aliasRepository.js';
import { PlaylistRepository } from './repository/playlistRepository.js';
import { SettingsRepository } from './repository/settingsRepository.js';
import { TokenRegistry } from './repository/tokenRegistry.js';
import { clearCacheDir } from './repository/clearCacheDir.js';
import { acquireSessionLock, releaseSessionLock } from './repository/sessionLock.js';
import { MpvDaemonSupervisor } from './player/mpvDaemonSupervisor.js';
import { MpvIpcClient } from './player/mpvIpcClient.js';
import { Player } from './player/player.js';
import { playSongForeground, playPlaylistForeground } from './player/directPlay.js';
import { formatPlaylistSongList } from './player/playlistSongList.js';
import { formatCliStatus } from './ui/statusLevel.js';
import { YoutubeResolver } from './resolvers/youtubeResolver.js';
import { createCommandRegistry } from './commands/commandRegistry.js';
import { resolveTypedInput } from './pipeline/index.js';
import { CONTROL_FLAGS, SIGNAL_EXIT_CODES } from './constants.js';
import { killAllMpv } from './player/killAllMpv.js';
import { trace, truncateTraceLogForNewSession } from './debugTrace.js';

// A single token's flag name, but ONLY when it's actually dash-prefixed —
// aliases/playlists are legally allowed to be named a bare "pause" or "kill"
// (validateToken only forbids a leading -), and stripping dashes before
// checking membership used to match those names identically to -pause/-kill,
// silently hijacking a play into a hotkey command instead. Returns null for
// anything that isn't a single, dash-prefixed token.
export function parseSingleFlag(args) {
  if (args.length !== 1 || !/^-/.test(args[0])) return null;
  return args[0].replace(/^-+/, '').toLowerCase();
}

// Keep Node from taking its default immediate-exit path on a signal, which
// would skip the finally block below. The child process shares this process's
// group and receives the signal too; its normal exit settles the active await
// and releases the lock. Do not release here: mpv may still be reading cache
// files after the signal arrives.
function guardSessionLock() {
  const onSignal = (signal) => trace(`cli.js: received ${signal}; retaining cache lock until active work exits`);
  const signals = Object.keys(SIGNAL_EXIT_CODES);
  for (const signal of signals) process.on(signal, onSignal);
  return () => {
    for (const signal of signals) process.removeListener(signal, onSignal);
  };
}

// Facade: this is the one entry point everything else hangs off of. It stays
// a thin orchestrator on purpose — no business logic lives here, only wiring.
export async function run(argv) {
  const args = argv.slice(2);
  const platform = getPlatform();
  const flag = parseSingleFlag(args);

  // Deliberately handled before anything else here — unlike every other
  // control flag, -kill must work even when the daemon/IPC path itself is
  // the thing broken or unreachable (that's exactly the rescue scenario it
  // exists for: an orphaned foreground mpv with no controlling terminal and
  // no IPC socket at all, confirmed live after a closed terminal left one
  // running, looped forever, for the rest of a session). Every other
  // control flag below still goes through runSession(), which unconditionally
  // starts the daemon first — wrong for a command whose whole job might be
  // to clean up after that daemon too. Kills every mpv process on the
  // machine, not just ones tribe-vibe itself spawned — deliberate, so it
  // still works even for a process this session never tracked in the first
  // place (which a tracked-PID approach can't recover, by definition).
  if (flag === 'kill') {
    const { killed, alreadyGone, stillRunning } = await killAllMpv();
    if (killed.length > 0) {
      console.log(formatCliStatus('success', `Stopped ${killed.length} mpv process${killed.length === 1 ? '' : 'es'}: ${killed.join(', ')}`));
    } else if (stillRunning.length === 0) {
      console.log(formatCliStatus('success', 'No mpv processes were running.'));
    }
    // SIGTERM was actually delivered but the process is still alive after
    // the confirmation window — reported honestly instead of folded into
    // "Stopped", which used to claim success the instant the signal sent,
    // whether or not the process had actually died yet.
    if (stillRunning.length > 0) {
      console.log(
        formatCliStatus(
          'warning',
          `Sent stop signal, but still running: ${stillRunning.join(', ')} — it may be ignoring it, or just slow to exit.`,
        ),
      );
    }
    if (alreadyGone.length > 0) trace(`cli.js: -kill found ${alreadyGone.length} pid(s) that were already gone: ${alreadyGone.join(', ')}`);
    return;
  }

  // A hotkey control command (-pause, -next, ...) never downloads or plays
  // anything itself — it only sends an IPC command to an already-running
  // background daemon, so it never contends for the session lock below.
  const isControlFlag = flag !== null && CONTROL_FLAGS.includes(flag);
  // The audio cache has no eviction — wiped clean at the start of a real
  // play session instead, so it never accumulates without bound. Gated by
  // the session lock: wiping while ANOTHER tv process still has an
  // in-progress playlist download, or is still playing back what it already
  // downloaded, deletes files out from under it — confirmed by reproducing
  // exactly that data loss with the real playPlaylistForeground and
  // clearCacheDir. Only the process that wins the lock gets to wipe; every
  // other one just skips it this time rather than risk someone else's files.
  const sessionLock = !isControlFlag && acquireSessionLock(platform);
  if (sessionLock) {
    truncateTraceLogForNewSession();
    clearCacheDir(platform);
  }
  const unguardLock = sessionLock ? guardSessionLock() : () => {};
  try {
    return await runSession({ args, platform, isControlFlag, flag, sessionLock });
  } finally {
    unguardLock();
    // A menu play unmounts Ink before mpv starts, which ends launchMenu() and
    // unwinds this finally block. The foreground handoff takes the lease and
    // releases it only after playback ends.
    if (sessionLock && !sessionLock.transferred) releaseSessionLock(platform, sessionLock);
  }
}

async function runSession({ args, platform, isControlFlag, flag, sessionLock }) {
  const aliasRepo = new AliasRepository(platform.getConfigDir());
  const playlistRepo = new PlaylistRepository(platform.getConfigDir());
  const settingsRepo = new SettingsRepository(platform.getConfigDir());
  const tokenRegistry = new TokenRegistry(aliasRepo, playlistRepo);

  const daemon = new MpvDaemonSupervisor(platform);
  await daemon.ensureRunning();
  const ipc = new MpvIpcClient(platform.getMpvSocketPath());
  await ipc.connect();

  const player = new Player(ipc);
  const resolver = new YoutubeResolver(platform);
  const commands = createCommandRegistry({ player });

  const closeAndExit = () => {
    trace('cli.js: closeAndExit() calling ipc.close()');
    ipc.close();
    trace('cli.js: closeAndExit() returned');
  };

  // No args -> the full Ink app. All alias/playlist/settings management lives
  // here and only here — the typed grammar below never grows a management path.
  // Confirmed plays from inside the menu hand off to a foreground mpv exactly
  // like the direct CLI path below (see ui/Play.jsx) — the daemon connection
  // (player/ipc) passed in here is only for the Picker's quick audition preview.
  if (args.length === 0) {
    const { launchMenu } = await import('../dist/ui.js');
    trace('cli.js: launching menu');
    await launchMenu({
      platform,
      sessionLock,
      aliasRepo,
      playlistRepo,
      tokenRegistry,
      resolver,
      player,
      closeDaemon: closeAndExit,
      settings: settingsRepo.all(),
      saveSettings: (next) => settingsRepo.save(next),
    });
    trace('cli.js: launchMenu() resolved (Ink unmounted), calling closeAndExit() and returning from run()');
    return closeAndExit();
  }

  // A single recognized control flag, meant to be hotkey-bound — never typed
  // as part of a search, never mixed with a play target. These target the
  // background daemon, same as always — they have nothing to act on while a
  // foreground play (below) is running, which is the honest trade-off of
  // matching tswift's own single-process model. Deliberately checked against
  // the real CONTROL_FLAGS list (not just "starts with -"), since -l/-loop is
  // also dash-prefixed but belongs to the play grammar below, not here.
  if (isControlFlag) {
    await commands.execute({ type: flag });
    return closeAndExit();
  }

  // resolveTypedInput is the one place -q/-query (bypass the classifier
  // entirely for a literal search string) and normal alias resolution both
  // live — the same function the Ink Play screen and playlist add/replace
  // song use, so "-q" behaves identically no matter where it's typed.
  const intent = resolveTypedInput(args.join(' '), { aliasRepo, playlistRepo });

  if (intent.kind === 'empty') {
    console.log(formatCliStatus('warning', 'Nothing to play — try a song, playlist, or artist alias.'));
    return closeAndExit();
  }

  if (intent.note) console.log(formatCliStatus('warning', intent.note));

  // Every direct play runs mpv attached to this terminal — the tswift model.
  // mpv owns its own bar (--term-osd-bar) and reads space/arrow keys straight
  // off stdin itself; nothing here reimplements either. The first (or only)
  // file is downloaded ahead of time (see the resolver) so mpv is never
  // asked to resolve a raw YouTube URL itself — that's what caused header
  // mismatches and pipe-format-detection failures in the first place.
  if (intent.kind === 'song') {
    await playSongForeground({
      resolver,
      platform,
      videoId: intent.videoId,
      title: intent.title,
      loop: intent.modifiers?.loop,
      onReady: (localFile) => console.log(`Playing: ${localFile}`),
    });
  } else if (intent.kind === 'playlist') {
    await playPlaylistForeground({
      resolver,
      platform,
      playlistRepo,
      playlistName: intent.playlistName,
      loop: intent.modifiers?.loop,
      concurrency: settingsRepo.all().concurrentDownloads,
      onPlaylistFound: (playlist) => console.log(formatPlaylistSongList(playlist)),
      onEmpty: () => console.log(formatCliStatus('warning', `Playlist "${intent.playlistName}" has no songs yet — add some songs to it first.`)),
      onSongFailed: (song, err) => console.log(formatCliStatus('warning', `Skipping "${song.title}" — ${err.message}`)),
    });
  } else if (intent.kind === 'search') {
    const { pickFromSearch } = await import('../dist/ui.js');
    const picked = await pickFromSearch({
      query: intent.query,
      top: settingsRepo.all().top,
      resolver,
      player,
      aliasRepo,
      playlistRepo,
      tokenRegistry,
    });
    if (picked) {
      await playSongForeground({
        resolver,
        platform,
        videoId: picked.videoId,
        title: picked.title,
        loop: intent.modifiers?.loop,
        onReady: (localFile) => console.log(`Playing: ${localFile}`),
      });
    }
  }

  return closeAndExit();
}
