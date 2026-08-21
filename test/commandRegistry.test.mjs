import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommandRegistry } from '../src/commands/commandRegistry.js';

function fakePlayer() {
  const calls = [];
  return {
    calls,
    pause: async () => calls.push(['pause']),
    resume: async () => calls.push(['resume']),
    next: async () => calls.push(['next']),
    prev: async () => calls.push(['prev']),
    shufflePlaylist: async () => calls.push(['shufflePlaylist']),
  };
}

test('unknown command type still throws a clear error', async () => {
  const commands = createCommandRegistry({ player: fakePlayer() });
  await assert.rejects(async () => commands.execute({ type: 'not-a-real-command' }), /Unknown command type/);
});

test('every hotkey action dispatches to its matching Player method', async () => {
  const player = fakePlayer();
  const commands = createCommandRegistry({ player });

  await commands.execute({ type: 'pause' });
  await commands.execute({ type: 'resume' });
  await commands.execute({ type: 'next' });
  await commands.execute({ type: 'prev' });
  await commands.execute({ type: 'shuffle' });

  assert.deepEqual(player.calls, [['pause'], ['resume'], ['next'], ['prev'], ['shufflePlaylist']]);
});
