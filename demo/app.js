var express = require('express');
var app = express();
var expressWs = require('express-ws')(app);
var os = require('os');
var pty = require('node-pty');

var terminals = {},
	logs = {};

var server;

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
		
		//ws.removeListener('message', writeMsg);
		//interactiveTerm.ws.on('message', writeMsg)// esto es cuando el user escribe input en la interactive Term, redirijilo a cmdTerm ;
		interactiveTerm.cmdTerm=term

		server.send(JSON.stringify({type: 'status', status: 'running', interactiveTermPid: interactiveTerm.pid, termPid: term.pid, cmd: term.name}));

		if (interactiveTerm.cwd != term.cwd) {
			console.log('Entro al IF  app.ws(/terminals/:pid ----------interactiveTerm: ' + interactiveTerm.name);
			interactiveTerm.once('data', function (data) {
				try {
					interactiveTerm.ws.send(logs[term.pid]);
					interactiveTerm.disable = false;
				} catch (ex) {
					// The WebSocket is not open, ignore
				}
			});
			interactiveTerm.disable = true;
			interactiveTerm.write('cd ' + term.cwd + '\r');
		} else {
		//	console.log('Entro al ELSE  app.ws(/terminals/:pid ----------interactiveTerm: ' + interactiveTerm.name);
			interactiveTerm.ws.send(logs[term.pid]);
		}
	}

	var interactiveTerm = null;

	term.on('exit', function (exit) {
		console.log('exited', term.pid, 'code', exit);
		
	//	server.send("{type: 'status': pid: term.pid, exitCode: exit, exitMsg: msg}");
		console.log('-Server on term.on(exit -> ' + server);
		console.log('-interactiveTerm on term.on(exit -> ' + interactiveTerm);
		console.log('-term on term.on(exit -> ' + term);

		if (interactiveTerm) {

			if(exit==0){
				console.log('Entro al IF (exit==0): ');
				console.log('interactiveTerm ---> ' + interactiveTerm.pid);
				console.log('term ---> ' + term.pid);
				server.send(JSON.stringify({type: 'status', status: 'success', interactiveTermPid: interactiveTerm.pid, termPid: term.pid, cmd: term.name}));
			}else{
				console.log('Entro al ELSE: ' );
				console.log('interactiveTerm ---> ' + interactiveTerm.pid);
				console.log('term.pid ---> ' + term.pid);
				server.send(JSON.stringify({type: 'status', status: 'failed', interactiveTermPid: interactiveTerm.pid, termPid: term.pid, cmd: term.name}));
			}

			interactiveTerm.write('cd ..\r');
			interactiveTerm.write('\r');
			interactiveTerm.used = false;
			
		//	ws.on('message', writeMsg);
		//	interactiveTerm.ws.removeListener('message', writeMsg)
			interactiveTerm.cmdTerm=null
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

	
	
//	ws.on('message', writeMsg(term, msg));
	ws.on('message', function (msg) {
		console.log('-exited: ' + msg);
		server.send(JSON.stringify({type: 'removeStatus'}));
		if (term.cmdTerm){
			term.cmdTerm.write(msg);
		}else{
			term.write(msg);			
		}
	});
	
	ws.on('close', function () {
		term.kill();
		console.log('Closed terminal ' + term.pid);
		// Clean things up
		delete terminals[term.pid];
		delete logs[term.pid];
	});
});

/*function writeMsg(term, msg) {
	console.log('-------- writeMsg' + msg + '   term-' + term.name);
		term.write(msg);
	}*/

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
	term.name = cmd + ' ' + req.query.args;

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
			console.log('is term Selected????  --->  ' + t.selected);
			if(t.interactiveTerm && t!=term && !t.used && t.selected){
				interactiveTerm = t;
			}
		});
		
		if(!interactiveTerm){
			console.log('***** Need new console *****');
			
			var req = {query: {}};
			var newTerm = createTerminal(req);
			console.log('-newTerm.pid: ' + newTerm.pid);
			console.log('-Server: ' + server);

		//	server.send("needConsole-" + newTerm.pid);
			server.send(JSON.stringify({type: 'needConsole', pid: newTerm.pid}));

			console.log('-After send message to browser ');
			//term.ws.send("needConsole-" + newTerm.pid);
			newTerm.name = 'needConsole';
			interactiveTerm = newTerm;
		}
		console.log('-getTerminalForCmd()----- Return interactiveTerm: ' + interactiveTerm.pid);
		return interactiveTerm;
	}	

	console.log('-getTerminalForCmd()----- Return NULL: ');
	return null;
}


var port = process.env.PORT || 3000,
	host = os.platform() === 'win32' ? '127.0.0.1' : '0.0.0.0';

console.log('App listening to http://' + host + ':' + port);
app.listen(port, host);


app.ws('/controller', function (ws, req) {
	console.log('Entry to app.ws(/controller...) ');
	server = ws;

	server.on('message', function (msg) {
		message = JSON.parse(msg);
		
		console.log('message.type ---------->>>> ' +  message.type);
		console.log('message.pid ---------->>>> ' +  message.pid);

		if (message.type == 'selected') {
		  //ietrals el array de  terminals y le setes selected al que esta y no selected al resto asi lo puedes usar a ese field para buscar el getTerminalForCmd
			Object.keys(terminals).map(function(key, index) {
				var t = terminals[key];
				if(message.pid==t.pid){
					console.log('message.pid == t.pid ' +  t.pid);
					t.selected = true;
				}else{
					console.log('message.pid <> t.pid---------->>>>  -message.pid:' + message.pid + ' <> -t.pid:' +  t.pid );
					t.selected = false;					
				}
			});
		  }
	  
	})

});



