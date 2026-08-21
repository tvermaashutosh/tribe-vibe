// Spawned as a real child process by playForeground.test.mjs — this is
// needed because that test exercises actual signal delivery and
// process.exit(), which can't be done safely in-process without risking
// killing the test runner itself.
import { playForeground } from '../../src/player/playForeground.js';

Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });

playForeground({ files: [{ path: '/tmp/does-not-matter.m4a' }] }).then(() => {
  process.exit(0);
});
