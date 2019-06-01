/**
 * Copyright (c) 2014, 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Implements the attach method, that attaches the terminal to a WebSocket stream.
 */

import { Terminal, IDisposable } from 'xterm';


interface IAttachOptions {
  bidirectional?: boolean;
  inputUtf8?: boolean;
}


// TODO: This is temporary, link to xterm when the new version is published
export interface ITerminalAddon {
  activate(terminal: Terminal): void;
  dispose(): void;
}

// TODO: To be removed once UTF8 PR is in xterm.js package.
interface INewTerminal extends Terminal {
  writeUtf8(data: Uint8Array): void;
}


export class AttachAddon implements ITerminalAddon {
  private _socket: WebSocket;
  private _bidirectional: boolean;
  private _utf8: boolean;
  private _disposables: IDisposable[] = [];

  constructor(socket: WebSocket, options?: IAttachOptions) {
    this._socket = socket;
    // always set binary type to arraybuffer, we do not handle blobs
    this._socket.binaryType = 'arraybuffer';
    this._bidirectional = (options && options.bidirectional === false) ? false : true;
    this._utf8 = !!(options && options.inputUtf8);
  }

  public activate(terminal: Terminal): void {
    if (this._utf8) {
      this._disposables.push(addSocketListener(this._socket, 'message',
        (ev: MessageEvent | Event | CloseEvent) => (terminal as INewTerminal).writeUtf8(new Uint8Array((ev as any).data as ArrayBuffer))));
    } else {
      this._disposables.push(addSocketListener(this._socket, 'message',
        (ev: MessageEvent | Event | CloseEvent) => (terminal as INewTerminal).write((ev as any).data as string)));
    }

    if (this._bidirectional) {
      this._disposables.push(terminal.addDisposableListener('data', data => this._sendData(data)));
    }

    this._disposables.push(addSocketListener(this._socket, 'close', () => this.dispose()));
    this._disposables.push(addSocketListener(this._socket, 'error', () => this.dispose()));
  }

  public dispose(): void {
    this._disposables.forEach(d => d.dispose());
  }

  private _sendData(data: string): void {
    // TODO: do something better than just swallowing
    // the data if the socket is not in a working condition
    if (this._socket.readyState !== 1) {
      return;
    }
    this._socket.send(data);
  }
}

function addSocketListener(socket: WebSocket, type: string, handler: (this: WebSocket, ev: MessageEvent | Event | CloseEvent) => any): IDisposable {
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
