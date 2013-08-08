/**
 * tty.js
 * Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)
 */

var http = require('http')
  , express = require('express')
  , io = require('socket.io')
  , pty = require('pty.js');

/**
 * tty.js
 */

process.title = 'tty.js';

/**
 * Open Terminal
 */

var buff = []
  , socket
  , term;

var term = pty.fork(process.env.SHELL || 'sh', [], {
  name: 'xterm',
  cols: 80,
  rows: 24,
  cwd: process.env.HOME
});

term.on('data', function(data) {
  return !socket
    ? buff.push(data)
    : socket.emit('data', data);
});

console.log(''
  + 'Created shell with pty master/slave'
  + ' pair (master: %d, pid: %d)',
  term.fd, term.pid);

/**
 * App & Server
 */

var app = express()
  , server = http.createServer(app);

app.use(function(req, res, next) {
  var setHeader = res.setHeader;
  res.setHeader = function(name) {
    switch (name) {
      case 'Cache-Control':
      case 'Last-Modified':
      case 'ETag':
        return;
    }
    return setHeader.apply(res, arguments);
  };
  next();
});

app.use(express.static(__dirname));
app.use(express.static(__dirname + '/../lib'));

server.listen(8080);

/**
 * Sockets
 */

io = io.listen(server);

io.configure(function() {
  io.disable('log');
});

io.sockets.on('connection', function(sock) {
  socket = sock;

  socket.on('data', function(data) {
    term.write(data);
  });

  socket.on('disconnect', function() {
    socket = null;
  });

  while (buff.length) {
    socket.emit('data', buff.shift());
  }
});
