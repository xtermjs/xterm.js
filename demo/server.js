var express = require('express');
var expressWs = require('express-ws');
var os = require('os');
var pty = require('node-pty');

/**
 * Whether to use UTF8 binary transport.
 * (Must also be switched in client.ts)
 */
const USE_BINARY_UTF8 = false;

// pty --> websocket buffering
const MAX_SEND_INTERVAL = 5;
const MAX_CHUNK_SIZE = 16384;


function startServer() {
  var app = express();
  expressWs(app);

  var terminals = {};

  app.use('/xterm.css', express.static(__dirname + '/../css/xterm.css'));
  app.get('/logo.png', (req, res) => res.sendFile(__dirname + '/logo.png'));

  app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
  });

  app.get('/test', function(req, res){
    res.sendFile(__dirname + '/test.html');
  });

  app.get('/style.css', function(req, res){
    res.sendFile(__dirname + '/style.css');
  });

  app.get('/dist/client-bundle.js', function(req, res){
    res.sendFile(__dirname + '/dist/client-bundle.js');
  });

  app.post('/terminals', function (req, res) {
    var cols = parseInt(req.query.cols),
        rows = parseInt(req.query.rows),
        term = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', [], {
          name: 'xterm-256color',
          cols: cols || 80,
          rows: rows || 24,
          cwd: process.env.PWD,
          env: process.env,
          encoding: USE_BINARY_UTF8 ? null : 'utf8',
          handleFlowControl: true,
          flowControlPause: '\x1b^pause\x1b\\',
          flowControlResume: '\x1b^resume\x1b\\'
        });

    console.log('Created terminal with PID: ' + term.pid);
    terminals[term.pid] = term;
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
    console.log('Connected to terminal ' + term.pid);

    const _send = data => {
      // handle only 'open' websocket state
      if (ws.readyState === 1) {
        setTimeout(() => ws.send(data), 200);
      }
    }

    const ACK_WATERMARK = 131072;//524288;
    const FLOW_CONTROL_ACK = '\x1b^ack\x1b\\'; // PM ack ST
    const MAX_ACK_DIFF = 7;
    let ack_expected = 0;
    let sent = 0;

    // string message buffering
    function buffer(timeout, limit) {
      let s = '';
      let sender = null;
      return (data) => {
        s += data;
        if (s.length > limit) {
          clearTimeout(sender);
          _send(s);
          s = '';
          sender = null;
        } else if (!sender) {
          sender = setTimeout(() => {
            _send(s);
            s = '';
            sender = null;
          }, timeout);
        }
      };
    }
    // binary message buffering
    function bufferUtf8(timeout, limit) {
      let buffer = [];
      let sender = null;
      let length = 0;
      return (data) => {
        buffer.push(data);
        length += data.length;
        if (length > limit) {
          clearTimeout(sender);
          _send(Buffer.concat(buffer, length));
          buffer = [];
          sender = null;
          length = 0;
        } else if (!sender) {
          sender = setTimeout(() => {
            _send(Buffer.concat(buffer, length));
            buffer = [];
            sender = null;
            length = 0;
          }, timeout);
        }
      };
    }
    const send = (USE_BINARY_UTF8 ? bufferUtf8 : buffer)(MAX_SEND_INTERVAL, MAX_CHUNK_SIZE);

    term.on('data', data => {
      send(data);
      sent += data.length;
      if (sent > ACK_WATERMARK) {
        ack_expected++;
        sent -= ACK_WATERMARK;
        if (ack_expected > MAX_ACK_DIFF) {
          term.pause();
        }
      }
    });

    ws.on('message', function(msg) {
      //console.log([msg, sent]);
      if (msg === FLOW_CONTROL_ACK) {
        ack_expected--;
        if (ack_expected <= MAX_ACK_DIFF) {
          term.resume();
        }
        return;
      }
      term.write(msg);
    });
    ws.on('close', function () {
      term.kill();
      console.log('Closed terminal ' + term.pid);
      // Clean things up
      delete terminals[term.pid];
    });
  });

  var port = process.env.PORT || 3000,
      host = os.platform() === 'win32' ? '127.0.0.1' : '0.0.0.0';

  console.log('App listening to http://127.0.0.1:' + port);
  app.listen(port, host);
}

module.exports = startServer;
