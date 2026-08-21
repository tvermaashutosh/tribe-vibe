import net from 'node:net';
import { EventEmitter } from 'node:events';

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
  }

  connect() {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(this.socketPath);
      socket.once('connect', () => {
        this.socket = socket;
        socket.on('data', (chunk) => this._onData(chunk));
        socket.on('error', (err) => this.emit('error', err));
        socket.on('close', () => this.emit('close'));
        resolve();
      });
      socket.once('error', reject);
    });
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
