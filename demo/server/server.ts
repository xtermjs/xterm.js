/**
 * WARNING: This demo is a barebones implementation designed for development and evaluation
 * purposes only. It is definitely NOT production ready and does not aim to be so. Exposing the
 * demo to the public as is would introduce security risks for the host.
 */

import express from 'express';
import expressWs from 'express-ws';
import * as os from 'os';
import * as pty from 'node-pty';
import * as path from 'path';
import type { IPty } from 'node-pty';

interface IDisposable {
  dispose(): void;
}

/** Whether to use binary transport. */
const USE_BINARY = os.platform() !== 'win32';

const demoRoot = path.join(__dirname, '..');

function startServer(): void {
  const app = express();
  const appWs = expressWs(app).app;

  const terminals: { [pid: number]: IPty } = {};
  const unsentOutput: { [pid: number]: string } = {};
  const temporaryDisposable: { [pid: number]: IDisposable } = {};

  app.use('/xterm.css', express.static(demoRoot + '/../css/xterm.css'));
  app.get('/logo.png', (req, res) => {
    res.sendFile(demoRoot + '/logo.png');
  });

  app.get('/', (req, res) => {
    res.sendFile(demoRoot + '/index.html');
  });

  app.get('/test', (req, res) => {
    res.sendFile(demoRoot + '/test.html');
  });

  app.get('/index.css', (req, res) => {
    res.sendFile(demoRoot + '/index.css');
  });

  app.use('/dist', express.static(demoRoot + '/dist'));
  app.use('/src', express.static(demoRoot + '/src'));

  app.post('/terminals', (req, res) => {
    const env: { [key: string]: string } = {};
    for (const k of Object.keys(process.env)) {
      const v = process.env[k];
      if (v) {
        env[k] = v;
      }
    }
    env['COLORTERM'] = 'truecolor';
    if (typeof req.query.cols !== 'string' || typeof req.query.rows !== 'string') {
      console.error({ req });
      throw new Error('Unexpected query args');
    }
    const cols = parseInt(req.query.cols);
    const rows = parseInt(req.query.rows);
    const isWindows = process.platform === 'win32';
    const term = pty.spawn(isWindows ? 'powershell.exe' : 'bash', [], {
      name: 'xterm-256color',
      cols: cols ?? 80,
      rows: rows ?? 24,
      cwd: isWindows ? undefined : env.PWD,
      env,
      encoding: USE_BINARY ? null : 'utf8',
      useConpty: isWindows,
      useConptyDll: isWindows,
    });

    console.log('Created terminal with PID: ' + term.pid);
    terminals[term.pid] = term;
    unsentOutput[term.pid] = '';
    temporaryDisposable[term.pid] = term.onData(function(data) {
      unsentOutput[term.pid] += data;
    });
    res.send(term.pid.toString());
    res.end();
  });

  app.post('/terminals/:pid/size', (req, res) => {
    if (typeof req.query.cols !== 'string' || typeof req.query.rows !== 'string') {
      console.error({ req });
      throw new Error('Unexpected query args');
    }
    const pid = parseInt(req.params.pid);
    const cols = parseInt(req.query.cols);
    const rows = parseInt(req.query.rows);
    const term = terminals[pid];

    term.resize(cols, rows);
    console.log('Resized terminal ' + pid + ' to ' + cols + ' cols and ' + rows + ' rows.');
    res.end();
  });

  appWs.ws('/terminals/:pid', function (ws, req) {
    const term = terminals[parseInt(req.params.pid)];
    console.log('Connected to terminal ' + term.pid);
    temporaryDisposable[term.pid].dispose();
    delete temporaryDisposable[term.pid];
    ws.send(unsentOutput[term.pid]);
    delete unsentOutput[term.pid];

    // unbuffered delivery after user input
    let userInput = false;

    // string message buffering
    function buffer(socket: typeof ws, timeout: number, maxSize: number) {
      let s = '';
      let sender: ReturnType<typeof setTimeout> | null = null;
      return (data: string) => {
        s += data;
        if (s.length > maxSize || userInput) {
          userInput = false;
          socket.send(s);
          s = '';
          if (sender) {
            clearTimeout(sender);
            sender = null;
          }
        } else if (!sender) {
          sender = setTimeout(() => {
            socket.send(s);
            s = '';
            sender = null;
          }, timeout);
        }
      };
    }
    // binary message buffering
    function bufferUtf8(socket: typeof ws, timeout: number, maxSize: number) {
      const chunks: Buffer[] = [];
      let length = 0;
      let sender: ReturnType<typeof setTimeout> | null = null;
      return (data: Buffer) => {
        chunks.push(data);
        length += data.length;
        if (length > maxSize || userInput) {
          userInput = false;
          socket.send(Buffer.concat(chunks));
          chunks.length = 0;
          length = 0;
          if (sender) {
            clearTimeout(sender);
            sender = null;
          }
        } else if (!sender) {
          sender = setTimeout(() => {
            socket.send(Buffer.concat(chunks));
            chunks.length = 0;
            length = 0;
            sender = null;
          }, timeout);
        }
      };
    }
    const send = (USE_BINARY ? bufferUtf8 : buffer)(ws, 3, 262144);

    // WARNING: This is a naive implementation that will not throttle the flow of data. This means
    // it could flood the communication channel and make the terminal unresponsive. Learn more about
    // the problem and how to implement flow control at https://xtermjs.org/docs/guides/flowcontrol/
    term.onData(function(data) {
      try {
        send(data as string & Buffer);
      } catch {
        // The WebSocket is not open, ignore
      }
    });
    ws.on('message', function(msg) {
      term.write(msg.toString());
      userInput = true;
    });
    ws.on('close', function () {
      term.kill();
      console.log('Closed terminal ' + term.pid);
      // Clean things up
      delete terminals[term.pid];
    });
  });

  const port = parseInt(process.env.PORT ?? '3000');
  const host = os.platform() === 'win32' ? '127.0.0.1' : '0.0.0.0';

  console.log('App listening to http://127.0.0.1:' + port);
  app.listen(port, host, 0);
}

// HACK: There is an EPIPE error thrown when reloading a page. This only seems to happen on Windows
// and it's unclear why it happens. Suppressing the error here since this is just the demo server.
process.on('uncaughtException', (error) => {
  if (process.platform === 'win32' && error.message === 'read EPIPE') {
    return;
  }
});

export default startServer;
