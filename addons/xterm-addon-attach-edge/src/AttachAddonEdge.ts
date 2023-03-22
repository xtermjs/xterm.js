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

type TerminalMessage = {
  type: string;
  payload: string;
};

export class AttachAddonEdge implements ITerminalAddon {
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
        // TODO: unpack message
        console.log('received data', ev.data)
        const msg: TerminalMessage = JSON.parse(ev.data);
        if (msg.type == 'output') {
          // const data: ArrayBuffer | string = ev.data;
          const data: string = atob(msg.payload)
          console.log('received payload', data)
        terminal.write(typeof data === 'string' ? data : new Uint8Array(data));
        } else {
          // TODO: implement control messages
          console.log('received unknown message type', msg.type)
        }
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

  private toHex(str: string): string {
    let result = '';
    for (let i = 0; i < str.length; i++) {
      result += str.charCodeAt(i).toString(16);
    }
    return result;
  }

  private _sendData(data: string): void {
    console.log("entering _sendData")
    if (!this._checkOpenSocket()) {
      return;
    }
    // wrap in data object
    // const hexData = this.toHex(data);
    const msg: TerminalMessage = {type: 'input', payload: btoa(data)}
    const strData = JSON.stringify(msg);
    console.log("sending data", strData);
    this._socket.send(strData);
  }

  private _sendBinary(rawdata: string): void {
    // UPDATE: seems to be fine when using btoa/base64
    // TODO: parse as binary data by using, see https://github.com/xtermjs/xterm.js/pull/2566
    // Buffer.from(data, 'binary')
    console.log("entering _sendBinary")
    if (!this._checkOpenSocket()) {
      return;
    }
    // wrap in data object
    // const hexData = this.toHex(rawdata);
    const msg: TerminalMessage = {type: 'input', payload: btoa(rawdata)}
    // const data = `{"type:":"input","payload":"${hexData}"}`;
    const data = JSON.stringify(msg);

    console.log("sending data", data);
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
