// Command: every hotkey action is a {type, payload} object executed through
// this one dispatch table. Confirmed plays (song/playlist) don't go through
// here at all anymore — those hand off to a foreground mpv (see
// player/directPlay.js); this registry is only for the -flag hotkey path,
// which targets the background daemon.
export function createCommandRegistry(ctx) {
  const registry = {
    pause: () => ctx.player.pause(),
    resume: () => ctx.player.resume(),
    next: () => ctx.player.next(),
    prev: () => ctx.player.prev(),
    shuffle: () => ctx.player.shufflePlaylist(),
  };

  return {
    execute(command) {
      const handler = registry[command.type];
      if (!handler) throw new Error(`Unknown command type: ${command.type}`);
      return handler(command.payload);
    },
  };
}
