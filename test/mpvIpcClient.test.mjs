import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MpvIpcClient } from '../src/player/mpvIpcClient.js';

// Node's EventEmitter throws synchronously when 'error' is emitted with zero
// listeners registered for it — a documented special case for that one event
// name. Nothing upstream of MpvIpcClient (cli.js, Player, Picker.jsx)
// registers its own 'error' listener, so without a default safety-net one
// here, a real socket error would crash the whole tv process.
test('emitting error on a fresh MpvIpcClient does not throw, even with no external listener', () => {
  const client = new MpvIpcClient('/tmp/does-not-matter.sock');
  assert.doesNotThrow(() => client.emit('error', new Error('boom')));
});

// The real code path, not just the synthetic emit above: a genuine socket
// error after a successful connect, over a real Unix domain socket.
test(
  'a real socket error after connecting does not crash the process',
  async () => {
    const socketPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-ipc-test-')), 'test.sock');
    const server = net.createServer((socket) => {
      // The server-side socket needs its own 'error' listener too, for the
      // same reason as the fix under test — socket.destroy(err) below emits
      // 'error' on THIS socket, which would otherwise crash the test harness
      // itself rather than exercising what happens on the client side.
      socket.on('error', () => {});
      // Abruptly destroy the connection with an error right after it's
      // accepted — the client side sees this as a real socket 'error' event.
      socket.destroy(new Error('server-side abrupt close'));
    });
    await new Promise((resolve) => server.listen(socketPath, resolve));

    const client = new MpvIpcClient(socketPath);
    await client.connect();

    // Give the destroy() above a moment to actually propagate as a socket
    // error event on the client side before asserting nothing crashed.
    await new Promise((resolve) => setTimeout(resolve, 100));

    server.close();
    // Reaching here at all — instead of the test process dying from an
    // uncaught exception — is the assertion.
    assert.ok(true);
  },
);

// A command in flight when the connection dies used to just hang forever —
// nothing ever walked `pending` on close/error, so its promise never
// resolved or rejected. This is the real scenario: a hotkey sent right as
// the daemon dies.
test(
  'a command in flight when the connection closes rejects instead of hanging forever',
  async () => {
    const socketPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-ipc-test-')), 'test.sock');
    const server = net.createServer((socket) => {
      socket.on('error', () => {});
      // Accept the connection and the incoming command, but never respond —
      // then destroy the connection, simulating the daemon dying mid-request.
      socket.on('data', () => {
        socket.destroy();
      });
    });
    await new Promise((resolve) => server.listen(socketPath, resolve));

    const client = new MpvIpcClient(socketPath);
    await client.connect();

    await assert.rejects(() => client.send(['get_property', 'pause']), /mpv IPC connection closed/);

    server.close();
  },
);

test(
  'a new send() after the connection has closed rejects immediately as not connected',
  async () => {
    const socketPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-ipc-test-')), 'test.sock');
    const server = net.createServer((socket) => socket.destroy());
    await new Promise((resolve) => server.listen(socketPath, resolve));

    const client = new MpvIpcClient(socketPath);
    await client.connect();
    await new Promise((resolve) => client.once('close', resolve));

    await assert.rejects(() => client.send(['get_property', 'pause']), /mpv IPC client is not connected/);

    server.close();
  },
);
