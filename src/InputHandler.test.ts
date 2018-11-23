/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert, expect } from 'chai';
import { InputHandler } from './InputHandler';
import { MockInputHandlingTerminal } from './utils/TestUtils.test';
import { NULL_CELL_CHAR, NULL_CELL_CODE, NULL_CELL_WIDTH, CHAR_DATA_CHAR_INDEX, CHAR_DATA_ATTR_INDEX, DEFAULT_ATTR } from './Buffer';
import { Terminal } from './Terminal';
import { IBufferLine } from './Types';


// TODO: This and the sections related to this object in associated tests can be
// removed safely after InputHandler refactors are finished
class OldInputHandler extends InputHandler {
  public eraseInLine(params: number[]): void {
    switch (params[0]) {
      case 0:
        this.eraseRight(this._terminal.buffer.x, this._terminal.buffer.y);
        break;
      case 1:
        this.eraseLeft(this._terminal.buffer.x, this._terminal.buffer.y);
        break;
      case 2:
        this.eraseLine(this._terminal.buffer.y);
        break;
    }
  }

  public eraseInDisplay(params: number[]): void {
    let j;
    switch (params[0]) {
      case 0:
        this.eraseRight(this._terminal.buffer.x, this._terminal.buffer.y);
        j = this._terminal.buffer.y + 1;
        for (; j < this._terminal.rows; j++) {
          this.eraseLine(j);
        }
        break;
      case 1:
        this.eraseLeft(this._terminal.buffer.x, this._terminal.buffer.y);
        j = this._terminal.buffer.y;
        while (j--) {
          this.eraseLine(j);
        }
        break;
      case 2:
        j = this._terminal.rows;
        while (j--) this.eraseLine(j);
        break;
      case 3:
        // Clear scrollback (everything not in viewport)
        const scrollBackSize = this._terminal.buffer.lines.length - this._terminal.rows;
        if (scrollBackSize > 0) {
          this._terminal.buffer.lines.trimStart(scrollBackSize);
          this._terminal.buffer.ybase = Math.max(this._terminal.buffer.ybase - scrollBackSize, 0);
          this._terminal.buffer.ydisp = Math.max(this._terminal.buffer.ydisp - scrollBackSize, 0);
          // Force a scroll event to refresh viewport
          this._terminal.emit('scroll', 0);
        }
        break;
    }
  }

  /**
   * Erase in the identified line everything from "x" to the end of the line (right).
   * @param x The column from which to start erasing to the end of the line.
   * @param y The line in which to operate.
   */
  public eraseRight(x: number, y: number): void {
    const line = this._terminal.buffer.lines.get(this._terminal.buffer.ybase + y);
    if (!line) {
      return;
    }
    line.replaceCells(x, this._terminal.cols, [this._terminal.eraseAttr(), NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]);
    this._terminal.updateRange(y);
  }

  /**
   * Erase in the identified line everything from "x" to the start of the line (left).
   * @param x The column from which to start erasing to the start of the line.
   * @param y The line in which to operate.
   */
  public eraseLeft(x: number, y: number): void {
    const line = this._terminal.buffer.lines.get(this._terminal.buffer.ybase + y);
    if (!line) {
      return;
    }
    line.replaceCells(0, x + 1, [this._terminal.eraseAttr(), NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]);
    this._terminal.updateRange(y);
  }

  /**
   * Erase all content in the given line
   * @param y The line to erase all of its contents.
   */
  public eraseLine(y: number): void {
    this.eraseRight(0, y);
  }

  public insertChars(params: number[]): void {
    let param = params[0];
    if (param < 1) param = 1;

    // make buffer local for faster access
    const buffer = this._terminal.buffer;

    const row = buffer.y + buffer.ybase;
    let j = buffer.x;
    while (param-- && j < this._terminal.cols) {
      buffer.lines.get(row).insertCells(j++, 1, [this._terminal.eraseAttr(), NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]);
    }
  }

  public deleteChars(params: number[]): void {
    let param: number = params[0];
    if (param < 1) {
      param = 1;
    }

    // make buffer local for faster access
    const buffer = this._terminal.buffer;

    const row = buffer.y + buffer.ybase;
    while (param--) {
      buffer.lines.get(row).deleteCells(buffer.x, 1, [this._terminal.eraseAttr(), NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]);
    }
    this._terminal.updateRange(buffer.y);
  }
}

describe('InputHandler', () => {
  describe('save and restore cursor', () => {
    const terminal = new MockInputHandlingTerminal();
    terminal.buffer.x = 1;
    terminal.buffer.y = 2;
    terminal.curAttr = 3;
    const inputHandler = new InputHandler(terminal);
    // Save cursor position
    inputHandler.saveCursor([]);
    assert.equal(terminal.buffer.x, 1);
    assert.equal(terminal.buffer.y, 2);
    assert.equal(terminal.curAttr, 3);
    // Change cursor position
    terminal.buffer.x = 10;
    terminal.buffer.y = 20;
    terminal.curAttr = 30;
    // Restore cursor position
    inputHandler.restoreCursor([]);
    assert.equal(terminal.buffer.x, 1);
    assert.equal(terminal.buffer.y, 2);
    assert.equal(terminal.curAttr, 3);
  });
  describe('setCursorStyle', () => {
    it('should call Terminal.setOption with correct params', () => {
      const terminal = new MockInputHandlingTerminal();
      const inputHandler = new InputHandler(terminal);
      const collect = ' ';

      inputHandler.setCursorStyle([0], collect);
      assert.equal(terminal.options['cursorStyle'], 'block');
      assert.equal(terminal.options['cursorBlink'], true);

      terminal.options = {};
      inputHandler.setCursorStyle([1], collect);
      assert.equal(terminal.options['cursorStyle'], 'block');
      assert.equal(terminal.options['cursorBlink'], true);

      terminal.options = {};
      inputHandler.setCursorStyle([2], collect);
      assert.equal(terminal.options['cursorStyle'], 'block');
      assert.equal(terminal.options['cursorBlink'], false);

      terminal.options = {};
      inputHandler.setCursorStyle([3], collect);
      assert.equal(terminal.options['cursorStyle'], 'underline');
      assert.equal(terminal.options['cursorBlink'], true);

      terminal.options = {};
      inputHandler.setCursorStyle([4], collect);
      assert.equal(terminal.options['cursorStyle'], 'underline');
      assert.equal(terminal.options['cursorBlink'], false);

      terminal.options = {};
      inputHandler.setCursorStyle([5], collect);
      assert.equal(terminal.options['cursorStyle'], 'bar');
      assert.equal(terminal.options['cursorBlink'], true);

      terminal.options = {};
      inputHandler.setCursorStyle([6], collect);
      assert.equal(terminal.options['cursorStyle'], 'bar');
      assert.equal(terminal.options['cursorBlink'], false);
    });
  });
  describe('setMode', () => {
    it('should toggle Terminal.bracketedPasteMode', () => {
      const terminal = new MockInputHandlingTerminal();
      const collect = '?';
      terminal.bracketedPasteMode = false;
      const inputHandler = new InputHandler(terminal);
      // Set bracketed paste mode
      inputHandler.setMode([2004], collect);
      assert.equal(terminal.bracketedPasteMode, true);
      // Reset bracketed paste mode
      inputHandler.resetMode([2004], collect);
      assert.equal(terminal.bracketedPasteMode, false);
    });
  });
  describe('regression tests', function(): void {
    function lineContent(line: IBufferLine): string {
      let content = '';
      for (let i = 0; i < line.length; ++i) content += line.get(i)[CHAR_DATA_CHAR_INDEX];
      return content;
    }

    function termContent(term: Terminal): string[] {
      const result = [];
      for (let i = 0; i < term.rows; ++i) result.push(lineContent(term.buffer.lines.get(i)));
      return result;
    }

    it('insertChars', function(): void {
      const term = new Terminal();
      const inputHandler = new InputHandler(term);
      const oldInputHandler = new OldInputHandler(term);

      // insert some data in first and second line
      inputHandler.parse(Array(term.cols - 9).join('a'));
      inputHandler.parse('1234567890');
      inputHandler.parse(Array(term.cols - 9).join('a'));
      inputHandler.parse('1234567890');
      const line1: IBufferLine = term.buffer.lines.get(0); // line for old variant
      const line2: IBufferLine = term.buffer.lines.get(1); // line for new variant
      expect(lineContent(line1)).equals(Array(term.cols - 9).join('a') + '1234567890');
      expect(lineContent(line2)).equals(Array(term.cols - 9).join('a') + '1234567890');

      // insert one char from params = [0]
      term.buffer.y = 0;
      term.buffer.x = 70;
      oldInputHandler.insertChars([0]);
      expect(lineContent(line1)).equals(Array(term.cols - 9).join('a') + ' 123456789');
      term.buffer.y = 1;
      term.buffer.x = 70;
      inputHandler.insertChars([0]);
      expect(lineContent(line2)).equals(Array(term.cols - 9).join('a') + ' 123456789');
      expect(lineContent(line2)).equals(lineContent(line1));

      // insert one char from params = [1]
      term.buffer.y = 0;
      term.buffer.x = 70;
      oldInputHandler.insertChars([1]);
      expect(lineContent(line1)).equals(Array(term.cols - 9).join('a') + '  12345678');
      term.buffer.y = 1;
      term.buffer.x = 70;
      inputHandler.insertChars([1]);
      expect(lineContent(line2)).equals(Array(term.cols - 9).join('a') + '  12345678');
      expect(lineContent(line2)).equals(lineContent(line1));

      // insert two chars from params = [2]
      term.buffer.y = 0;
      term.buffer.x = 70;
      oldInputHandler.insertChars([2]);
      expect(lineContent(line1)).equals(Array(term.cols - 9).join('a') + '    123456');
      term.buffer.y = 1;
      term.buffer.x = 70;
      inputHandler.insertChars([2]);
      expect(lineContent(line2)).equals(Array(term.cols - 9).join('a') + '    123456');
      expect(lineContent(line2)).equals(lineContent(line1));

      // insert 10 chars from params = [10]
      term.buffer.y = 0;
      term.buffer.x = 70;
      oldInputHandler.insertChars([10]);
      expect(lineContent(line1)).equals(Array(term.cols - 9).join('a') + '          ');
      term.buffer.y = 1;
      term.buffer.x = 70;
      inputHandler.insertChars([10]);
      expect(lineContent(line2)).equals(Array(term.cols - 9).join('a') + '          ');
      expect(lineContent(line2)).equals(lineContent(line1));
    });
    it('deleteChars', function(): void {
      const term = new Terminal();
      const inputHandler = new InputHandler(term);
      const oldInputHandler = new OldInputHandler(term);

      // insert some data in first and second line
      inputHandler.parse(Array(term.cols - 9).join('a'));
      inputHandler.parse('1234567890');
      inputHandler.parse(Array(term.cols - 9).join('a'));
      inputHandler.parse('1234567890');
      const line1: IBufferLine = term.buffer.lines.get(0); // line for old variant
      const line2: IBufferLine = term.buffer.lines.get(1); // line for new variant
      expect(lineContent(line1)).equals(Array(term.cols - 9).join('a') + '1234567890');
      expect(lineContent(line2)).equals(Array(term.cols - 9).join('a') + '1234567890');

      // delete one char from params = [0]
      term.buffer.y = 0;
      term.buffer.x = 70;
      oldInputHandler.deleteChars([0]);
      expect(lineContent(line1)).equals(Array(term.cols - 9).join('a') + '234567890 ');
      term.buffer.y = 1;
      term.buffer.x = 70;
      inputHandler.deleteChars([0]);
      expect(lineContent(line2)).equals(Array(term.cols - 9).join('a') + '234567890 ');
      expect(lineContent(line2)).equals(lineContent(line1));

      // insert one char from params = [1]
      term.buffer.y = 0;
      term.buffer.x = 70;
      oldInputHandler.deleteChars([1]);
      expect(lineContent(line1)).equals(Array(term.cols - 9).join('a') + '34567890  ');
      term.buffer.y = 1;
      term.buffer.x = 70;
      inputHandler.deleteChars([1]);
      expect(lineContent(line2)).equals(Array(term.cols - 9).join('a') + '34567890  ');
      expect(lineContent(line2)).equals(lineContent(line1));

      // insert two chars from params = [2]
      term.buffer.y = 0;
      term.buffer.x = 70;
      oldInputHandler.deleteChars([2]);
      expect(lineContent(line1)).equals(Array(term.cols - 9).join('a') + '567890    ');
      term.buffer.y = 1;
      term.buffer.x = 70;
      inputHandler.deleteChars([2]);
      expect(lineContent(line2)).equals(Array(term.cols - 9).join('a') + '567890    ');
      expect(lineContent(line2)).equals(lineContent(line1));

      // insert 10 chars from params = [10]
      term.buffer.y = 0;
      term.buffer.x = 70;
      oldInputHandler.deleteChars([10]);
      expect(lineContent(line1)).equals(Array(term.cols - 9).join('a') + '          ');
      term.buffer.y = 1;
      term.buffer.x = 70;
      inputHandler.deleteChars([10]);
      expect(lineContent(line2)).equals(Array(term.cols - 9).join('a') + '          ');
      expect(lineContent(line2)).equals(lineContent(line1));
    });
    it('eraseInLine', function(): void {
      const term = new Terminal();
      const inputHandler = new InputHandler(term);
      const oldInputHandler = new OldInputHandler(term);

      // fill 6 lines to test 3 different states
      inputHandler.parse(Array(term.cols + 1).join('a'));
      inputHandler.parse(Array(term.cols + 1).join('a'));
      inputHandler.parse(Array(term.cols + 1).join('a'));
      inputHandler.parse(Array(term.cols + 1).join('a'));
      inputHandler.parse(Array(term.cols + 1).join('a'));
      inputHandler.parse(Array(term.cols + 1).join('a'));

      // params[0] - right erase
      term.buffer.y = 0;
      term.buffer.x = 70;
      oldInputHandler.eraseInLine([0]);
      expect(lineContent(term.buffer.lines.get(0))).equals(Array(71).join('a') + '          ');
      term.buffer.y = 1;
      term.buffer.x = 70;
      inputHandler.eraseInLine([0]);
      expect(lineContent(term.buffer.lines.get(1))).equals(Array(71).join('a') + '          ');

      // params[1] - left erase
      term.buffer.y = 2;
      term.buffer.x = 70;
      oldInputHandler.eraseInLine([1]);
      expect(lineContent(term.buffer.lines.get(2))).equals(Array(71).join(' ') + ' aaaaaaaaa');
      term.buffer.y = 3;
      term.buffer.x = 70;
      inputHandler.eraseInLine([1]);
      expect(lineContent(term.buffer.lines.get(3))).equals(Array(71).join(' ') + ' aaaaaaaaa');

      // params[1] - left erase
      term.buffer.y = 4;
      term.buffer.x = 70;
      oldInputHandler.eraseInLine([2]);
      expect(lineContent(term.buffer.lines.get(4))).equals(Array(term.cols + 1).join(' '));
      term.buffer.y = 5;
      term.buffer.x = 70;
      inputHandler.eraseInLine([2]);
      expect(lineContent(term.buffer.lines.get(5))).equals(Array(term.cols + 1).join(' '));

    });
    it('eraseInDisplay', function(): void {
      const termOld = new Terminal();
      const inputHandlerOld = new OldInputHandler(termOld);
      const termNew = new Terminal();
      const inputHandlerNew = new InputHandler(termNew);

      // fill display with a's
      for (let i = 0; i < termOld.rows; ++i) inputHandlerOld.parse(Array(termOld.cols + 1).join('a'));
      for (let i = 0; i < termNew.rows; ++i) inputHandlerNew.parse(Array(termOld.cols + 1).join('a'));
      const data = [];
      for (let i = 0; i < termOld.rows; ++i) data.push(Array(termOld.cols + 1).join('a'));
      expect(termContent(termOld)).eql(data);
      expect(termContent(termOld)).eql(termContent(termNew));

      // params [0] - right and below erase
      termOld.buffer.y = 5;
      termOld.buffer.x = 40;
      inputHandlerOld.eraseInDisplay([0]);
      termNew.buffer.y = 5;
      termNew.buffer.x = 40;
      inputHandlerNew.eraseInDisplay([0]);
      expect(termContent(termNew)).eql(termContent(termOld));

      // reset
      termOld.buffer.y = 0;
      termOld.buffer.x = 0;
      termNew.buffer.y = 0;
      termNew.buffer.x = 0;
      for (let i = 0; i < termOld.rows; ++i) inputHandlerOld.parse(Array(termOld.cols + 1).join('a'));
      for (let i = 0; i < termNew.rows; ++i) inputHandlerNew.parse(Array(termOld.cols + 1).join('a'));

      // params [1] - left and above
      termOld.buffer.y = 5;
      termOld.buffer.x = 40;
      inputHandlerOld.eraseInDisplay([1]);
      termNew.buffer.y = 5;
      termNew.buffer.x = 40;
      inputHandlerNew.eraseInDisplay([1]);
      expect(termContent(termNew)).eql(termContent(termOld));

      // reset
      termOld.buffer.y = 0;
      termOld.buffer.x = 0;
      termNew.buffer.y = 0;
      termNew.buffer.x = 0;
      for (let i = 0; i < termOld.rows; ++i) inputHandlerOld.parse(Array(termOld.cols + 1).join('a'));
      for (let i = 0; i < termNew.rows; ++i) inputHandlerNew.parse(Array(termOld.cols + 1).join('a'));

      // params [2] - whole screen
      termOld.buffer.y = 5;
      termOld.buffer.x = 40;
      inputHandlerOld.eraseInDisplay([2]);
      termNew.buffer.y = 5;
      termNew.buffer.x = 40;
      inputHandlerNew.eraseInDisplay([2]);
      expect(termContent(termNew)).eql(termContent(termOld));

      // reset and add a wrapped line
      termNew.buffer.y = 0;
      termNew.buffer.x = 0;
      inputHandlerNew.parse(Array(termNew.cols + 1).join('a')); // line 0
      inputHandlerNew.parse(Array(termNew.cols + 10).join('a')); // line 1 and 2
      for (let i = 3; i < termOld.rows; ++i) inputHandlerNew.parse(Array(termNew.cols + 1).join('a'));

      // params[1] left and above with wrap
      // confirm precondition that line 2 is wrapped
      expect(termNew.buffer.lines.get(2).isWrapped).true;
      termNew.buffer.y = 2;
      termNew.buffer.x = 40;
      inputHandlerNew.eraseInDisplay([1]);
      expect(termNew.buffer.lines.get(2).isWrapped).false;

      // reset and add a wrapped line
      termNew.buffer.y = 0;
      termNew.buffer.x = 0;
      inputHandlerNew.parse(Array(termNew.cols + 1).join('a')); // line 0
      inputHandlerNew.parse(Array(termNew.cols + 10).join('a')); // line 1 and 2
      for (let i = 3; i < termOld.rows; ++i) inputHandlerNew.parse(Array(termNew.cols + 1).join('a'));

      // params[1] left and above with wrap
      // confirm precondition that line 2 is wrapped
      expect(termNew.buffer.lines.get(2).isWrapped).true;
      termNew.buffer.y = 1;
      termNew.buffer.x = 90; // Cursor is beyond last column
      inputHandlerNew.eraseInDisplay([1]);
      expect(termNew.buffer.lines.get(2).isWrapped).false;
    });
  });
  it('convertEol setting', function(): void {
    // not converting
    let s = '';
    const termNotConverting = new Terminal({cols: 15, rows: 10});
    (termNotConverting as any)._inputHandler.parse('Hello\nWorld');
    for (let i = 0; i < termNotConverting.cols; ++i) {
      s += termNotConverting.buffer.lines.get(0).get(i)[CHAR_DATA_CHAR_INDEX];
    }
    expect(s).equals('Hello          ');
    s = '';
    for (let i = 0; i < termNotConverting.cols; ++i) {
      s += termNotConverting.buffer.lines.get(1).get(i)[CHAR_DATA_CHAR_INDEX];
    }
    expect(s).equals('     World     ');

    // converting
    s = '';
    const termConverting = new Terminal({cols: 15, rows: 10, convertEol: true});
    (termConverting as any)._inputHandler.parse('Hello\nWorld');
    for (let i = 0; i < termConverting.cols; ++i) {
      s += termConverting.buffer.lines.get(0).get(i)[CHAR_DATA_CHAR_INDEX];
    }
    expect(s).equals('Hello          ');
    s = '';
    for (let i = 0; i < termConverting.cols; ++i) {
      s += termConverting.buffer.lines.get(1).get(i)[CHAR_DATA_CHAR_INDEX];
    }
    expect(s).equals('World          ');
  });
  describe('print', () => {
    it('should not cause an infinite loop (regression test)', () => {
      const term = new Terminal();
      const inputHandler = new InputHandler(term);
      inputHandler.print(String.fromCharCode(0x200B), 0, 1);
    });
  });

  describe('alt screen', () => {
    let term: Terminal;
    let handler: InputHandler;

    function lineContent(line: IBufferLine): string {
      let content = '';
      for (let i = 0; i < line.length; ++i) content += line.get(i)[CHAR_DATA_CHAR_INDEX];
      return content;
    }

    beforeEach(() => {
      term = new Terminal();
      handler = new InputHandler(term);
    });
    it('should handle DECSET/DECRST 47 (alt screen buffer)', () => {
      handler.parse('\x1b[?47h\r\n\x1b[31mJUNK\x1b[?47lTEST');
      expect(lineContent(term.buffer.lines.get(0))).to.equal(Array(term.cols + 1).join(' '));
      expect(lineContent(term.buffer.lines.get(1))).to.equal('    TEST' + Array(term.cols - 7).join(' '));
      // Text color of 'TEST' should be red
      expect((term.buffer.lines.get(1).get(4)[CHAR_DATA_ATTR_INDEX] >> 9) & 0x1ff).to.equal(1);
    });
    it('should handle DECSET/DECRST 1047 (alt screen buffer)', () => {
      handler.parse('\x1b[?1047h\r\n\x1b[31mJUNK\x1b[?1047lTEST');
      expect(lineContent(term.buffer.lines.get(0))).to.equal(Array(term.cols + 1).join(' '));
      expect(lineContent(term.buffer.lines.get(1))).to.equal('    TEST' + Array(term.cols - 7).join(' '));
      // Text color of 'TEST' should be red
      expect((term.buffer.lines.get(1).get(4)[CHAR_DATA_ATTR_INDEX] >> 9) & 0x1ff).to.equal(1);
    });
    it('should handle DECSET/DECRST 1048 (alt screen cursor)', () => {
      handler.parse('\x1b[?1048h\r\n\x1b[31mJUNK\x1b[?1048lTEST');
      expect(lineContent(term.buffer.lines.get(0))).to.equal('TEST' + Array(term.cols - 3).join(' '));
      expect(lineContent(term.buffer.lines.get(1))).to.equal('JUNK' + Array(term.cols - 3).join(' '));
      // Text color of 'TEST' should be default
      expect(term.buffer.lines.get(0).get(0)[CHAR_DATA_ATTR_INDEX]).to.equal(DEFAULT_ATTR);
      // Text color of 'JUNK' should be red
      expect((term.buffer.lines.get(1).get(0)[CHAR_DATA_ATTR_INDEX] >> 9) & 0x1ff).to.equal(1);
    });
    it('should handle DECSET/DECRST 1049 (alt screen buffer+cursor)', () => {
      handler.parse('\x1b[?1049h\r\n\x1b[31mJUNK\x1b[?1049lTEST');
      expect(lineContent(term.buffer.lines.get(0))).to.equal('TEST' + Array(term.cols - 3).join(' '));
      expect(lineContent(term.buffer.lines.get(1))).to.equal(Array(term.cols + 1).join(' '));
      // Text color of 'TEST' should be default
      expect(term.buffer.lines.get(0).get(0)[CHAR_DATA_ATTR_INDEX]).to.equal(DEFAULT_ATTR);
    });
    it('should handle DECSET/DECRST 1049 - maintains saved cursor for alt buffer', () => {
      handler.parse('\x1b[?1049h\r\n\x1b[31m\x1b[s\x1b[?1049lTEST');
      expect(lineContent(term.buffer.lines.get(0))).to.equal('TEST' + Array(term.cols - 3).join(' '));
      // Text color of 'TEST' should be default
      expect(term.buffer.lines.get(0).get(0)[CHAR_DATA_ATTR_INDEX]).to.equal(DEFAULT_ATTR);
      handler.parse('\x1b[?1049h\x1b[uTEST');
      expect(lineContent(term.buffer.lines.get(1))).to.equal('TEST' + Array(term.cols - 3).join(' '));
      // Text color of 'TEST' should be red
      expect((term.buffer.lines.get(1).get(0)[CHAR_DATA_ATTR_INDEX] >> 9) & 0x1ff).to.equal(1);
    });
    it('should handle DECSET/DECRST 1049 - clears alt buffer with erase attributes', () => {
      handler.parse('\x1b[42m\x1b[?1049h');
      // Buffer should be filled with green background
      expect(term.buffer.lines.get(20).get(10)[CHAR_DATA_ATTR_INDEX] & 0x1ff).to.equal(2);
    });
  });
});
