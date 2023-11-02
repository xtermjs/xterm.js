/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as glob from 'glob';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as pty from 'node-pty';
import { Terminal } from 'browser/Terminal';
import { IDisposable } from '@xterm/xterm';

// all test files expect terminal in 80x25
const COLS = 80;
const ROWS = 25;

const TESTFILES = glob.sync('**/escape_sequence_files/*.in', { cwd: path.join(__dirname, '../..')});
const SKIP_FILES = [
  't0055-EL.in',            // EL/ED handle cursor at cols differently (see #3362)
  't0084-CBT.in',
  't0101-NLM.in',
  't0103-reverse_wrap.in',  // not comparable, we deviate from xterm reverse wrap on purpose
  't0504-vim.in'
];
if (os.platform() === 'darwin') {
  // These are failing on macOS only (termios related?)
  SKIP_FILES.push(
    't0003-line_wrap.in',
    't0005-CR.in',
    't0009-NEL.in',
    't0503-zsh_ls_color.in'
  );
}
// filter skipFilenames
const FILES = TESTFILES.filter(value => !SKIP_FILES.includes(value.split('/').slice(-1)[0]));

describe('Escape Sequence Files', function(): void {
  this.timeout(1000);

  let ptyTerm: any;
  let slaveEnd: any;
  let term: Terminal;
  let customHandler: IDisposable | undefined;

  before(() => {
    if (process.platform === 'win32') {
      return;
    }
    ptyTerm = (pty as any).open({cols: COLS, rows: ROWS});
    slaveEnd = ptyTerm._slave;
    term = new Terminal({cols: COLS, rows: ROWS});
    ptyTerm._master.on('data', (data: string) => term.write(data));
  });

  after(() => {
    if (process.platform === 'win32') {
      return;
    }
    ptyTerm._master.end();
    ptyTerm._master.destroy();
  });

  for (const filename of FILES) {
    (process.platform === 'win32' ? it.skip : it)(filename.split('/').slice(-1)[0], async () => {
      // reset terminal and handler
      if (customHandler) {
        customHandler.dispose();
      }
      slaveEnd.write('\r\n');
      term.reset();
      slaveEnd.write('\x1bc\x1b[H');

      // register handler to trigger viewport scraping, wait for it to finish
      let content = '';
      const OSC_CODE = 12345;
      await new Promise<void>(resolve => {
        customHandler = term.registerOscHandler(OSC_CODE, () => {
          // grab terminal viewport content
          content = terminalToString(term);
          resolve();
          return true;
        });
        // write file to slave
        slaveEnd.write(fs.readFileSync(filename, 'utf8'));
        // trigger custom sequence
        slaveEnd.write(`\x1b]${OSC_CODE};\x07`);
      });

      // compare with expected output (right trimmed)
      const expected = fs.readFileSync(filename.split('.')[0] + '.text', 'utf8');
      const expectedRightTrimmed = expected.split('\n').map(l => l.replace(/\s+$/, '')).join('\n');
      if (content !== expectedRightTrimmed) {
        throw new Error(formatError(fs.readFileSync(filename, 'utf8'), content, expected));
      }
    });
  }
});

/**
 * Helpers
 */

// generate colorful noisy output to compare xterm and emulator cell states
function formatError(input: string, output: string, expected: string): string {
  function addLineNumber(start: number, color: string): (s: string) => string {
    let counter = start || 0;
    return (s: string): string => {
      counter++;
      return '\x1b[33m' + (' ' + counter).slice(-2) + color + s;
    };
  }
  const line80 = '12345678901234567890123456789012345678901234567890123456789012345678901234567890';
  let s = '';
  s += `\n\x1b[34m${JSON.stringify(input)}`;
  s += `\n\x1b[33m  ${line80}\n`;
  s += output.split('\n').map(addLineNumber(0, '\x1b[31m')).join('\n');
  s += `\n\x1b[33m  ${line80}\n`;
  s += expected.split('\n').map(addLineNumber(0, '\x1b[32m')).join('\n');
  return s;
}

// simple debug output of terminal cells
function terminalToString(term: Terminal): string {
  let result = '';
  let lineText = '';
  for (let line = term.buffer.ybase; line < term.buffer.ybase + term.rows; line++) {
    lineText = term.buffer.lines.get(line)!.translateToString(true);
    // rtrim empty cells as xterm does
    lineText = lineText.replace(/\s+$/, '');
    result += lineText;
    result += '\n';
  }
  return result;
}
