var express = require('express');
var app = express();
var expressWs = require('express-ws')(app);
var os = require('os');
var pty = require('node-pty');

var terminals = {},
    logs = {};

app.use('/build', express.static(__dirname + '/../build'));

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

app.get('/style.css', function(req, res){
  res.sendFile(__dirname + '/style.css');
});

app.get('/main.js', function(req, res){
  res.sendFile(__dirname + '/main.js');
});

app.post('/terminals', function (req, res) {
  var cols = parseInt(req.query.cols),
      rows = parseInt(req.query.rows),
      cmd = req.query.cmd,
      args = req.query.args ? ['-v', '-c', cmd + ' ' + req.query.args] : [],
     term = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', args || [], {
    // term = pty.spawn("ls" , ['-l'], {       
	    name: 'xterm-color',
        cols: cols || 80,
        rows: rows || 24,
        cwd: process.env.PWD,
        env: process.env
    });
	   
  if(req.query.cmd === undefined || req.query.cmd === null){
	term.terminal = true;
  }
  
  console.log('Created terminal with PID: ' + term.pid);
  terminals[term.pid] = term;
  logs[term.pid] = '';
  term.on('data', function(data) {
    logs[term.pid] += data;
  });
  
  res.send(term.pid.toString());
  res.end();
});

app.post('/terminals/:pid/size', function (req, res) {
  var pid = parseInt(req.params.pid),
      cols = parseInt(req.query.cols),
      rows = parseInt(req.query.rows),
      term = terminals[pid];

  term.resize(cols, rows);
  console.log('Resized terminal ' + pid + ' to ' + cols + ' cols and ' + rows + ' rows.');
  res.end();
});

app.ws('/terminals/:pid', function (ws, req) {
  var term = terminals[parseInt(req.params.pid)];
  term.ws = ws;
  console.log('Connected to terminal ' + term.pid);
    ws.send(logs[term.pid]);
  Object.keys(terminals).map(function(key, index) {
	var t = terminals[key];
	if(t.terminal && t != term){
		t.ws.send(logs[term.pid]);
	}
  });
  term.on('data', function(data) {
    try {
      ws.send(data);
	  Object.keys(terminals).map(function(key, index) {
		var t = terminals[key];
		if(t.terminal && t != term){
			t.ws.send(data);
		}
	  });
    } catch (ex) {
      // The WebSocket is not open, ignore
    }
  });
  term.on('exit', function(exit) {
    console.log('exited', term.pid, 'code', exit);
	Object.keys(terminals).map(function(key, index) {
		var t = terminals[key];
		if(t.terminal){
			t.write('\r');
		}
	});
    ws.close(1000,exit+"");
	//ws.close(3001,'reason');
  });
  ws.on('message', function(msg) {
    term.write(msg);
  });
  ws.on('close', function () {
    term.kill();
    console.log('Closed terminal ' + term.pid);
    // Clean things up
    delete terminals[term.pid];
    delete logs[term.pid];
  });
});

var port = process.env.PORT || 3000,
    host = os.platform() === 'win32' ? '127.0.0.1' : '0.0.0.0';

console.log('App listening to http://' + host + ':' + port);
app.listen(port, host);
