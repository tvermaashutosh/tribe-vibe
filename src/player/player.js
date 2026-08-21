// Adapter: wraps mpv's IPC protocol behind a clean, engine-agnostic Player
// interface. Nothing upstream (Command handlers, Ink UI) talks to mpv's IPC
// commands directly — only this file does, so mpv could be swapped later
// without touching any caller. This is only ever the background daemon —
// confirmed plays run through a separate foreground mpv instead (see
// player/playForeground.js) and never touch this class at all.
export class Player {
  constructor(ipcClient) {
    this.ipc = ipcClient;
  }

  async loadAndPlay(url, { loop } = {}) {
    await this.ipc.send(['loadfile', url]);
    if (loop) await this.setLoop(loop);
  }

  async appendToQueue(url) {
    await this.ipc.send(['loadfile', url, 'append-play']);
  }

  setLoop(loop) {
    const value = loop === true ? 'inf' : String(loop);
    return this.ipc.send(['set_property', 'loop-file', value]);
  }

  pause() {
    return this.ipc.send(['set_property', 'pause', true]);
  }

  resume() {
    return this.ipc.send(['set_property', 'pause', false]);
  }

  next() {
    return this.ipc.send(['playlist-next']);
  }

  prev() {
    return this.ipc.send(['playlist-prev']);
  }

  // A direct pass-through to mpv's own native playlist-shuffle command — not
  // a toggle we track state for (mpv has no such concept here either): the
  // `shuffle` *property* was tried first and verified, by directly loading a
  // real playlist and checking file order before/after, to leave an
  // already-queued playlist completely unchanged. playlist-shuffle is the
  // one that actually reorders it, confirmed the same way.
  shufflePlaylist() {
    return this.ipc.send(['playlist-shuffle']);
  }
}
