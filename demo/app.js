"use strict";


var express   = require('express');

var app       = express();
var expressWs = require('express-ws')(app);
var os        = require('os');
var pty       = require('pty.js');


app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

app.get('/style.css', function(req, res){
  res.sendFile(__dirname + '/style.css');
});

app.get('/main.js', function(req, res){
  res.sendFile(__dirname + '/main.js');
});



app.ws("/", function(ws, req){

 var cols = parseInt(req.query.cols),
      rows = parseInt(req.query.rows),
      term = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', [], {
        name: 'xterm-color',
        cols: cols || 80,
        rows: rows || 24,
        cwd: process.env.PWD,
        env: process.env
      });

  var pid = term.pid;
  console.log('Created terminal with PID: %d', pid);

  term.on('data', function(data) {
    try {
      ws.send(data);
    } catch (ex) {
      // The WebSocket is not open, ignore
    }
  });

  ws.on('message', function(msg) {
    if(msg.$setSize) {

      term.resize(msg.cols, msg.rows);

      console.log('Resized terminal %d to %d cols and %d rows', pid, msg.cols, msg.rows);
      return;
    };

    term.write(msg);
  });


  ws.on('close', function () {
    process.kill(pid);
    console.log('Closed terminal %d', pid);
  });

});




var port = process.env.PORT || 3000,
    host = os.platform() === 'win32' ? '127.0.0.1' : '0.0.0.0';

console.log('App listening to http://' + host + ':' + port);
app.listen(port, host);
