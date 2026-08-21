import { getPlatform } from './platform/index.js';
import { AliasRepository } from './repository/aliasRepository.js';
import { PlaylistRepository } from './repository/playlistRepository.js';
import { SettingsRepository } from './repository/settingsRepository.js';
import { TokenRegistry } from './repository/tokenRegistry.js';
import { MpvDaemonSupervisor } from './player/mpvDaemonSupervisor.js';
import { MpvIpcClient } from './player/mpvIpcClient.js';
import { Player } from './player/player.js';
import { playSongForeground, playPlaylistForeground } from './player/directPlay.js';
import { formatPlaylistSongList } from './player/playlistSongList.js';
import { YoutubeResolver } from './resolvers/youtubeResolver.js';
import { createCommandRegistry } from './commands/commandRegistry.js';
import { resolveTypedInput } from './pipeline/index.js';
import { CONTROL_FLAGS } from './constants.js';
import { trace } from './debugTrace.js';

// Facade: this is the one entry point everything else hangs off of. It stays
// a thin orchestrator on purpose — no business logic lives here, only wiring.
export async function run(argv) {
  const args = argv.slice(2);
  const platform = getPlatform();
  const aliasRepo = new AliasRepository(platform.getConfigDir());
  const playlistRepo = new PlaylistRepository(platform.getConfigDir());
  const settingsRepo = new SettingsRepository(platform.getConfigDir());
  const tokenRegistry = new TokenRegistry(aliasRepo, playlistRepo);

  const daemon = new MpvDaemonSupervisor(platform);
  await daemon.ensureRunning();
  const ipc = new MpvIpcClient(platform.getMpvSocketPath());
  await ipc.connect();

  const player = new Player(ipc);
  const resolver = new YoutubeResolver();
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
  if (args.length === 1 && CONTROL_FLAGS.includes(args[0].replace(/^-+/, '').toLowerCase())) {
    const flag = args[0].replace(/^-+/, '').toLowerCase();
    await commands.execute({ type: flag });
    return closeAndExit();
  }

  // resolveTypedInput is the one place -q/-query (bypass the classifier
  // entirely for a literal search string) and normal alias resolution both
  // live — the same function the Ink Play screen and playlist add/replace
  // song use, so "-q" behaves identically no matter where it's typed.
  const intent = resolveTypedInput(args.join(' '), { aliasRepo, playlistRepo });

  if (intent.kind === 'empty') {
    console.log('Nothing to play — try `tv <song or artist>`.');
    return closeAndExit();
  }

  if (intent.note) console.log(intent.note);

  // Every direct play runs mpv attached to this terminal — the tswift model.
  // mpv owns its own bar (--term-osd-bar) and reads space/arrow keys straight
  // off stdin itself; nothing here reimplements either. The first (or only)
  // file is downloaded ahead of time (see the resolver) so mpv is never
  // asked to resolve a raw YouTube URL itself — that's what caused header
  // mismatches and pipe-format-detection failures in the first place.
  if (intent.kind === 'song') {
    console.log('Resolving...');
    await playSongForeground({
      resolver,
      platform,
      videoId: intent.videoId,
      title: intent.title,
      loop: intent.modifiers?.loop,
      onReady: () => console.log(`Now playing: ${intent.title}`),
    });
  } else if (intent.kind === 'playlist') {
    console.log('Resolving...');
    await playPlaylistForeground({
      resolver,
      platform,
      playlistRepo,
      playlistName: intent.playlistName,
      loop: intent.modifiers?.loop,
      onReady: (playlist) => console.log(`${formatPlaylistSongList(playlist)}\n\nNow playing playlist: ${intent.playlistName}`),
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
      console.log('Resolving...');
      await playSongForeground({
        resolver,
        platform,
        videoId: picked.videoId,
        title: picked.title,
        loop: intent.modifiers?.loop,
        onReady: () => console.log(`Now playing: ${picked.title}`),
      });
    }
  }

  return closeAndExit();
}
