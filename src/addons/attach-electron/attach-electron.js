/**
 * Implements the attach method, that attaches the terminal to a WebSocket stream.
 * @module xterm/addons/attach/attach
 * @license MIT
 */

(function (attach) {
  if (typeof exports === 'object' && typeof module === 'object') {
    /*
     * CommonJS environment
     */
    module.exports = attach(require('../../xterm'));
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
})(function (Xterm) {
  'use strict';

  var exports = {};

  /**
   * Attaches the given terminal to the given socket.
   *
   * @param {Xterm} term - The terminal to be attached to the given socket.
   * @param {ipcRenderer} socket - The ipc EventEmitter to attach the current terminal.
   * @param {channel} channel - The channel to use for ipc communication
   * @param {boolean} bidirectional - Whether the terminal should send data
   *                                  to the socket as well.
   * @param {boolean} buffered - Whether the rendering of incoming data
   *                             should happen instantly or at a maximum
   *                             frequency of 1 rendering per 10ms.
   */
  exports.attach = function (term, socket,channel, bidirectional, buffered) {
    bidirectional = (typeof bidirectional == 'undefined') ? true : bidirectional;
    channel = (typeof channel == 'undefined') ? 'xterm' : channel;
    term.socket = socket;

    term._flushBuffer = function () {
      term.write(term._attachSocketBuffer);
      term._attachSocketBuffer = null;
      clearTimeout(term._attachSocketBufferTimer);
      term._attachSocketBufferTimer = null;
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
      socket.send(channel, data);
    };

    socket.on(channel, term._getMessage);

    if (bidirectional) {
      term.on('data', term._sendData);
    }

  };

  /**
   * Detaches the given terminal from the given socket
   *
   * @param {Xterm} term - The terminal to be detached from the given socket.
   * @param {ipcRenderer} socket - The ipc EventEmitter to attach the current terminal.
   * @param {channel} channel - The channel to use for ipc communication
   */
  exports.detach = function (term, socket,channel) {
    term.off('data', term._sendData);

    socket = (typeof socket == 'undefined') ? term.socket : socket;
    channel = (typeof bidirectional == 'undefined') ? 'xterm' : channel;

    if (socket) {
      socket.removeListener(channel, term._getMessage);
    }

    delete term.socket;
  };

  /**
   * Attaches the current terminal to the given socket
   *
   * @param {ipcRenderer} socket - The ipc EventEmitter to attach the current terminal.
   * @param {channel} channel - The channel to use for ipc communication
   * @param {boolean} bidirectional - Whether the terminal should send data
   *                                  to the socket as well.
   * @param {boolean} buffered - Whether the rendering of incoming data
   *                             should happen instantly or at a maximum
   *                             frequency of 1 rendering per 10ms.
   */
  Xterm.prototype.attach = function (socket,channel, bidirectional, buffered) {
    return exports.attach(this, socket,channel, bidirectional, buffered);
  };

  /**
   * Detaches the current terminal from the given socket.
   *
   * @param {ipcRenderer} socket - The ipc EventEmitter to attach the current terminal.
   * @param {channel} channel - The channel to use for ipc communication
   */
  Xterm.prototype.detach = function (socket,channel) {
    return exports.detach(this, socket, channel);
  };

  return exports;
});
