import test from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../src/player/player.js';

function fakeIpc() {
  const sent = [];
  return {
    sent,
    send: async (command) => {
      sent.push(command);
      return null;
    },
  };
}

test('loadAndPlay sends loadfile, and sets loop-file only when a loop was requested', async () => {
  const ipc = fakeIpc();
  const player = new Player(ipc);

  await player.loadAndPlay('/cache/a.m4a');
  assert.deepEqual(ipc.sent, [['loadfile', '/cache/a.m4a']]);

  ipc.sent.length = 0;
  await player.loadAndPlay('/cache/b.m4a', { loop: 3 });
  assert.deepEqual(ipc.sent, [
    ['loadfile', '/cache/b.m4a'],
    ['set_property', 'loop-file', '3'],
  ]);
});

test('appendToQueue sends loadfile with append-play', async () => {
  const ipc = fakeIpc();
  const player = new Player(ipc);
  await player.appendToQueue('https://www.youtube.com/watch?v=abc');
  assert.deepEqual(ipc.sent, [['loadfile', 'https://www.youtube.com/watch?v=abc', 'append-play']]);
});

test('pause/resume/next/prev/shufflePlaylist send the right mpv IPC commands', async () => {
  const ipc = fakeIpc();
  const player = new Player(ipc);

  await player.pause();
  await player.resume();
  await player.next();
  await player.prev();
  await player.shufflePlaylist();

  assert.deepEqual(ipc.sent, [
    ['set_property', 'pause', true],
    ['set_property', 'pause', false],
    ['playlist-next'],
    ['playlist-prev'],
    // Not set_property shuffle=true — verified directly against a real mpv
    // instance that this leaves an already-queued playlist's order
    // completely unchanged. playlist-shuffle is the command that actually
    // reorders it.
    ['playlist-shuffle'],
  ]);
});
