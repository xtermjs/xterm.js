/*
 * Implements the attach method, that
 * attaches the terminal to a WebSocket stream.
 * 
 * The bidirectional argument indicates, whether the terminal should
 * send data to the socket as well and is true, by default.
 */
Terminal.prototype.attach = function (socket, bidirectional) {
  var term = this;
  
  bidirectional = (typeof bidirectional == 'undefined') ? true : bidirectional;
  this.socket = socket;
  
  socket.addEventListener('message', function (ev) {
    term.write(ev.data);
  });
  
  if (bidirectional) {
    this.on('data', function (data) {
      socket.send(data);
    });
  }
}