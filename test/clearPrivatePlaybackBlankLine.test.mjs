import test from 'node:test';
import assert from 'node:assert/strict';
import { clearPrivatePlaybackBlankLine } from '../src/ui/clearPrivatePlaybackBlankLine.js';

test("clears Ink's trailing blank row before private playback in a TTY", () => {
  const writes = [];
  clearPrivatePlaybackBlankLine({ privateMode: true, stdout: { isTTY: true, write: (value) => writes.push(value) } });
  assert.deepEqual(writes, ['\u001b[1A\r\u001b[2K']);
});

test('does not alter terminal output outside private-mode TTY playback', () => {
  for (const options of [
    { privateMode: false, stdout: { isTTY: true, write: () => assert.fail('must not write') } },
    { privateMode: true, stdout: { isTTY: false, write: () => assert.fail('must not write') } },
  ]) {
    clearPrivatePlaybackBlankLine(options);
  }
});
