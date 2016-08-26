var glob = require('glob');
var fs = require('fs');
var pty = require('pty.js');
var sleep = require('sleep');
var Terminal = require('../src/xterm');

var CONSOLE_LOG = console.log;

// expect files need terminal at 80x25!
var COLS = 80;
var ROWS = 25;

/** some helpers for pty interaction */
// we need a pty in between to get the termios decorations
// for the basic test cases a raw pty device is enough
var primitive_pty = pty.native.open(COLS, ROWS);

// fake sychronous pty write - read
// we just pipe the data from slave to master as a child program would do
// pty.js opens pipe fds with O_NONBLOCK
// just wait 10ms instead of setting fds to blocking mode
function pty_write_read(s) {
  fs.writeSync(primitive_pty.slave, s);
  sleep.usleep(10000);
  var b = Buffer(64000);
  var bytes = fs.readSync(primitive_pty.master, b, 0, 64000);
  return b.toString('utf8', 0, bytes);
}

// make sure raw pty is at x=0 and has no pending data
function pty_reset() {
    pty_write_read('\r\n');
}

/* debug helpers */
// generate colorful noisy output to compare xterm and emulator cell states
function formatError(in_, out_, expected) {
  function addLineNumber(start, color) {
    var counter = start || 0;
    return function(s) {
      counter += 1;
      return '\x1b[33m' + (' ' + counter).slice(-2) + color + s;
    }
  }
  var line80 = '12345678901234567890123456789012345678901234567890123456789012345678901234567890';
  var s = '';
  s += '\n\x1b[34m' + JSON.stringify(in_);
  s += '\n\x1b[33m  ' + line80 + '\n';
  s += out_.split('\n').map(addLineNumber(0, '\x1b[31m')).join('\n');
  s += '\n\x1b[33m  ' + line80 + '\n';
  s += expected.split('\n').map(addLineNumber(0, '\x1b[32m')).join('\n');
  return s;
}

// simple debug output of terminal cells
function terminalToString(term) {
  var result = '';
  var line_s = '';
  for (var line=0; line<term.rows; ++line) {
    line_s = '';
    for (var cell=0; cell<term.cols; ++cell) {
      line_s += term.lines[line][cell][1];
    }
    // rtrim empty cells as xterm does
    line_s = line_s.replace(/\s+$/, '');
    result += line_s;
    result += '\n';
  }
  return result;
}

/** tests */
describe('xterm output comparison', function() {
  var xterm;

  beforeEach(function () {
    xterm = new Terminal(COLS, ROWS);
    xterm.refresh = function() {};
  });

  // omit stack trace for escape sequence files
  Error.stackTraceLimit = 0;
  var files = glob.sync('test/escape_sequence_files/*.in');
  // only successful tests for now
  var successful = [0, 2, 6, 12, 13, 18, 20, 22, 27, 28];
  for (var a in successful) {
    var i = successful[a];
    (function(filename){
      it(filename.split('/').slice(-1)[0], function () {
        pty_reset();
        var in_file = fs.readFileSync(filename, 'utf8');
        var from_pty = pty_write_read(in_file);
        // uncomment this to get log from terminal
        console.log = function(){};
        xterm.write(from_pty);
        var from_emulator = terminalToString(xterm);
        console.log = CONSOLE_LOG;
        var expected = fs.readFileSync(filename.split('.')[0] + '.text', 'utf8');
        if (from_emulator != expected) {
          // uncomment to get noisy output
          //throw new Error(formatError(in_file, from_emulator, expected));
          throw new Error('mismatch');
        }
      });
    })(files[i]);
  }
});

