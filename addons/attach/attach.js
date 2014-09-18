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
    Xterm.prototype.attach = function (socket, bidirectional) {
      var term = this;

      bidirectional = (typeof bidirectional == 'undefined') ? true : bidirectional;
      this.socket = socket;

      term._getMessage = function (ev) {
        term.write(ev.data);
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