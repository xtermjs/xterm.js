/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert, expect } from 'chai';
import { InputHandler } from './InputHandler';
import { MockInputHandlingTerminal, TestTerminal } from './TestUtils.test';
import { Terminal } from './Terminal';
import { IBufferLine } from 'common/Types';
import { DEFAULT_ATTR_DATA } from 'common/buffer/BufferLine';
import { CellData } from 'common/buffer/CellData';
import { Attributes } from 'common/buffer/Constants';
import { AttributeData } from 'common/buffer/AttributeData';
import { Params } from 'common/parser/Params';
import { MockCoreService } from 'common/TestUtils.test';

describe('InputHandler', () => {
  describe('save and restore cursor', () => {
    const terminal = new MockInputHandlingTerminal();
    terminal.buffer.x = 1;
    terminal.buffer.y = 2;
    terminal.buffer.ybase = 0;
    terminal.curAttrData.fg = 3;
    const inputHandler = new InputHandler(terminal, new MockCoreService());
    // Save cursor position
    inputHandler.saveCursor();
    assert.equal(terminal.buffer.x, 1);
    assert.equal(terminal.buffer.y, 2);
    assert.equal(terminal.curAttrData.fg, 3);
    // Change cursor position
    terminal.buffer.x = 10;
    terminal.buffer.y = 20;
    terminal.curAttrData.fg = 30;
    // Restore cursor position
    inputHandler.restoreCursor();
    assert.equal(terminal.buffer.x, 1);
    assert.equal(terminal.buffer.y, 2);
    assert.equal(terminal.curAttrData.fg, 3);
  });
  describe('setCursorStyle', () => {
    it('should call Terminal.setOption with correct params', () => {
      const terminal = new MockInputHandlingTerminal();
      const inputHandler = new InputHandler(terminal, new MockCoreService());
      const collect = ' ';

      inputHandler.setCursorStyle(Params.fromArray([0]), collect);
      assert.equal(terminal.options['cursorStyle'], 'block');
      assert.equal(terminal.options['cursorBlink'], true);

      terminal.options = {};
      inputHandler.setCursorStyle(Params.fromArray([1]), collect);
      assert.equal(terminal.options['cursorStyle'], 'block');
      assert.equal(terminal.options['cursorBlink'], true);

      terminal.options = {};
      inputHandler.setCursorStyle(Params.fromArray([2]), collect);
      assert.equal(terminal.options['cursorStyle'], 'block');
      assert.equal(terminal.options['cursorBlink'], false);

      terminal.options = {};
      inputHandler.setCursorStyle(Params.fromArray([3]), collect);
      assert.equal(terminal.options['cursorStyle'], 'underline');
      assert.equal(terminal.options['cursorBlink'], true);

      terminal.options = {};
      inputHandler.setCursorStyle(Params.fromArray([4]), collect);
      assert.equal(terminal.options['cursorStyle'], 'underline');
      assert.equal(terminal.options['cursorBlink'], false);

      terminal.options = {};
      inputHandler.setCursorStyle(Params.fromArray([5]), collect);
      assert.equal(terminal.options['cursorStyle'], 'bar');
      assert.equal(terminal.options['cursorBlink'], true);

      terminal.options = {};
      inputHandler.setCursorStyle(Params.fromArray([6]), collect);
      assert.equal(terminal.options['cursorStyle'], 'bar');
      assert.equal(terminal.options['cursorBlink'], false);
    });
  });
  describe('setMode', () => {
    it('should toggle Terminal.bracketedPasteMode', () => {
      const terminal = new MockInputHandlingTerminal();
      const collect = '?';
      terminal.bracketedPasteMode = false;
      const inputHandler = new InputHandler(terminal, new MockCoreService());
      // Set bracketed paste mode
      inputHandler.setMode(Params.fromArray([2004]), collect);
      assert.equal(terminal.bracketedPasteMode, true);
      // Reset bracketed paste mode
      inputHandler.resetMode(Params.fromArray([2004]), collect);
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
      const inputHandler = new InputHandler(term, new MockCoreService());

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
      inputHandler.insertChars(Params.fromArray([0]));
      expect(line1.translateToString(false)).equals(Array(term.cols - 9).join('a') + ' 123456789');

      // insert one char from params = [1]
      term.buffer.y = 0;
      term.buffer.x = 70;
      inputHandler.insertChars(Params.fromArray([1]));
      expect(line1.translateToString(false)).equals(Array(term.cols - 9).join('a') + '  12345678');

      // insert two chars from params = [2]
      term.buffer.y = 0;
      term.buffer.x = 70;
      inputHandler.insertChars(Params.fromArray([2]));
      expect(line1.translateToString(false)).equals(Array(term.cols - 9).join('a') + '    123456');

      // insert 10 chars from params = [10]
      term.buffer.y = 0;
      term.buffer.x = 70;
      inputHandler.insertChars(Params.fromArray([10]));
      expect(line1.translateToString(false)).equals(Array(term.cols - 9).join('a') + '          ');
      expect(line1.translateToString(true)).equals(Array(term.cols - 9).join('a'));
    });
    it('deleteChars', function(): void {
      const term = new Terminal();
      const inputHandler = new InputHandler(term, new MockCoreService());

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
      inputHandler.deleteChars(Params.fromArray([0]));
      expect(line1.translateToString(false)).equals(Array(term.cols - 9).join('a') + '234567890 ');
      expect(line1.translateToString(true)).equals(Array(term.cols - 9).join('a') + '234567890');

      // insert one char from params = [1]
      term.buffer.y = 0;
      term.buffer.x = 70;
      inputHandler.deleteChars(Params.fromArray([1]));
      expect(line1.translateToString(false)).equals(Array(term.cols - 9).join('a') + '34567890  ');
      expect(line1.translateToString(true)).equals(Array(term.cols - 9).join('a') + '34567890');

      // insert two chars from params = [2]
      term.buffer.y = 0;
      term.buffer.x = 70;
      inputHandler.deleteChars(Params.fromArray([2]));
      expect(line1.translateToString(false)).equals(Array(term.cols - 9).join('a') + '567890    ');
      expect(line1.translateToString(true)).equals(Array(term.cols - 9).join('a') + '567890');

      // insert 10 chars from params = [10]
      term.buffer.y = 0;
      term.buffer.x = 70;
      inputHandler.deleteChars(Params.fromArray([10]));
      expect(line1.translateToString(false)).equals(Array(term.cols - 9).join('a') + '          ');
      expect(line1.translateToString(true)).equals(Array(term.cols - 9).join('a'));
    });
    it('eraseInLine', function(): void {
      const term = new Terminal();
      const inputHandler = new InputHandler(term, new MockCoreService());

      // fill 6 lines to test 3 different states
      inputHandler.parse(Array(term.cols + 1).join('a'));
      inputHandler.parse(Array(term.cols + 1).join('a'));
      inputHandler.parse(Array(term.cols + 1).join('a'));

      // params[0] - right erase
      term.buffer.y = 0;
      term.buffer.x = 70;
      inputHandler.eraseInLine(Params.fromArray([0]));
      expect(term.buffer.lines.get(0).translateToString(false)).equals(Array(71).join('a') + '          ');

      // params[1] - left erase
      term.buffer.y = 1;
      term.buffer.x = 70;
      inputHandler.eraseInLine(Params.fromArray([1]));
      expect(term.buffer.lines.get(1).translateToString(false)).equals(Array(71).join(' ') + ' aaaaaaaaa');

      // params[1] - left erase
      term.buffer.y = 2;
      term.buffer.x = 70;
      inputHandler.eraseInLine(Params.fromArray([2]));
      expect(term.buffer.lines.get(2).translateToString(false)).equals(Array(term.cols + 1).join(' '));

    });
    it('eraseInDisplay', function(): void {
      const term = new Terminal({cols: 80, rows: 7});
      const inputHandler = new InputHandler(term, new MockCoreService());

      // fill display with a's
      for (let i = 0; i < term.rows; ++i) inputHandler.parse(Array(term.cols + 1).join('a'));

      // params [0] - right and below erase
      term.buffer.y = 5;
      term.buffer.x = 40;
      inputHandler.eraseInDisplay(Params.fromArray([0]));
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
      inputHandler.eraseInDisplay(Params.fromArray([1]));
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
      inputHandler.eraseInDisplay(Params.fromArray([2]));
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
      inputHandler.eraseInDisplay(Params.fromArray([1]));
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
      inputHandler.eraseInDisplay(Params.fromArray([1]));
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
      const inputHandler = new InputHandler(term, new MockCoreService());
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
      handler = new InputHandler(term, new MockCoreService());
    });
    it('should handle DECSET/DECRST 47 (alt screen buffer)', () => {
      handler.parse('\x1b[?47h\r\n\x1b[31mJUNK\x1b[?47lTEST');
      expect(term.buffer.translateBufferLineToString(0, true)).to.equal('');
      expect(term.buffer.translateBufferLineToString(1, true)).to.equal('    TEST');
      // Text color of 'TEST' should be red
      expect((term.buffer.lines.get(1).loadCell(4, new CellData()).getFgColor())).to.equal(1);
    });
    it('should handle DECSET/DECRST 1047 (alt screen buffer)', () => {
      handler.parse('\x1b[?1047h\r\n\x1b[31mJUNK\x1b[?1047lTEST');
      expect(term.buffer.translateBufferLineToString(0, true)).to.equal('');
      expect(term.buffer.translateBufferLineToString(1, true)).to.equal('    TEST');
      // Text color of 'TEST' should be red
      expect((term.buffer.lines.get(1).loadCell(4, new CellData()).getFgColor())).to.equal(1);
    });
    it('should handle DECSET/DECRST 1048 (alt screen cursor)', () => {
      handler.parse('\x1b[?1048h\r\n\x1b[31mJUNK\x1b[?1048lTEST');
      expect(term.buffer.translateBufferLineToString(0, true)).to.equal('TEST');
      expect(term.buffer.translateBufferLineToString(1, true)).to.equal('JUNK');
      // Text color of 'TEST' should be default
      expect(term.buffer.lines.get(0).loadCell(0, new CellData()).fg).to.equal(DEFAULT_ATTR_DATA.fg);
      // Text color of 'JUNK' should be red
      expect((term.buffer.lines.get(1).loadCell(0, new CellData()).getFgColor())).to.equal(1);
    });
    it('should handle DECSET/DECRST 1049 (alt screen buffer+cursor)', () => {
      handler.parse('\x1b[?1049h\r\n\x1b[31mJUNK\x1b[?1049lTEST');
      expect(term.buffer.translateBufferLineToString(0, true)).to.equal('TEST');
      expect(term.buffer.translateBufferLineToString(1, true)).to.equal('');
      // Text color of 'TEST' should be default
      expect(term.buffer.lines.get(0).loadCell(0, new CellData()).fg).to.equal(DEFAULT_ATTR_DATA.fg);
    });
    it('should handle DECSET/DECRST 1049 - maintains saved cursor for alt buffer', () => {
      handler.parse('\x1b[?1049h\r\n\x1b[31m\x1b[s\x1b[?1049lTEST');
      expect(term.buffer.translateBufferLineToString(0, true)).to.equal('TEST');
      // Text color of 'TEST' should be default
      expect(term.buffer.lines.get(0).loadCell(0, new CellData()).fg).to.equal(DEFAULT_ATTR_DATA.fg);
      handler.parse('\x1b[?1049h\x1b[uTEST');
      expect(term.buffer.translateBufferLineToString(1, true)).to.equal('TEST');
      // Text color of 'TEST' should be red
      expect((term.buffer.lines.get(1).loadCell(0, new CellData()).getFgColor())).to.equal(1);
    });
    it('should handle DECSET/DECRST 1049 - clears alt buffer with erase attributes', () => {
      handler.parse('\x1b[42m\x1b[?1049h');
      // Buffer should be filled with green background
      expect(term.buffer.lines.get(20).loadCell(10, new CellData()).getBgColor()).to.equal(2);
    });
  });

  describe('text attributes', () => {
    let term: TestTerminal;
    beforeEach(() => {
      term = new TestTerminal();
    });
    it('bold', () => {
      term.writeSync('\x1b[1m');
      assert.equal(!!term.curAttrData.isBold(), true);
      term.writeSync('\x1b[22m');
      assert.equal(!!term.curAttrData.isBold(), false);
    });
    it('dim', () => {
      term.writeSync('\x1b[2m');
      assert.equal(!!term.curAttrData.isDim(), true);
      term.writeSync('\x1b[22m');
      assert.equal(!!term.curAttrData.isDim(), false);
    });
    it('italic', () => {
      term.writeSync('\x1b[3m');
      assert.equal(!!term.curAttrData.isItalic(), true);
      term.writeSync('\x1b[23m');
      assert.equal(!!term.curAttrData.isItalic(), false);
    });
    it('underline', () => {
      term.writeSync('\x1b[4m');
      assert.equal(!!term.curAttrData.isUnderline(), true);
      term.writeSync('\x1b[24m');
      assert.equal(!!term.curAttrData.isUnderline(), false);
    });
    it('blink', () => {
      term.writeSync('\x1b[5m');
      assert.equal(!!term.curAttrData.isBlink(), true);
      term.writeSync('\x1b[25m');
      assert.equal(!!term.curAttrData.isBlink(), false);
    });
    it('inverse', () => {
      term.writeSync('\x1b[7m');
      assert.equal(!!term.curAttrData.isInverse(), true);
      term.writeSync('\x1b[27m');
      assert.equal(!!term.curAttrData.isInverse(), false);
    });
    it('invisible', () => {
      term.writeSync('\x1b[8m');
      assert.equal(!!term.curAttrData.isInvisible(), true);
      term.writeSync('\x1b[28m');
      assert.equal(!!term.curAttrData.isInvisible(), false);
    });
    it('colormode palette 16', () => {
      assert.equal(term.curAttrData.getFgColorMode(), 0); // DEFAULT
      assert.equal(term.curAttrData.getBgColorMode(), 0); // DEFAULT
      // lower 8 colors
      for (let i = 0; i < 8; ++i) {
        term.writeSync(`\x1b[${i + 30};${i + 40}m`);
        assert.equal(term.curAttrData.getFgColorMode(), Attributes.CM_P16);
        assert.equal(term.curAttrData.getFgColor(), i);
        assert.equal(term.curAttrData.getBgColorMode(), Attributes.CM_P16);
        assert.equal(term.curAttrData.getBgColor(), i);
      }
      // reset to DEFAULT
      term.writeSync(`\x1b[39;49m`);
      assert.equal(term.curAttrData.getFgColorMode(), 0);
      assert.equal(term.curAttrData.getBgColorMode(), 0);
    });
    it('colormode palette 256', () => {
      assert.equal(term.curAttrData.getFgColorMode(), 0); // DEFAULT
      assert.equal(term.curAttrData.getBgColorMode(), 0); // DEFAULT
      // lower 8 colors
      for (let i = 0; i < 256; ++i) {
        term.writeSync(`\x1b[38;5;${i};48;5;${i}m`);
        assert.equal(term.curAttrData.getFgColorMode(), Attributes.CM_P256);
        assert.equal(term.curAttrData.getFgColor(), i);
        assert.equal(term.curAttrData.getBgColorMode(), Attributes.CM_P256);
        assert.equal(term.curAttrData.getBgColor(), i);
      }
      // reset to DEFAULT
      term.writeSync(`\x1b[39;49m`);
      assert.equal(term.curAttrData.getFgColorMode(), 0);
      assert.equal(term.curAttrData.getFgColor(), -1);
      assert.equal(term.curAttrData.getBgColorMode(), 0);
      assert.equal(term.curAttrData.getBgColor(), -1);
    });
    it('colormode RGB', () => {
      assert.equal(term.curAttrData.getFgColorMode(), 0); // DEFAULT
      assert.equal(term.curAttrData.getBgColorMode(), 0); // DEFAULT
      term.writeSync(`\x1b[38;2;1;2;3;48;2;4;5;6m`);
      assert.equal(term.curAttrData.getFgColorMode(), Attributes.CM_RGB);
      assert.equal(term.curAttrData.getFgColor(), 1 << 16 | 2 << 8 | 3);
      assert.deepEqual(AttributeData.toColorRGB(term.curAttrData.getFgColor()), [1, 2, 3]);
      assert.equal(term.curAttrData.getBgColorMode(), Attributes.CM_RGB);
      assert.deepEqual(AttributeData.toColorRGB(term.curAttrData.getBgColor()), [4, 5, 6]);
      // reset to DEFAULT
      term.writeSync(`\x1b[39;49m`);
      assert.equal(term.curAttrData.getFgColorMode(), 0);
      assert.equal(term.curAttrData.getFgColor(), -1);
      assert.equal(term.curAttrData.getBgColorMode(), 0);
      assert.equal(term.curAttrData.getBgColor(), -1);
    });
    it('colormode transition RGB to 256', () => {
      // enter RGB for FG and BG
      term.writeSync(`\x1b[38;2;1;2;3;48;2;4;5;6m`);
      // enter 256 for FG and BG
      term.writeSync(`\x1b[38;5;255;48;5;255m`);
      assert.equal(term.curAttrData.getFgColorMode(), Attributes.CM_P256);
      assert.equal(term.curAttrData.getFgColor(), 255);
      assert.equal(term.curAttrData.getBgColorMode(), Attributes.CM_P256);
      assert.equal(term.curAttrData.getBgColor(), 255);
    });
    it('colormode transition RGB to 16', () => {
      // enter RGB for FG and BG
      term.writeSync(`\x1b[38;2;1;2;3;48;2;4;5;6m`);
      // enter 16 for FG and BG
      term.writeSync(`\x1b[37;47m`);
      assert.equal(term.curAttrData.getFgColorMode(), Attributes.CM_P16);
      assert.equal(term.curAttrData.getFgColor(), 7);
      assert.equal(term.curAttrData.getBgColorMode(), Attributes.CM_P16);
      assert.equal(term.curAttrData.getBgColor(), 7);
    });
    it('colormode transition 16 to 256', () => {
      // enter 16 for FG and BG
      term.writeSync(`\x1b[37;47m`);
      // enter 256 for FG and BG
      term.writeSync(`\x1b[38;5;255;48;5;255m`);
      assert.equal(term.curAttrData.getFgColorMode(), Attributes.CM_P256);
      assert.equal(term.curAttrData.getFgColor(), 255);
      assert.equal(term.curAttrData.getBgColorMode(), Attributes.CM_P256);
      assert.equal(term.curAttrData.getBgColor(), 255);
    });
    it('colormode transition 256 to 16', () => {
      // enter 256 for FG and BG
      term.writeSync(`\x1b[38;5;255;48;5;255m`);
      // enter 16 for FG and BG
      term.writeSync(`\x1b[37;47m`);
      assert.equal(term.curAttrData.getFgColorMode(), Attributes.CM_P16);
      assert.equal(term.curAttrData.getFgColor(), 7);
      assert.equal(term.curAttrData.getBgColorMode(), Attributes.CM_P16);
      assert.equal(term.curAttrData.getBgColor(), 7);
    });
    it('should zero missing RGB values', () => {
      term.writeSync(`\x1b[38;2;1;2;3m`);
      term.writeSync(`\x1b[38;2;5m`);
      assert.deepEqual(AttributeData.toColorRGB(term.curAttrData.getFgColor()), [5, 0, 0]);
    });
  });
  describe('colon notation', () => {
    let termColon: TestTerminal;
    let termSemicolon: TestTerminal;
    beforeEach(() => {
      termColon = new TestTerminal();
      termSemicolon = new TestTerminal();
    });
    describe('should equal to semicolon', () => {
      it('CSI 38:2::50:100:150 m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;2;50;100;150m');
        termColon.writeSync('\x1b[38:2::50:100:150m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 150);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 38:2::50:100: m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;2;50;100;m');
        termColon.writeSync('\x1b[38:2::50:100:m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 0);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 38:2::50:: m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;2;50;;m');
        termColon.writeSync('\x1b[38:2::50::m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 50 << 16 | 0 << 8 | 0);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 38:2:::: m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;2;;;m');
        termColon.writeSync('\x1b[38:2::::m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 0 << 16 | 0 << 8 | 0);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 38;2::50:100:150 m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;2;50;100;150m');
        termColon.writeSync('\x1b[38;2::50:100:150m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 150);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 38;2;50:100:150 m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;2;50;100;150m');
        termColon.writeSync('\x1b[38;2;50:100:150m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 150);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 38;2;50;100:150 m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;2;50;100;150m');
        termColon.writeSync('\x1b[38;2;50;100:150m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 150);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 38:5:50 m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;5;50m');
        termColon.writeSync('\x1b[38:5:50m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFF, 50);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 38:5: m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;5;m');
        termColon.writeSync('\x1b[38:5:m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFF, 0);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 38;5:50 m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;5;50m');
        termColon.writeSync('\x1b[38;5:50m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFF, 50);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
    });
    describe('should fill early sequence end with default of 0', () => {
      it('CSI 38:2 m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;2m');
        termColon.writeSync('\x1b[38:2m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 0 << 16 | 0 << 8 | 0);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 38:5 m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;5m');
        termColon.writeSync('\x1b[38:5m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFF, 0);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
    });
    describe('should not interfere with leading/following SGR attrs', () => {
      it('CSI 1 ; 38:2::50:100:150 ; 4 m', () => {
        termSemicolon.writeSync('\x1b[1;38;2;50;100;150;4m');
        termColon.writeSync('\x1b[1;38:2::50:100:150;4m');
        assert.equal(!!termSemicolon.curAttrData.isBold(), true);
        assert.equal(!!termSemicolon.curAttrData.isUnderline(), true);
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 150);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 1 ; 38:2::50:100: ; 4 m', () => {
        termSemicolon.writeSync('\x1b[1;38;2;50;100;;4m');
        termColon.writeSync('\x1b[1;38:2::50:100:;4m');
        assert.equal(!!termSemicolon.curAttrData.isBold(), true);
        assert.equal(!!termSemicolon.curAttrData.isUnderline(), true);
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 0);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 1 ; 38:2::50:100 ; 4 m', () => {
        termSemicolon.writeSync('\x1b[1;38;2;50;100;;4m');
        termColon.writeSync('\x1b[1;38:2::50:100;4m');
        assert.equal(!!termSemicolon.curAttrData.isBold(), true);
        assert.equal(!!termSemicolon.curAttrData.isUnderline(), true);
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 0);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 1 ; 38:2:: ; 4 m', () => {
        termSemicolon.writeSync('\x1b[1;38;2;;;;4m');
        termColon.writeSync('\x1b[1;38:2::;4m');
        assert.equal(!!termSemicolon.curAttrData.isBold(), true);
        assert.equal(!!termSemicolon.curAttrData.isUnderline(), true);
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 0);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 1 ; 38;2:: ; 4 m', () => {
        termSemicolon.writeSync('\x1b[1;38;2;;;;4m');
        termColon.writeSync('\x1b[1;38;2::;4m');
        assert.equal(!!termSemicolon.curAttrData.isBold(), true);
        assert.equal(!!termSemicolon.curAttrData.isUnderline(), true);
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 0);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
    });
  });
});
