/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * This module provides methods for attaching a terminal to a terminado
 * WebSocket stream.
 */

/**
 * Attaches the given terminal to the given socket.
 *
 * @param {Terminal} term - The terminal to be attached to the given socket.
 * @param {WebSocket} socket - The socket to attach the current terminal.
 * @param {boolean} bidirectional - Whether the terminal should send data
 *                                  to the socket as well.
 * @param {boolean} buffered - Whether the rendering of incoming data
 *                             should happen instantly or at a maximum
 *                             frequency of 1 rendering per 10ms.
 */
export function terminadoAttach(term: any, socket: WebSocket, bidirectional: boolean, buffered: boolean): void {
  bidirectional = (typeof bidirectional === 'undefined') ? true : bidirectional;
  term.socket = socket;

  term._flushBuffer = () => {
    term.write(term._attachSocketBuffer);
    term._attachSocketBuffer = null;
  };

  term._pushToBuffer = (data) => {
    if (term._attachSocketBuffer) {
      term._attachSocketBuffer += data;
    } else {
      term._attachSocketBuffer = data;
      setTimeout(term._flushBuffer, 10);
    }
  };

  term._getMessage = (ev: MessageEvent) => {
    const data = JSON.parse(ev.data);
    if (data[0] === 'stdout') {
      if (buffered) {
        term._pushToBuffer(data[1]);
      } else {
        term.write(data[1]);
      }
    }
  };

  term._sendData = (data: string) => {
    socket.send(JSON.stringify(['stdin', data]));
  };

  term._setSize = (size: {rows: number, cols: number}) => {
    socket.send(JSON.stringify(['set_size', size.rows, size.cols]));
  };

  socket.addEventListener('message', term._getMessage);

  if (bidirectional) {
    term.on('data', term._sendData);
  }
  term.on('resize', term._setSize);

  socket.addEventListener('close', term.terminadoDetach.bind(term, socket));
  socket.addEventListener('error', term.terminadoDetach.bind(term, socket));
}

/**
 * Detaches the given terminal from the given socket
 *
 * @param {Xterm} term - The terminal to be detached from the given socket.
 * @param {WebSocket} socket - The socket from which to detach the current
 *                             terminal.
 */
export function terminadoDetach(term: any, socket: WebSocket): void {
  term.off('data', term._sendData);

  socket = (typeof socket === 'undefined') ? term.socket : socket;

  if (socket) {
    socket.removeEventListener('message', term._getMessage);
  }

  delete term.socket;
}

export function apply(terminalConstructor: any): void {
  /**
   * Attaches the current terminal to the given socket
   *
   * @param {WebSocket} socket - The socket to attach the current terminal.
   * @param {boolean} bidirectional - Whether the terminal should send data
   *                                  to the socket as well.
   * @param {boolean} buffered - Whether the rendering of incoming data
   *                             should happen instantly or at a maximum
   *                             frequency of 1 rendering per 10ms.
   */
  terminalConstructor.prototype.terminadoAttach = function(socket: WebSocket, bidirectional: boolean, buffered: boolean): void {
    return terminadoAttach(this, socket, bidirectional, buffered);
  };

  /**
   * Detaches the current terminal from the given socket.
   *
   * @param {WebSocket} socket - The socket from which to detach the current
   *                             terminal.
   */
  terminalConstructor.prototype.terminadoDetach = function(socket: WebSocket): void {
    return terminadoDetach(this, socket);
  };
}
