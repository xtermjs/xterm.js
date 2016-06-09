var express = require('express');
var app = express();
var expressWs = require('express-ws')(app);
var pty = require('pty.js');

app.use('/src', express.static(__dirname + '/../src'));
app.use('/addons', express.static(__dirname + '/../addons'));

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

app.get('/style.css', function(req, res){
  res.sendFile(__dirname + '/style.css');
});

app.get('/main.js', function(req, res){
  res.sendFile(__dirname + '/main.js');
});

app.ws('/bash', function(ws, req) {
  /**
   * Open bash terminal and attach it
   */
  var term = pty.spawn('bash', [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: process.env.PWD,
    env: process.env
  });
  term.on('data', function(data) {
    try {
      ws.send(data);
    } catch (ex) {
      // The WebSocket is not open, ignore
    }
  });
  ws.on('message', function(msg) {
    term.write(msg);
  });
  ws.on('close', function () {
    console.log('close');
    process.kill(term.pid);
  });
});

var port = process.env.PORT || 3000,
    host = '0.0.0.0';

console.log('App listening to http://' + host + ':' + port);
app.listen(port, host);
