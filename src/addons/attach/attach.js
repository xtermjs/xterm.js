/**
 * Copyright (c) 2014 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Implements the attach method, that attaches the terminal to a WebSocket stream.
 */

(function (attach) {
  if (typeof exports === 'object' && typeof module === 'object') {
    /*
     * CommonJS environment
     */
    module.exports = attach(require('../../Terminal').Terminal);
  } else if (typeof define == 'function') {
    /*
     * Require.js is available
     */
    define(['../../xterm'], attach);
  } else {
    /*
     * Plain browser environment
     */
    attach(window.Terminal);
  }
})(function (Terminal) {
  'use strict';

  var exports = {};

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
  exports.attach = function (term, socket, bidirectional, buffered) {
    bidirectional = (typeof bidirectional == 'undefined') ? true : bidirectional;
    term.socket = socket;

    term._flushBuffer = function () {
      term.write(term._attachSocketBuffer);
      term._attachSocketBuffer = null;
    };

    term._pushToBuffer = function (data) {
      if (term._attachSocketBuffer) {
        term._attachSocketBuffer += data;
      } else {
        term._attachSocketBuffer = data;
        setTimeout(term._flushBuffer, 10);
      }
    };

    term._getMessage = function (ev) {
      if (buffered) {
        term._pushToBuffer(ev.data);
      } else {
        term.write(ev.data);
      }
    };

    term._sendData = function (data) {
      socket.send(data);
    };

    socket.addEventListener('message', term._getMessage);

    if (bidirectional) {
      term.on('data', term._sendData);
    }

    socket.addEventListener('close', term.detach.bind(term, socket));
    socket.addEventListener('error', term.detach.bind(term, socket));
  };

  /**
   * Detaches the given terminal from the given socket
   *
   * @param {Terminal} term - The terminal to be detached from the given socket.
   * @param {WebSocket} socket - The socket from which to detach the current
   *                             terminal.
   */
  exports.detach = function (term, socket) {
    term.off('data', term._sendData);

    socket = (typeof socket == 'undefined') ? term.socket : socket;

    if (socket) {
      socket.removeEventListener('message', term._getMessage);
    }

    delete term.socket;
  };

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
  Terminal.prototype.attach = function (socket, bidirectional, buffered) {
    return exports.attach(this, socket, bidirectional, buffered);
  };

  /**
   * Detaches the current terminal from the given socket.
   *
   * @param {WebSocket} socket - The socket from which to detach the current
   *                             terminal.
   */
  Terminal.prototype.detach = function (socket) {
    return exports.detach(this, socket);
  };

  return exports;
});
