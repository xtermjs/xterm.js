/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * This file contains integration tests for xterm.js.
 */

import * as glob from 'glob';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as pty from 'node-pty';
import { Terminal } from './Terminal';
import { IViewport } from './Types';
import { CellData } from 'common/buffer/CellData';
import { WHITESPACE_CELL_CHAR } from 'common/buffer/Constants';

class TestTerminal extends Terminal {
  innerWrite(): void { this._innerWrite(); }
}

let primitivePty: any;

// fake sychronous pty write - read
// we just pipe the data from slave to master as a child program would do
// pty.js opens pipe fds with O_NONBLOCK
// just wait 10ms instead of setting fds to blocking mode
function ptyWriteRead(data: string, cb: (result: string) => void): void {
  fs.writeSync(primitivePty.slave, data);
  setTimeout(() => {
    const b = new Buffer(64000);
    const bytes = fs.readSync(primitivePty.master, b, 0, 64000, null);
    cb(b.toString('utf8', 0, bytes));
  });
}

// make sure raw pty is at x=0 and has no pending data
function ptyReset(cb: (result: string) => void): void {
    ptyWriteRead('\r\n', cb);
}

/* debug helpers */
// generate colorful noisy output to compare xterm and emulator cell states
function formatError(input: string, output: string, expected: string): string {
  function addLineNumber(start: number, color: string): (s: string) => string {
    let counter = start || 0;
    return function(s: string): string {
      counter += 1;
      return '\x1b[33m' + (' ' + counter).slice(-2) + color + s;
    };
  }
  const line80 = '12345678901234567890123456789012345678901234567890123456789012345678901234567890';
  let s = '';
  s += '\n\x1b[34m' + JSON.stringify(input);
  s += '\n\x1b[33m  ' + line80 + '\n';
  s += output.split('\n').map(addLineNumber(0, '\x1b[31m')).join('\n');
  s += '\n\x1b[33m  ' + line80 + '\n';
  s += expected.split('\n').map(addLineNumber(0, '\x1b[32m')).join('\n');
  return s;
}

// simple debug output of terminal cells
function terminalToString(term: Terminal): string {
  let result = '';
  let lineText = '';
  for (let line = term.buffer.ybase; line < term.buffer.ybase + term.rows; line++) {
    lineText = '';
    for (let cell = 0; cell < term.cols; ++cell) {
      lineText += term.buffer.lines.get(line).loadCell(cell, new CellData()).getChars() || WHITESPACE_CELL_CHAR;
    }
    // rtrim empty cells as xterm does
    lineText = lineText.replace(/\s+$/, '');
    result += lineText;
    result += '\n';
  }
  return result;
}

// Skip tests on Windows since pty.open isn't supported
if (os.platform() !== 'win32') {
  const consoleLog = console.log;

  // expect files need terminal at 80x25!
  const cols = 80;
  const rows = 25;

  /** some helpers for pty interaction */
  // we need a pty in between to get the termios decorations
  // for the basic test cases a raw pty device is enough
  primitivePty = (<any>pty).native.open(cols, rows);

  /** tests */
  describe('xterm output comparison', function(): void {
    this.timeout(10000);
    let xterm: TestTerminal;

    beforeEach(() => {
      xterm = new TestTerminal({ cols: cols, rows: rows });
      xterm.refresh = () => {};
      xterm.viewport = <IViewport>{
        syncScrollArea: () => {}
      };
    });

    // omit stack trace for escape sequence files
    Error.stackTraceLimit = 0;
    const files = glob.sync('**/escape_sequence_files/*.in', { cwd: path.join(__dirname, '..')});
    // only successful tests for now
    const skipFilename = [
      // 't0008-BS.in',
      // 't0014-CAN.in',
      // 't0015-SUB.in',
      // 't0017-SD.in',
      // 't0035-HVP.in',
      // 't0050-ICH.in',
      // 't0051-IL.in',
      // 't0052-DL.in',
      // 't0055-EL.in',
      't0056-ED.in',
      't0060-DECSC.in',
      't0061-CSI_s.in',
      't0070-DECSTBM_LF.in',
      't0071-DECSTBM_IND.in',
      't0072-DECSTBM_NEL.in',
      't0074-DECSTBM_SU_SD.in',
      't0075-DECSTBM_CUU_CUD.in',
      't0076-DECSTBM_IL_DL.in',
      't0077-DECSTBM_quirks.in',
      't0080-HT.in',
      't0082-HTS.in',
      't0083-CHT.in',
      't0084-CBT.in',
      // 't0090-alt_screen.in',
      't0091-alt_screen_ED3.in',
      // 't0092-alt_screen_DECSC.in',
      // 't0100-IRM.in',
      't0101-NLM.in',
      't0103-reverse_wrap.in',
      't0504-vim.in'
    ];
    if (os.platform() === 'darwin') {
      // These are failing on macOS only
      skipFilename.push(
        't0003-line_wrap.in',
        't0005-CR.in',
        't0009-NEL.in',
        't0503-zsh_ls_color.in'
      );
    }
    for (let i = 0; i < files.length; i++) {
      // if (skip.indexOf(i) >= 0) {
      //   continue;
      // }
      if (skipFilename.indexOf(files[i].split('/').slice(-1)[0]) >= 0) {
        continue;
      }
      ((filename: string) => {
        const inFile = fs.readFileSync(filename, 'utf8');
        it(filename.split('/').slice(-1)[0], done => {
          ptyReset(() => {
            ptyWriteRead(inFile, fromPty => {
              // uncomment this to get log from terminal
              // console.log = function(){};

              // Perform a synchronous .write(data)
              xterm.writeBuffer.push(fromPty);
              xterm.innerWrite();

              const fromEmulator = terminalToString(xterm);
              console.log = consoleLog;
              const expected = fs.readFileSync(filename.split('.')[0] + '.text', 'utf8');

              // Some of the tests have whitespace on the right of lines, we trim all the linex
              // from xterm.js so ignore this for now at least.
              const expectedRightTrimmed = expected.split('\n').map(l => l.replace(/\s+$/, '')).join('\n');
              if (fromEmulator !== expectedRightTrimmed) {
                // uncomment to get noisy output
                throw new Error(formatError(inFile, fromEmulator, expected));
              //   throw new Error('mismatch');
              }
              done();
            });
          });
        });
      })(files[i]);
    }
  });
}
