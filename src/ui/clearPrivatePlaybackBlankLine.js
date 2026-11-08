export function clearPrivatePlaybackBlankLine({ privateMode, stdout }) {
  if (!privateMode || !stdout.isTTY) return;
  // Ink appends a newline even when its private Now Playing frame is empty.
  stdout.write('\u001b[1A\r\u001b[2K');
}
