/**
 * Copyright (c) 2014, 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Implements the attach method, that attaches the terminal to a WebSocket stream.
 */

import { Terminal, IDisposable, ITerminalAddon } from 'xterm';
import { ThinProtocol, MessageType } from './ThinProtocol';

interface IAttachOptions {
  bidirectional?: boolean;
  inputUtf8?: boolean;
  flowControl?: number;
}

export class AttachAddon implements ITerminalAddon {
  private _socket: WebSocket;
  private _bidirectional: boolean;
  private _utf8: boolean;
  private _disposables: IDisposable[] = [];
  private _tp: ThinProtocol = new ThinProtocol();
  private _flowControl = 0;
  private _bytesSeen = 0;

  constructor(socket: WebSocket, options?: IAttachOptions) {
    this._socket = socket;
    // always set binary type to arraybuffer, we do not handle blobs
    this._socket.binaryType = 'arraybuffer';
    this._bidirectional = (options && options.bidirectional === false) ? false : true;
    this._utf8 = !!(options && options.inputUtf8);
    this._flowControl = (options && options.flowControl) ? Math.max(options.flowControl, 0) : 0;
  }

  public activate(terminal: Terminal): void {
    if (this._utf8) {
      this._disposables.push(this._flowControl
        ? addSocketListener(this._socket, 'message',
          (ev: MessageEvent | Event | CloseEvent) => {
            const bytes = new Uint8Array((ev as MessageEvent).data as ArrayBuffer);
            this._bytesSeen += bytes.length;
            if (this._bytesSeen > this._flowControl) {
              terminal.writeUtf8(bytes, () => this._socket.send(this._tp.ack()));
              this._bytesSeen = 0;
            } else {
              terminal.writeUtf8(bytes);
            }
          }
        )
        : addSocketListener(this._socket, 'message',
          (ev: MessageEvent | Event | CloseEvent) => terminal.writeUtf8(new Uint8Array((ev as MessageEvent).data as ArrayBuffer)))
      );
    } else {
      this._disposables.push(this._flowControl
        ? addSocketListener(this._socket, 'message',
          (ev: MessageEvent | Event | CloseEvent) => {
            this._bytesSeen += (ev as MessageEvent).data.length;
            if (this._bytesSeen > this._flowControl) {
              terminal.write((ev as MessageEvent).data as string, () => this._socket.send(this._tp.ack()));
              this._bytesSeen = 0;
            } else {
              terminal.write((ev as MessageEvent).data as string);
            }
          }
        )
        : addSocketListener(this._socket, 'message',
          (ev: MessageEvent | Event | CloseEvent) => terminal.write((ev as MessageEvent).data as string))
      );
    }

    if (this._bidirectional) {
      this._disposables.push(terminal.onData(data => this._sendData(data)));
    }

    this._disposables.push(addSocketListener(this._socket, 'close', () => this.dispose()));
    this._disposables.push(addSocketListener(this._socket, 'error', () => this.dispose()));

    // test binary
    let counter = 0;
    setInterval(() => {
      counter = (counter + 1) & 255;
      this._socket.send(this._tp.binary(String.fromCharCode(counter)));
    }, 100);
  }

  public dispose(): void {
    this._disposables.forEach(d => d.dispose());
    this._tp.clearIncomingHandler(MessageType.DATA);
    this._tp.clearIncomingHandler(MessageType.ACK);
  }

  private _sendData(data: string): void {
    // TODO: do something better than just swallowing
    // the data if the socket is not in a working condition
    if (this._socket.readyState !== 1) {
      return;
    }
    this._socket.send(this._tp.data(data));
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
