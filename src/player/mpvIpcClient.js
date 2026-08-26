import net from 'node:net';
import { EventEmitter } from 'node:events';
import { trace } from '../debugTrace.js';

// Proxy: stands in for the real mpv process across a socket, same call shape
// (send a command, get a result back) as if it were local — distinct from
// Player's Adapter role one layer up, which reshapes that interface into
// player-domain methods (pause/resume/next/...) rather than raw IPC calls.
// Thin JSON-IPC client for mpv's --input-ipc-server protocol: newline-delimited
// JSON in both directions. Works identically over a Unix socket (mac/linux)
// or a Windows named pipe — Node's net.connect abstracts the transport away,
// so this file never needs to know which OS it's running on.
export class MpvIpcClient extends EventEmitter {
  constructor(socketPath) {
    super();
    this.socketPath = socketPath;
    this.socket = null;
    this.buffer = '';
    this.pending = new Map();
    this.requestId = 0;
    // EventEmitter throws synchronously when 'error' is emitted with zero
    // listeners registered — confirmed nothing upstream (cli.js, Player,
    // Picker.jsx) currently listens for it, so a real socket error (the
    // daemon crashing mid-session, an ECONNRESET) would otherwise crash the
    // whole tv process. This is the safety net; a caller that wants to react
    // to it can still add its own 'error' listener too — both fire.
    this.on('error', (err) => trace(`MpvIpcClient: unhandled socket error: ${err.message}`));
  }

  connect() {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(this.socketPath);
      socket.once('connect', () => {
        this.socket = socket;
        socket.on('data', (chunk) => this._onData(chunk));
        socket.on('error', (err) => this.emit('error', err));
        // 'close' always fires after 'error' too (Node's own documented
        // socket behavior), so this one place covers every way the
        // connection can end — a graceful close(), the daemon crashing, or
        // any other socket error — without duplicating the same cleanup in
        // multiple handlers. this.socket is cleared here so send()'s own
        // "not connected" guard takes over immediately for anything called
        // after this, instead of trying to write to a dead socket.
        socket.on('close', () => {
          this.socket = null;
          this._rejectAllPending(new Error('mpv IPC connection closed'));
          this.emit('close');
        });
        resolve();
      });
      socket.once('error', reject);
    });
  }

  // A command in flight when the connection dies used to just hang forever —
  // its promise never resolved or rejected, since nothing walked `pending`
  // on close/error. Rejecting explicitly here means a hotkey sent right as
  // the daemon dies fails fast with a clear error instead.
  _rejectAllPending(err) {
    for (const { reject } of this.pending.values()) reject(err);
    this.pending.clear();
  }

  send(command) {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('mpv IPC client is not connected'));
        return;
      }
      const requestId = ++this.requestId;
      this.pending.set(requestId, { resolve, reject });
      const payload = `${JSON.stringify({ command, request_id: requestId })}\n`;
      this.socket.write(payload, (err) => {
        if (err) reject(err);
      });
    });
  }

  close() {
    if (this.socket) this.socket.end();
  }

  _onData(chunk) {
    this.buffer += chunk.toString('utf8');
    let newlineIndex = this.buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (line.trim()) this._onLine(line);
      newlineIndex = this.buffer.indexOf('\n');
    }
  }

  _onLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }

    if (message.request_id !== undefined && this.pending.has(message.request_id)) {
      const { resolve, reject } = this.pending.get(message.request_id);
      this.pending.delete(message.request_id);
      if (message.error && message.error !== 'success') reject(new Error(message.error));
      else resolve(message.data);
      return;
    }

    if (message.event) this.emit('mpv-event', message);
  }
}
