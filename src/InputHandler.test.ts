/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert, expect } from 'chai';
import { InputHandler } from './InputHandler';
import { MockInputHandlingTerminal } from './ui/TestUtils.test';
import { CHAR_DATA_ATTR_INDEX, DEFAULT_ATTR } from './Buffer';
import { Terminal } from './Terminal';
import { IBufferLine } from './Types';

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
    function termContent(term: Terminal, trim: boolean): string[] {
      const result = [];
      for (let i = 0; i < term.rows; ++i) result.push(term.buffer.lines.get(i).translateToString(trim));
      return result;
    }

    it('insertChars', function(): void {
      const term = new Terminal();
      const inputHandler = new InputHandler(term);

      // insert some data in first and second line
      inputHandler.parse(Array(term.cols - 9).join('a'));
      inputHandler.parse('1234567890');
      inputHandler.parse(Array(term.cols - 9).join('a'));
      inputHandler.parse('1234567890');
      const line1: IBufferLine = term.buffer.lines.get(0);
      expect(line1.translateToString(false)).equals(Array(term.cols - 9).join('a') + '1234567890');

      // insert one char from params = [0]
      term.buffer.y = 0;
      term.buffer.x = 70;
      inputHandler.insertChars([0]);
      expect(line1.translateToString(false)).equals(Array(term.cols - 9).join('a') + ' 123456789');

      // insert one char from params = [1]
      term.buffer.y = 0;
      term.buffer.x = 70;
      inputHandler.insertChars([1]);
      expect(line1.translateToString(false)).equals(Array(term.cols - 9).join('a') + '  12345678');

      // insert two chars from params = [2]
      term.buffer.y = 0;
      term.buffer.x = 70;
      inputHandler.insertChars([2]);
      expect(line1.translateToString(false)).equals(Array(term.cols - 9).join('a') + '    123456');

      // insert 10 chars from params = [10]
      term.buffer.y = 0;
      term.buffer.x = 70;
      inputHandler.insertChars([10]);
      expect(line1.translateToString(false)).equals(Array(term.cols - 9).join('a') + '          ');
      expect(line1.translateToString(true)).equals(Array(term.cols - 9).join('a'));
    });
    it('deleteChars', function(): void {
      const term = new Terminal();
      const inputHandler = new InputHandler(term);

      // insert some data in first and second line
      inputHandler.parse(Array(term.cols - 9).join('a'));
      inputHandler.parse('1234567890');
      inputHandler.parse(Array(term.cols - 9).join('a'));
      inputHandler.parse('1234567890');
      const line1: IBufferLine = term.buffer.lines.get(0);
      expect(line1.translateToString(false)).equals(Array(term.cols - 9).join('a') + '1234567890');

      // delete one char from params = [0]
      term.buffer.y = 0;
      term.buffer.x = 70;
      inputHandler.deleteChars([0]);
      expect(line1.translateToString(false)).equals(Array(term.cols - 9).join('a') + '234567890 ');
      expect(line1.translateToString(true)).equals(Array(term.cols - 9).join('a') + '234567890');

      // insert one char from params = [1]
      term.buffer.y = 0;
      term.buffer.x = 70;
      inputHandler.deleteChars([1]);
      expect(line1.translateToString(false)).equals(Array(term.cols - 9).join('a') + '34567890  ');
      expect(line1.translateToString(true)).equals(Array(term.cols - 9).join('a') + '34567890');

      // insert two chars from params = [2]
      term.buffer.y = 0;
      term.buffer.x = 70;
      inputHandler.deleteChars([2]);
      expect(line1.translateToString(false)).equals(Array(term.cols - 9).join('a') + '567890    ');
      expect(line1.translateToString(true)).equals(Array(term.cols - 9).join('a') + '567890');

      // insert 10 chars from params = [10]
      term.buffer.y = 0;
      term.buffer.x = 70;
      inputHandler.deleteChars([10]);
      expect(line1.translateToString(false)).equals(Array(term.cols - 9).join('a') + '          ');
      expect(line1.translateToString(true)).equals(Array(term.cols - 9).join('a'));
    });
    it('eraseInLine', function(): void {
      const term = new Terminal();
      const inputHandler = new InputHandler(term);

      // fill 6 lines to test 3 different states
      inputHandler.parse(Array(term.cols + 1).join('a'));
      inputHandler.parse(Array(term.cols + 1).join('a'));
      inputHandler.parse(Array(term.cols + 1).join('a'));

      // params[0] - right erase
      term.buffer.y = 0;
      term.buffer.x = 70;
      inputHandler.eraseInLine([0]);
      expect(term.buffer.lines.get(0).translateToString(false)).equals(Array(71).join('a') + '          ');

      // params[1] - left erase
      term.buffer.y = 1;
      term.buffer.x = 70;
      inputHandler.eraseInLine([1]);
      expect(term.buffer.lines.get(1).translateToString(false)).equals(Array(71).join(' ') + ' aaaaaaaaa');

      // params[1] - left erase
      term.buffer.y = 2;
      term.buffer.x = 70;
      inputHandler.eraseInLine([2]);
      expect(term.buffer.lines.get(2).translateToString(false)).equals(Array(term.cols + 1).join(' '));

    });
    it('eraseInDisplay', function(): void {
      const term = new Terminal({cols: 80, rows: 7});
      const inputHandler = new InputHandler(term);

      // fill display with a's
      for (let i = 0; i < term.rows; ++i) inputHandler.parse(Array(term.cols + 1).join('a'));

      // params [0] - right and below erase
      term.buffer.y = 5;
      term.buffer.x = 40;
      inputHandler.eraseInDisplay([0]);
      expect(termContent(term, false)).eql([
        Array(term.cols + 1).join('a'),
        Array(term.cols + 1).join('a'),
        Array(term.cols + 1).join('a'),
        Array(term.cols + 1).join('a'),
        Array(term.cols + 1).join('a'),
        Array(40 + 1).join('a') + Array(term.cols - 40 + 1).join(' '),
        Array(term.cols + 1).join(' ')
      ]);
      expect(termContent(term, true)).eql([
        Array(term.cols + 1).join('a'),
        Array(term.cols + 1).join('a'),
        Array(term.cols + 1).join('a'),
        Array(term.cols + 1).join('a'),
        Array(term.cols + 1).join('a'),
        Array(40 + 1).join('a'),
        ''
      ]);

      // reset
      term.buffer.y = 0;
      term.buffer.x = 0;
      for (let i = 0; i < term.rows; ++i) inputHandler.parse(Array(term.cols + 1).join('a'));

      // params [1] - left and above
      term.buffer.y = 5;
      term.buffer.x = 40;
      inputHandler.eraseInDisplay([1]);
      expect(termContent(term, false)).eql([
        Array(term.cols + 1).join(' '),
        Array(term.cols + 1).join(' '),
        Array(term.cols + 1).join(' '),
        Array(term.cols + 1).join(' '),
        Array(term.cols + 1).join(' '),
        Array(41 + 1).join(' ') + Array(term.cols - 41 + 1).join('a'),
        Array(term.cols + 1).join('a')
      ]);
      expect(termContent(term, true)).eql([
        '',
        '',
        '',
        '',
        '',
        Array(41 + 1).join(' ') + Array(term.cols - 41 + 1).join('a'),
        Array(term.cols + 1).join('a')
      ]);

      // reset
      term.buffer.y = 0;
      term.buffer.x = 0;
      for (let i = 0; i < term.rows; ++i) inputHandler.parse(Array(term.cols + 1).join('a'));

      // params [2] - whole screen
      term.buffer.y = 5;
      term.buffer.x = 40;
      inputHandler.eraseInDisplay([2]);
      expect(termContent(term, false)).eql([
        Array(term.cols + 1).join(' '),
        Array(term.cols + 1).join(' '),
        Array(term.cols + 1).join(' '),
        Array(term.cols + 1).join(' '),
        Array(term.cols + 1).join(' '),
        Array(term.cols + 1).join(' '),
        Array(term.cols + 1).join(' ')
      ]);
      expect(termContent(term, true)).eql([
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ]);

      // reset and add a wrapped line
      term.buffer.y = 0;
      term.buffer.x = 0;
      inputHandler.parse(Array(term.cols + 1).join('a')); // line 0
      inputHandler.parse(Array(term.cols + 10).join('a')); // line 1 and 2
      for (let i = 3; i < term.rows; ++i) inputHandler.parse(Array(term.cols + 1).join('a'));

      // params[1] left and above with wrap
      // confirm precondition that line 2 is wrapped
      expect(term.buffer.lines.get(2).isWrapped).true;
      term.buffer.y = 2;
      term.buffer.x = 40;
      inputHandler.eraseInDisplay([1]);
      expect(term.buffer.lines.get(2).isWrapped).false;

      // reset and add a wrapped line
      term.buffer.y = 0;
      term.buffer.x = 0;
      inputHandler.parse(Array(term.cols + 1).join('a')); // line 0
      inputHandler.parse(Array(term.cols + 10).join('a')); // line 1 and 2
      for (let i = 3; i < term.rows; ++i) inputHandler.parse(Array(term.cols + 1).join('a'));

      // params[1] left and above with wrap
      // confirm precondition that line 2 is wrapped
      expect(term.buffer.lines.get(2).isWrapped).true;
      term.buffer.y = 1;
      term.buffer.x = 90; // Cursor is beyond last column
      inputHandler.eraseInDisplay([1]);
      expect(term.buffer.lines.get(2).isWrapped).false;
    });
  });
  it('convertEol setting', function(): void {
    // not converting
    const termNotConverting = new Terminal({cols: 15, rows: 10});
    (termNotConverting as any)._inputHandler.parse('Hello\nWorld');
    expect(termNotConverting.buffer.lines.get(0).translateToString(false)).equals('Hello          ');
    expect(termNotConverting.buffer.lines.get(1).translateToString(false)).equals('     World     ');
    expect(termNotConverting.buffer.lines.get(0).translateToString(true)).equals('Hello');
    expect(termNotConverting.buffer.lines.get(1).translateToString(true)).equals('     World');

    // converting
    const termConverting = new Terminal({cols: 15, rows: 10, convertEol: true});
    (termConverting as any)._inputHandler.parse('Hello\nWorld');
    expect(termConverting.buffer.lines.get(0).translateToString(false)).equals('Hello          ');
    expect(termConverting.buffer.lines.get(1).translateToString(false)).equals('World          ');
    expect(termConverting.buffer.lines.get(0).translateToString(true)).equals('Hello');
    expect(termConverting.buffer.lines.get(1).translateToString(true)).equals('World');
  });
  describe('print', () => {
    it('should not cause an infinite loop (regression test)', () => {
      const term = new Terminal();
      const inputHandler = new InputHandler(term);
      const container = new Uint32Array(10);
      container[0] = 0x200B;
      inputHandler.print(container, 0, 1);
    });
  });

  describe('alt screen', () => {
    let term: Terminal;
    let handler: InputHandler;

    beforeEach(() => {
      term = new Terminal();
      handler = new InputHandler(term);
    });
    it('should handle DECSET/DECRST 47 (alt screen buffer)', () => {
      handler.parse('\x1b[?47h\r\n\x1b[31mJUNK\x1b[?47lTEST');
      expect(term.buffer.translateBufferLineToString(0, true)).to.equal('');
      expect(term.buffer.translateBufferLineToString(1, true)).to.equal('    TEST');
      // Text color of 'TEST' should be red
      expect((term.buffer.lines.get(1).get(4)[CHAR_DATA_ATTR_INDEX] >> 9) & 0x1ff).to.equal(1);
    });
    it('should handle DECSET/DECRST 1047 (alt screen buffer)', () => {
      handler.parse('\x1b[?1047h\r\n\x1b[31mJUNK\x1b[?1047lTEST');
      expect(term.buffer.translateBufferLineToString(0, true)).to.equal('');
      expect(term.buffer.translateBufferLineToString(1, true)).to.equal('    TEST');
      // Text color of 'TEST' should be red
      expect((term.buffer.lines.get(1).get(4)[CHAR_DATA_ATTR_INDEX] >> 9) & 0x1ff).to.equal(1);
    });
    it('should handle DECSET/DECRST 1048 (alt screen cursor)', () => {
      handler.parse('\x1b[?1048h\r\n\x1b[31mJUNK\x1b[?1048lTEST');
      expect(term.buffer.translateBufferLineToString(0, true)).to.equal('TEST');
      expect(term.buffer.translateBufferLineToString(1, true)).to.equal('JUNK');
      // Text color of 'TEST' should be default
      expect(term.buffer.lines.get(0).get(0)[CHAR_DATA_ATTR_INDEX]).to.equal(DEFAULT_ATTR);
      // Text color of 'JUNK' should be red
      expect((term.buffer.lines.get(1).get(0)[CHAR_DATA_ATTR_INDEX] >> 9) & 0x1ff).to.equal(1);
    });
    it('should handle DECSET/DECRST 1049 (alt screen buffer+cursor)', () => {
      handler.parse('\x1b[?1049h\r\n\x1b[31mJUNK\x1b[?1049lTEST');
      expect(term.buffer.translateBufferLineToString(0, true)).to.equal('TEST');
      expect(term.buffer.translateBufferLineToString(1, true)).to.equal('');
      // Text color of 'TEST' should be default
      expect(term.buffer.lines.get(0).get(0)[CHAR_DATA_ATTR_INDEX]).to.equal(DEFAULT_ATTR);
    });
    it('should handle DECSET/DECRST 1049 - maintains saved cursor for alt buffer', () => {
      handler.parse('\x1b[?1049h\r\n\x1b[31m\x1b[s\x1b[?1049lTEST');
      expect(term.buffer.translateBufferLineToString(0, true)).to.equal('TEST');
      // Text color of 'TEST' should be default
      expect(term.buffer.lines.get(0).get(0)[CHAR_DATA_ATTR_INDEX]).to.equal(DEFAULT_ATTR);
      handler.parse('\x1b[?1049h\x1b[uTEST');
      expect(term.buffer.translateBufferLineToString(1, true)).to.equal('TEST');
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
