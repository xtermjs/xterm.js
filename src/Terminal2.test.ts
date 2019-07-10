/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as glob from 'glob';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as pty from 'node-pty';
import { Terminal } from './Terminal';

// all test files expect terminal in 80x25
const COLS = 80;
const ROWS = 25;

const TESTFILES = glob.sync('**/escape_sequence_files/*.in', { cwd: path.join(__dirname, '..')});
const SKIP_FILES = [
  // 't0008-BS.in',
  // 't0014-CAN.in',
  // 't0015-SUB.in',
  // 't0017-SD.in',
  // 't0035-HVP.in',
  // 't0050-ICH.in',
  // 't0051-IL.in',
  // 't0052-DL.in',
  // 't0055-EL.in',
  // 't0056-ED.in',
  // 't0060-DECSC.in',
  // 't0061-CSI_s.in',
  't0070-DECSTBM_LF.in',      // lineFeed not working correctly
  't0071-DECSTBM_IND.in',
  't0072-DECSTBM_NEL.in',
  // 't0074-DECSTBM_SU_SD.in',
  't0075-DECSTBM_CUU_CUD.in',
  't0076-DECSTBM_IL_DL.in',   // not working due to lineFeed
  't0077-DECSTBM_quirks.in',
  // 't0080-HT.in',
  // 't0082-HTS.in',
  // 't0083-CHT.in',
  't0084-CBT.in',
  // 't0090-alt_screen.in',
  // 't0091-alt_screen_ED3.in',
  // 't0092-alt_screen_DECSC.in',
  // 't0100-IRM.in',
  't0101-NLM.in',
  't0103-reverse_wrap.in',
  't0504-vim.in'

  // vttest related files
  // 't0300-vttest1.in'
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
const FILES = TESTFILES.filter(value => SKIP_FILES.indexOf(value.split('/').slice(-1)[0]) === -1);


describe('Escape Sequence Files', function(): void {
  this.timeout(20000);

  let ptyTerm: any = null;
  let slaveEnd: any = null;
  let term: Terminal;
  let customHandler: any = null;

  before(() => {
    ptyTerm = (pty as any).open({cols: COLS, rows: ROWS});
    slaveEnd = ptyTerm._slave;
    term = new Terminal({cols: COLS, rows: ROWS});
    ptyTerm._master.on('data', (data: string) => term.write(data));
  });

  after(() => {
    ptyTerm.end();
  });

  FILES.forEach(filename => {
    it(filename.split('/').slice(-1)[0], async () => {
      // reset terminal and handler
      if (customHandler) {
        customHandler.dispose();
      }
      slaveEnd.write('\r\n');
      term.reset();
      slaveEnd.write('\x1bc\x1b[H');

      // register handler to trigger viewport scraping, wait for it to finish
      let content = '';
      await new Promise(resolve => {
        customHandler = term.addOscHandler(12345, () => {
          // grab terminal viewport content
          content = terminalToString(term);
          resolve();
          return true;
        });
        // write file to slave
        slaveEnd.write(fs.readFileSync(filename, 'utf8'));
        // trigger custom sequence
        slaveEnd.write('\x1b]12345;\x07');
      });

      // compare with expected output (right trimmed)
      const expected = fs.readFileSync(filename.split('.')[0] + '.text', 'utf8');
      const expectedRightTrimmed = expected.split('\n').map(l => l.replace(/\s+$/, '')).join('\n');
      if (content !== expectedRightTrimmed) {
        throw new Error(formatError(fs.readFileSync(filename, 'utf8'), content, expected));
      }
    });
  });
});

/**
 * Helpers
 */

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
    lineText = term.buffer.lines.get(line).translateToString(true);
    // rtrim empty cells as xterm does
    lineText = lineText.replace(/\s+$/, '');
    result += lineText;
    result += '\n';
  }
  return result;
}
