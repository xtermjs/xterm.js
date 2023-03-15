/**
 * Copyright (c) 2014, 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Implements the attach method, that attaches the terminal to a WebSocket stream.
 */

import { Terminal, IDisposable, ITerminalAddon } from 'xterm';

interface IAttachOptions {
  bidirectional?: boolean;
}

export class AttachAddon implements ITerminalAddon {
  private _socket: WebSocket;
  private _bidirectional: boolean;
  private _disposables: IDisposable[] = [];

  constructor(socket: WebSocket, options?: IAttachOptions) {
    this._socket = socket;
    // always set binary type to arraybuffer, we do not handle blobs
    this._socket.binaryType = 'arraybuffer';
    this._bidirectional = !(options && options.bidirectional === false);
  }

  public activate(terminal: Terminal): void {
    this._disposables.push(
      addSocketListener(this._socket, 'message', ev => {
        const data: ArrayBuffer | string = ev.data;
        terminal.write(typeof data === 'string' ? data : new Uint8Array(data));
      })
    );

    if (this._bidirectional) {
      this._disposables.push(terminal.onData(data => this._sendData(data)));
      this._disposables.push(terminal.onBinary(data => this._sendBinary(data)));
    }

    this._disposables.push(addSocketListener(this._socket, 'close', () => this.dispose()));
    this._disposables.push(addSocketListener(this._socket, 'error', () => this.dispose()));
  }

  public dispose(): void {
    for (const d of this._disposables) {
      d.dispose();
    }
  }

  private _sendData(data: string): void {
    if (!this._checkOpenSocket()) {
      return;
    }
    this._socket.send(data);
  }

  private _sendBinary(data: string): void {
    if (!this._checkOpenSocket()) {
      return;
    }
    const buffer = new Uint8Array(data.length);
    for (let i = 0; i < data.length; ++i) {
      buffer[i] = data.charCodeAt(i) & 255;
    }
    this._socket.send(buffer);
  }

  private _checkOpenSocket(): boolean {
    switch (this._socket.readyState) {
      case WebSocket.OPEN:
        return true;
      case WebSocket.CONNECTING:
        throw new Error('Attach addon was loaded before socket was open');
      case WebSocket.CLOSING:
        console.warn('Attach addon socket is closing');
        return false;
      case WebSocket.CLOSED:
        throw new Error('Attach addon socket is closed');
      default:
        throw new Error('Unexpected socket state');
    }
  }
}

function addSocketListener<K extends keyof WebSocketEventMap>(socket: WebSocket, type: K, handler: (this: WebSocket, ev: WebSocketEventMap[K]) => any): IDisposable {
  socket.addEventListener(type, handler);
  return {
    dispose: () => {
      if (!handler) {
        // Already disposed
        return;
      }
      socket.removeEventListener(type, handler);
    }
  };
}
