/*
 * Implements the attach method, that
 * attaches the terminal to a WebSocket stream.
 *
 * The bidirectional argument indicates, whether the terminal should
 * send data to the socket as well and is true, by default.
 */

(function (attach) {
    if (typeof define == 'function') {
        /*
         * Require.js is available
         */
        define(['../../src/xterm'], attach);
    } else {
        /*
         * Plain browser environment
         */
        attach(this.Xterm);
    }
})(function (Xterm) {
    Xterm.prototype.attach = function (socket, bidirectional, buffered) {
      var term = this;

      bidirectional = (typeof bidirectional == 'undefined') ? true : bidirectional;
      this.socket = socket;

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
        socket.send(data);
      };

      socket.addEventListener('message', term._getMessage);

      if (bidirectional) {
        this.on('data', term._sendData);
      }

      socket.addEventListener('close', term.detach.bind(term, socket));
      socket.addEventListener('error', term.detach.bind(term, socket));
    };

    Xterm.prototype.detach = function (socket) {
      var term = this;

      term.off('data', term._sendData);

      socket = (typeof socket == 'undefined') ? term.socket : socket;

      if (socket) {
        socket.removeEventListener('message', term._getMessage);
      }

      delete term.socket;
    };
});