var express = require('express');
var app = express();
var expressWs = require('express-ws')(app);
var os = require('os');
var pty = require('node-pty');

var terminals = {},
	logs = {};

app.use('/build', express.static(__dirname + '/../build'));

app.get('/', function (req, res) {
	res.sendFile(__dirname + '/index.html');
});

app.get('/style.css', function (req, res) {
	res.sendFile(__dirname + '/style.css');
});

app.get('/main.js', function (req, res) {
	res.sendFile(__dirname + '/main.js');
});

app.post('/terminals', function (req, res) {

	var term = createTerminal(req);
	
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
	console.log('Connected to terminal ' + term.pid + ' - terminal.name: ' + term.name);
	console.log('logs[term.pid]: ' + logs[term.pid]);
	ws.send(logs[term.pid]);

	var interactiveTerm = getTerminalForCmd(term);
	if (interactiveTerm) {
		if (interactiveTerm.cwd != term.cwd) {
			console.log('Entro al IF  app.ws(/terminals/:pid ----------interactiveTerm: ' + interactiveTerm.name);
			interactiveTerm.once('data', function (data) {
				try {
					interactiveTerm.ws.send(logs[term.pid]);
					interactiveTerm.disable = false;
				} catch (ex) {
					// The WebSocket is not open, ignore
					console.log('xxxxxxx Entro al catch');
				}
			});
			interactiveTerm.disable = true;
			interactiveTerm.write('cd ' + term.cwd + '\r');
		} else {
			console.log('Entro al ELSE  app.ws(/terminals/:pid ----------interactiveTerm: ' + interactiveTerm.name);
			interactiveTerm.ws.send(logs[term.pid]);
		}
	}

	var interactiveTerm = null;

	term.on('exit', function (exit) {
		console.log('exited', term.pid, 'code', exit);

		if (interactiveTerm) {
			interactiveTerm.write('cd ..\r');
			interactiveTerm.write('\r');
			interactiveTerm.used = false;
		}
		ws.close(1000, exit + "");
	});

	term.on('data', function (data) {
		try {
			ws.send(data);

			if (data.trim()) {
				if (!interactiveTerm) {
					interactiveTerm = getTerminalForCmd(term);
					if (interactiveTerm) {
						if (interactiveTerm.disable) {
							return;
						}
						console.log('    -----------------    ');
						console.log('  Send Output: ' + data);
						console.log('    -----------------    ');
						interactiveTerm.ws.send(data);
						interactiveTerm.used = true;
					}
				} else {
					interactiveTerm.ws.send(data);
				}
			}
		} catch (ex) {
			// The WebSocket is not open, ignore
		}
	});

	ws.on('message', function (msg) {
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


/*function getTerminalForCmd(term) {
	if(!term.interactiveTerm){
		var interactiveTerm=null;
		Object.keys(terminals).map(function(key, index) {
			var t = terminals[key];
			if(t.interactiveTerm && t!=term && !t.used){
				interactiveTerm = t;
			}
		});
		return interactiveTerm;
	}	
	return null;
}*/

function createTerminal(req){
	process.env.PROMPT_COMMAND = 'history -a; history -c; history -r';
	if(!process.env.HISTFILE){
		process.env.HISTFILE = '/.bash_history';
	}
	var cols = parseInt(req.query.cols),
		rows = parseInt(req.query.rows),
		cmd = req.query.cmd,
		//args = req.query.args ? ['-v', '-c', cmd + ' ' + req.query.args] : [],
		args = req.query.args ? ['-c', cmd + ' ' + req.query.args] : [],
		term = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', args || [], {
			// term = pty.spawn("ls" , ['-l'], {       
			name: 'xterm-color',
			cols: cols || 80,
			rows: rows || 24,
			cwd: req.query.cwd || process.env.PWD,
			env: process.env
		});

	if (req.query.cwd != undefined) {
		term.cwd = req.query.cwd;
	}

	if (req.query.cmd === undefined || req.query.cmd === null) {
		term.interactiveTerm = true;
	} else {
		term.interactiveTerm = false;
	}
	term.name = cmd;

	console.log('Created terminal with PID: ' + term.pid + ' - terminal.name: ' + term.name);
	terminals[term.pid] = term;
	logs[term.pid] = '';

	term.on('data', function (data) {
		logs[term.pid] += data;
	});
	
	if(!term.interactiveTerm){
		var argsHistory = ['-c', 'history -s \'' + cmd + ' ' + req.query.args + '\'; history -a $HISTFILE'];
		var termHistory = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', argsHistory || [], {
			name: 'xterm-color',
			cols: cols || 80,
			rows: rows || 24,
			cwd: req.query.cwd || process.env.PWD,
			env: process.env
		});
		
		
	/*termHistory.on('data', function (data) {
		try {
			console.log('           --------termHistory---------    ');
			console.log('          Send Output: ' + data);
			console.log('           -----------------------------    ');
		} catch (ex) {
			// The WebSocket is not open, ignore
		}
	});*/
	
	}
	
	
	return term;
	
}


function getTerminalForCmd(term) {
	if(!term.interactiveTerm){
		var interactiveTerm=null;
		Object.keys(terminals).map(function(key, index) {
			var t = terminals[key];
			if(t.interactiveTerm && t!=term && !t.used){
				interactiveTerm = t;
			}
		});
//		console.log('----------interactiveTerm: ' + interactiveTerm);
		if(!interactiveTerm){
			console.log('***** Need new console *****');
			
			var req = {query: {}};
			var newTerm = createTerminal(req);
			console.log('      -newTerm.pid: ' + newTerm.pid);
			
			term.ws.send("needConsole-" + newTerm.pid);
			newTerm.name = 'needConsole';
			interactiveTerm = newTerm;
		}
		return interactiveTerm;
	}	
	return null;
}


var port = process.env.PORT || 3000,
	host = os.platform() === 'win32' ? '127.0.0.1' : '0.0.0.0';

console.log('App listening to http://' + host + ':' + port);
app.listen(port, host);

