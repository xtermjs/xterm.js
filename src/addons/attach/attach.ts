/**
 * Copyright (c) 2014 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Implements the attach method, that attaches the terminal to a WebSocket stream.
 */

import { Terminal, IDisposable } from 'xterm';
import { IAttachAddonTerminal } from './Interfaces';

/**
 * Attaches the given terminal to the given socket.
 *
 * @param term The terminal to be attached to the given socket.
 * @param socket The socket to attach the current terminal.
 * @param bidirectional Whether the terminal should send data to the socket as well.
 * @param buffered Whether the rendering of incoming data should happen instantly or at a maximum
 * frequency of 1 rendering per 10ms.
 */
export function attach(term: Terminal, socket: WebSocket, bidirectional: boolean, buffered: boolean): void {
  const addonTerminal = <IAttachAddonTerminal>term;
  bidirectional = (typeof bidirectional === 'undefined') ? true : bidirectional;
  addonTerminal.__socket = socket;

  addonTerminal.__getMessage = function(ev: MessageEvent): void {
    if (ev.data instanceof ArrayBuffer) {
      if (!ev.data.byteLength) {
        return;
      }
      addonTerminal.writeBytes(new Uint8Array(ev.data));
    }
  };

  addonTerminal.__sendData = (data: string) => {
    if (socket.readyState !== 1) {
      return;
    }
    socket.send(data);
  };

  addonTerminal._core.register(addSocketListener(socket, 'message', addonTerminal.__getMessage));

  if (bidirectional) {
    addonTerminal._core.register(addonTerminal.addDisposableListener('data', addonTerminal.__sendData));
  }

  addonTerminal._core.register(addSocketListener(socket, 'close', () => detach(addonTerminal, socket)));
  addonTerminal._core.register(addSocketListener(socket, 'error', () => detach(addonTerminal, socket)));
}

function addSocketListener(socket: WebSocket, type: string, handler: (this: WebSocket, ev: Event) => any): IDisposable {
  socket.addEventListener(type, handler);
  return {
    dispose: () => {
      if (!handler) {
        // Already disposed
        return;
      }
      socket.removeEventListener(type, handler);
      handler = null;
    }
  };
}

/**
 * Detaches the given terminal from the given socket
 *
 * @param term The terminal to be detached from the given socket.
 * @param socket The socket from which to detach the current terminal.
 */
export function detach(term: Terminal, socket: WebSocket): void {
  const addonTerminal = <IAttachAddonTerminal>term;
  addonTerminal.off('data', addonTerminal.__sendData);

  socket = (typeof socket === 'undefined') ? addonTerminal.__socket : socket;

  if (socket) {
    socket.removeEventListener('message', addonTerminal.__getMessage);
  }

  delete addonTerminal.__socket;
}


export function apply(terminalConstructor: typeof Terminal): void {
  /**
   * Attaches the current terminal to the given socket
   *
   * @param socket The socket to attach the current terminal.
   * @param bidirectional Whether the terminal should send data to the socket as well.
   * @param buffered Whether the rendering of incoming data should happen instantly or at a maximum
   * frequency of 1 rendering per 10ms.
   */
  (<any>terminalConstructor.prototype).attach = function (socket: WebSocket, bidirectional: boolean, buffered: boolean): void {
    attach(this, socket, bidirectional, buffered);
  };

  /**
   * Detaches the current terminal from the given socket.
   *
   * @param socket The socket from which to detach the current terminal.
   */
  (<any>terminalConstructor.prototype).detach = function (socket: WebSocket): void {
    detach(this, socket);
  };
}
