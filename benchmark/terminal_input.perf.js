const Terminal = require('../lib/Terminal').Terminal;
const pty = require('node-pty');
const perfContext = require('xterm-benchmark').perfContext;
const timeit = require('xterm-benchmark').timeit;
const before = require('xterm-benchmark').before;

class TestTerminal extends Terminal {
  writeSync(data) {
    this.writeBuffer.push(data);
    this._innerWrite();
  }
}

perfContext('terminal input throughput', () => {
  let content = '';

  // grab output from "ls -lR /usr/lib"
  before('', async () => {
    const p = pty.spawn('ls', ['-lR', '/usr/lib'], {
      name: 'xterm-color',
      cols: 80,
      rows: 25,
      cwd: process.env.HOME,
      env: process.env
    });
    let fromPty = '';
    p.on('data', data => { fromPty += data; });
    await new Promise(resolve => p.on('exit', () => resolve()));
    while (content.length < 50000000)  // test with +50MB
      content += fromPty;
  });

  timeit('JSArray no recycling', () => {
    const recycling = false;
    const impl = 'JSArray';
    const terminal = new TestTerminal({
      cols: 80,
      rows: 25,
      scrollback: 1000,
      experimentalBufferLineImpl: impl,
      experimentalPushRecycling: recycling
    });
    let start = new Date();
    terminal.writeSync(content);
    let duration = (new Date()) - (start);
    console.log({
      BufferLineType: impl,
      Recycling: recycling,
      Throughput: Number(1000/duration*content.length/1024/1024).toFixed(2) + ' MB/s',
      File: 'ls -lR /usr/lib',
      Duration: duration,
      Size: content.length
    });
  }, {isolated: true});

  timeit('JSArray with recycling', () => {
    const recycling = true;
    const impl = 'JSArray';
    const terminal = new TestTerminal({
      cols: 80,
      rows: 25,
      scrollback: 1000,
      experimentalBufferLineImpl: impl,
      experimentalPushRecycling: recycling
    });
    let start = new Date();
    terminal.writeSync(content);
    let duration = (new Date()) - (start);
    console.log({
      BufferLineType: impl,
      Recycling: recycling,
      Throughput: Number(1000/duration*content.length/1024/1024).toFixed(2) + ' MB/s',
      File: 'ls -lR /usr/lib',
      Duration: duration,
      Size: content.length
    });
  }, {isolated: true});

  timeit('TypedArray no recycling', () => {
    const recycling = false;
    const impl = 'TypedArray';
    const terminal = new TestTerminal({
      cols: 80,
      rows: 25,
      scrollback: 1000,
      experimentalBufferLineImpl: impl,
      experimentalPushRecycling: recycling
    });
    let start = new Date();
    terminal.writeSync(content);
    let duration = (new Date()) - (start);
    console.log({
      BufferLineType: impl,
      Recycling: recycling,
      Throughput: Number(1000/duration*content.length/1024/1024).toFixed(2) + ' MB/s',
      File: 'ls -lR /usr/lib',
      Duration: duration,
      Size: content.length
    });
  }, {isolated: true});

  timeit('TypedArray with recycling', () => {
    const recycling = true;
    const impl = 'TypedArray';
    const terminal = new TestTerminal({
      cols: 80,
      rows: 25,
      scrollback: 1000,
      experimentalBufferLineImpl: impl,
      experimentalPushRecycling: recycling
    });
    let start = new Date();
    terminal.writeSync(content);
    let duration = (new Date()) - (start);
    console.log({
      BufferLineType: impl,
      Recycling: recycling,
      Throughput: Number(1000/duration*content.length/1024/1024).toFixed(2) + ' MB/s',
      File: 'ls -lR /usr/lib',
      Duration: duration,
      Size: content.length
    });
  }, {isolated: true});
});
