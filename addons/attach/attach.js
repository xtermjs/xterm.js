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

      function _getMessage (ev) {
        term.write(ev.data);
      }
        
      function _sendData (data) {
        socket.send(data);
      }
        
      function _detach () {
        term.off('data', _sendData);
        socket.removeEventListener('message', _getMessage);
      }

      socket.addEventListener('message', _getMessage);

      if (bidirectional) {
        this.on('data', _sendData);
      }
      
      socket.addEventListener('close', _detach);
      socket.addEventListener('error', _detach);
    };
});