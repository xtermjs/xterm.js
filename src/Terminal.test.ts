/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

 import { assert, expect } from 'chai';
import { Terminal } from './Terminal';
import { MockViewport, MockCompositionHelper, MockRenderer } from './utils/TestUtils.test';
import { CHAR_DATA_CHAR_INDEX, CHAR_DATA_WIDTH_INDEX } from './Buffer';

const INIT_COLS = 80;
const INIT_ROWS = 24;

class TestTerminal extends Terminal {
  public evaluateKeyEscapeSequence(ev: any): {cancel: boolean, key: string, scrollDisp: number} { return this._evaluateKeyEscapeSequence(<KeyboardEvent>ev); }
  public keyDown(ev: any): boolean { return this._keyDown(ev); }
  public keyPress(ev: any): boolean { return this._keyPress(ev); }
}

describe('term.js addons', () => {
  let term: TestTerminal;

  beforeEach(() => {
    term = new TestTerminal({
      cols: INIT_COLS,
      rows: INIT_ROWS
    });
    term.refresh = () => {};
    (<any>term).renderer = new MockRenderer();
    term.viewport = new MockViewport();
    (<any>term).compositionHelper = new MockCompositionHelper();
    // Force synchronous writes
    term.write = (data) => {
      term.writeBuffer.push(data);
      (<any>term).innerWrite();
    };
    (<any>term).element = {
      classList: {
        toggle: () => {},
        remove: () => {}
      }
    };
  });

  it('should load addons with Terminal.loadAddon', () => {
    Terminal.loadAddon('attach');
    // Test that addon was loaded successfully, adding attach to Terminal's
    // prototype.
    assert.equal(typeof (<any>Terminal).prototype.attach, 'function');
  });

  describe('getOption', () => {
    it('should retrieve the option correctly', () => {
      // In the `options` namespace.
      term.options.cursorBlink = true;
      assert.equal(term.getOption('cursorBlink'), true);

      // On the Terminal instance
      delete term.options.cursorBlink;
      term.options.cursorBlink = false;
      assert.equal(term.getOption('cursorBlink'), false);
    });
    it('should throw when retrieving a non-existant option', () => {
      assert.throws(term.getOption.bind(term, 'fake', true));
    });
  });

  describe('attachCustomKeyEventHandler', () => {
    let evKeyDown = <KeyboardEvent>{
      preventDefault: () => {},
      stopPropagation: () => {},
      type: 'keydown',
      keyCode: 77
    };
    let evKeyPress = <KeyboardEvent>{
      preventDefault: () => {},
      stopPropagation: () => {},
      type: 'keypress',
      keyCode: 77
    };

    beforeEach(() => {
      term.handler = () => {};
      term.showCursor = () => {};
      term.clearSelection = () => {};
    });

    it('should process the keydown/keypress event based on what the handler returns', () => {
      assert.equal(term.keyDown(evKeyDown), true);
      assert.equal(term.keyPress(evKeyPress), true);
      term.attachCustomKeyEventHandler(ev => ev.keyCode === 77);
      assert.equal(term.keyDown(evKeyDown), true);
      assert.equal(term.keyPress(evKeyPress), true);
      term.attachCustomKeyEventHandler(ev => ev.keyCode !== 77);
      assert.equal(term.keyDown(evKeyDown), false);
      assert.equal(term.keyPress(evKeyPress), false);
    });

    it('should alive after reset(ESC c Full Reset (RIS))', () => {
      term.attachCustomKeyEventHandler(ev => ev.keyCode !== 77);
      assert.equal(term.keyDown(evKeyDown), false);
      assert.equal(term.keyPress(evKeyPress), false);
      term.reset();
      assert.equal(term.keyDown(evKeyDown), false);
      assert.equal(term.keyPress(evKeyPress), false);
    });
  });

  describe('setOption', () => {
    it('should set the option correctly', () => {
      term.setOption('cursorBlink', true);
      assert.equal(term.options.cursorBlink, true);
      term.setOption('cursorBlink', false);
      assert.equal(term.options.cursorBlink, false);
    });
    it('should throw when setting a non-existant option', () => {
      assert.throws(term.setOption.bind(term, 'fake', true));
    });
  });

  describe('clear', () => {
    it('should clear a buffer equal to rows', () => {
      let promptLine = term.buffer.lines.get(term.buffer.ybase + term.buffer.y);
      term.clear();
      assert.equal(term.buffer.y, 0);
      assert.equal(term.buffer.ybase, 0);
      assert.equal(term.buffer.ydisp, 0);
      assert.equal(term.buffer.lines.length, term.rows);
      assert.deepEqual(term.buffer.lines.get(0), promptLine);
      for (let i = 1; i < term.rows; i++) {
        assert.deepEqual(term.buffer.lines.get(i), term.blankLine());
      }
    });
    it('should clear a buffer larger than rows', () => {
      // Fill the buffer with dummy rows
      for (let i = 0; i < term.rows * 2; i++) {
        term.write('test\n');
      }

      let promptLine = term.buffer.lines.get(term.buffer.ybase + term.buffer.y);
      term.clear();
      assert.equal(term.buffer.y, 0);
      assert.equal(term.buffer.ybase, 0);
      assert.equal(term.buffer.ydisp, 0);
      assert.equal(term.buffer.lines.length, term.rows);
      assert.deepEqual(term.buffer.lines.get(0), promptLine);
      for (let i = 1; i < term.rows; i++) {
        assert.deepEqual(term.buffer.lines.get(i), term.blankLine());
      }
    });
    it('should not break the prompt when cleared twice', () => {
      let promptLine = term.buffer.lines.get(term.buffer.ybase + term.buffer.y);
      term.clear();
      term.clear();
      assert.equal(term.buffer.y, 0);
      assert.equal(term.buffer.ybase, 0);
      assert.equal(term.buffer.ydisp, 0);
      assert.equal(term.buffer.lines.length, term.rows);
      assert.deepEqual(term.buffer.lines.get(0), promptLine);
      for (let i = 1; i < term.rows; i++) {
        assert.deepEqual(term.buffer.lines.get(i), term.blankLine());
      }
    });
  });

  describe('scroll', () => {
    describe('scrollDisp', () => {
      let startYDisp;
      beforeEach(() => {
        for (let i = 0; i < term.rows * 2; i++) {
          term.writeln('test');
        }
        startYDisp = term.rows + 1;
      });
      it('should scroll a single line', () => {
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollDisp(-1);
        assert.equal(term.buffer.ydisp, startYDisp - 1);
        term.scrollDisp(1);
        assert.equal(term.buffer.ydisp, startYDisp);
      });
      it('should scroll multiple lines', () => {
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollDisp(-5);
        assert.equal(term.buffer.ydisp, startYDisp - 5);
        term.scrollDisp(5);
        assert.equal(term.buffer.ydisp, startYDisp);
      });
      it('should not scroll beyond the bounds of the buffer', () => {
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollDisp(1);
        assert.equal(term.buffer.ydisp, startYDisp);
        for (let i = 0; i < startYDisp; i++) {
          term.scrollDisp(-1);
        }
        assert.equal(term.buffer.ydisp, 0);
        term.scrollDisp(-1);
        assert.equal(term.buffer.ydisp, 0);
      });
    });

    describe('scrollPages', () => {
      let startYDisp;
      beforeEach(() => {
        for (let i = 0; i < term.rows * 3; i++) {
          term.writeln('test');
        }
        startYDisp = (term.rows * 2) + 1;
      });
      it('should scroll a single page', () => {
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollPages(-1);
        assert.equal(term.buffer.ydisp, startYDisp - (term.rows - 1));
        term.scrollPages(1);
        assert.equal(term.buffer.ydisp, startYDisp);
      });
      it('should scroll a multiple pages', () => {
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollPages(-2);
        assert.equal(term.buffer.ydisp, startYDisp - (term.rows - 1) * 2);
        term.scrollPages(2);
        assert.equal(term.buffer.ydisp, startYDisp);
      });
    });

    describe('scrollToTop', () => {
      beforeEach(() => {
        for (let i = 0; i < term.rows * 3; i++) {
          term.writeln('test');
        }
      });
      it('should scroll to the top', () => {
        assert.notEqual(term.buffer.ydisp, 0);
        term.scrollToTop();
        assert.equal(term.buffer.ydisp, 0);
      });
    });

    describe('scrollToBottom', () => {
      let startYDisp;
      beforeEach(() => {
        for (let i = 0; i < term.rows * 3; i++) {
          term.writeln('test');
        }
        startYDisp = (term.rows * 2) + 1;
      });
      it('should scroll to the bottom', () => {
        term.scrollDisp(-1);
        term.scrollToBottom();
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollPages(-1);
        term.scrollToBottom();
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollToTop();
        term.scrollToBottom();
        assert.equal(term.buffer.ydisp, startYDisp);
      });
    });

    describe('keyDown', () => {
      it('should scroll down, when a key is pressed and terminal is scrolled up', () => {
        // Override _evaluateKeyEscapeSequence to return cancel code
        (<any>term)._evaluateKeyEscapeSequence = () => {
          return { key: 'a' };
        };
        let event = <KeyboardEvent>{
          type: 'keydown',
          keyCode: 0,
          preventDefault: () => {},
          stopPropagation: () => {}
        };

        term.buffer.ydisp = 0;
        term.buffer.ybase = 40;
        term.keyDown(event);

        // Ensure that now the terminal is scrolled to bottom
        assert.equal(term.buffer.ydisp, term.buffer.ybase);
      });

      it('should not scroll down, when a custom keydown handler prevents the event', () => {
        // Add some output to the terminal
        for (let i = 0; i < term.rows * 3; i++) {
          term.writeln('test');
        }
        let startYDisp = (term.rows * 2) + 1;
        term.attachCustomKeyEventHandler(() => {
          return false;
        });

        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollDisp(-1);
        assert.equal(term.buffer.ydisp, startYDisp - 1);
        term.keyDown(<KeyboardEvent>{ keyCode: 0 });
        assert.equal(term.buffer.ydisp, startYDisp - 1);
      });
    });

    describe('scroll() function', () => {
      describe('when scrollback > 0', () => {
        it('should create a new line and scroll', () => {
          term.buffer.lines.get(0)[0][CHAR_DATA_CHAR_INDEX] = 'a';
          term.buffer.lines.get(INIT_ROWS - 1)[0][CHAR_DATA_CHAR_INDEX] = 'b';
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          term.scroll();
          assert.equal(term.buffer.lines.length, INIT_ROWS + 1);
          assert.equal(term.buffer.lines.get(0)[0][CHAR_DATA_CHAR_INDEX], 'a');
          assert.equal(term.buffer.lines.get(INIT_ROWS - 1)[0][CHAR_DATA_CHAR_INDEX], 'b');
          assert.equal(term.buffer.lines.get(INIT_ROWS)[0][CHAR_DATA_CHAR_INDEX], ' ');
        });

        it('should properly scroll inside a scroll region (scrollTop set)', () => {
          term.buffer.lines.get(0)[0][CHAR_DATA_CHAR_INDEX] = 'a';
          term.buffer.lines.get(1)[0][CHAR_DATA_CHAR_INDEX] = 'b';
          term.buffer.lines.get(2)[0][CHAR_DATA_CHAR_INDEX] = 'c';
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          term.buffer.scrollTop = 1;
          term.scroll();
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          assert.equal(term.buffer.lines.get(0)[0][CHAR_DATA_CHAR_INDEX], 'a');
          assert.equal(term.buffer.lines.get(1)[0][CHAR_DATA_CHAR_INDEX], 'c');
        });

        it('should properly scroll inside a scroll region (scrollBottom set)', () => {
          term.buffer.lines.get(0)[0][CHAR_DATA_CHAR_INDEX] = 'a';
          term.buffer.lines.get(1)[0][CHAR_DATA_CHAR_INDEX] = 'b';
          term.buffer.lines.get(2)[0][CHAR_DATA_CHAR_INDEX] = 'c';
          term.buffer.lines.get(3)[0][CHAR_DATA_CHAR_INDEX] = 'd';
          term.buffer.lines.get(4)[0][CHAR_DATA_CHAR_INDEX] = 'e';
          term.buffer.y = 3;
          term.buffer.scrollBottom = 3;
          term.scroll();
          assert.equal(term.buffer.lines.length, INIT_ROWS + 1);
          assert.equal(term.buffer.lines.get(0)[0][CHAR_DATA_CHAR_INDEX], 'a', '\'a\' should be pushed to the scrollback');
          assert.equal(term.buffer.lines.get(1)[0][CHAR_DATA_CHAR_INDEX], 'b');
          assert.equal(term.buffer.lines.get(2)[0][CHAR_DATA_CHAR_INDEX], 'c');
          assert.equal(term.buffer.lines.get(3)[0][CHAR_DATA_CHAR_INDEX], 'd');
          assert.equal(term.buffer.lines.get(4)[0][CHAR_DATA_CHAR_INDEX], ' ', 'a blank line should be added at scrollBottom\'s index');
          assert.equal(term.buffer.lines.get(5)[0][CHAR_DATA_CHAR_INDEX], 'e');
        });

        it('should properly scroll inside a scroll region (scrollTop and scrollBottom set)', () => {
          term.buffer.lines.get(0)[0][CHAR_DATA_CHAR_INDEX] = 'a';
          term.buffer.lines.get(1)[0][CHAR_DATA_CHAR_INDEX] = 'b';
          term.buffer.lines.get(2)[0][CHAR_DATA_CHAR_INDEX] = 'c';
          term.buffer.lines.get(3)[0][CHAR_DATA_CHAR_INDEX] = 'd';
          term.buffer.lines.get(4)[0][CHAR_DATA_CHAR_INDEX] = 'e';
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          term.buffer.scrollTop = 1;
          term.buffer.scrollBottom = 3;
          term.scroll();
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          assert.equal(term.buffer.lines.get(0)[0][CHAR_DATA_CHAR_INDEX], 'a');
          assert.equal(term.buffer.lines.get(1)[0][CHAR_DATA_CHAR_INDEX], 'c', '\'b\' should be removed from the buffer');
          assert.equal(term.buffer.lines.get(2)[0][CHAR_DATA_CHAR_INDEX], 'd');
          assert.equal(term.buffer.lines.get(3)[0][CHAR_DATA_CHAR_INDEX], ' ', 'a blank line should be added at scrollBottom\'s index');
          assert.equal(term.buffer.lines.get(4)[0][CHAR_DATA_CHAR_INDEX], 'e');
        });
      });

      describe('when scrollback === 0', () => {
        beforeEach(() => {
          term.setOption('scrollback', 0);
          assert.equal(term.buffer.lines.maxLength, INIT_ROWS);
        });

        it('should create a new line and shift everything up', () => {
          term.buffer.lines.get(0)[0][CHAR_DATA_CHAR_INDEX] = 'a';
          term.buffer.lines.get(1)[0][CHAR_DATA_CHAR_INDEX] = 'b';
          term.buffer.lines.get(INIT_ROWS - 1)[0][CHAR_DATA_CHAR_INDEX] = 'c';
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          term.scroll();
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          // 'a' gets pushed out of buffer
          assert.equal(term.buffer.lines.get(0)[0][CHAR_DATA_CHAR_INDEX], 'b');
          assert.equal(term.buffer.lines.get(1)[0][CHAR_DATA_CHAR_INDEX], ' ');
          assert.equal(term.buffer.lines.get(INIT_ROWS - 2)[0][CHAR_DATA_CHAR_INDEX], 'c');
          assert.equal(term.buffer.lines.get(INIT_ROWS - 1)[0][CHAR_DATA_CHAR_INDEX], ' ');
        });

        it('should properly scroll inside a scroll region (scrollTop set)', () => {
          term.buffer.lines.get(0)[0][CHAR_DATA_CHAR_INDEX] = 'a';
          term.buffer.lines.get(1)[0][CHAR_DATA_CHAR_INDEX] = 'b';
          term.buffer.lines.get(2)[0][CHAR_DATA_CHAR_INDEX] = 'c';
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          term.buffer.scrollTop = 1;
          term.scroll();
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          assert.equal(term.buffer.lines.get(0)[0][CHAR_DATA_CHAR_INDEX], 'a');
          assert.equal(term.buffer.lines.get(1)[0][CHAR_DATA_CHAR_INDEX], 'c');
        });

        it('should properly scroll inside a scroll region (scrollBottom set)', () => {
          term.buffer.lines.get(0)[0][CHAR_DATA_CHAR_INDEX] = 'a';
          term.buffer.lines.get(1)[0][CHAR_DATA_CHAR_INDEX] = 'b';
          term.buffer.lines.get(2)[0][CHAR_DATA_CHAR_INDEX] = 'c';
          term.buffer.lines.get(3)[0][CHAR_DATA_CHAR_INDEX] = 'd';
          term.buffer.lines.get(4)[0][CHAR_DATA_CHAR_INDEX] = 'e';
          term.buffer.y = 3;
          term.buffer.scrollBottom = 3;
          term.scroll();
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          assert.equal(term.buffer.lines.get(0)[0][CHAR_DATA_CHAR_INDEX], 'b');
          assert.equal(term.buffer.lines.get(1)[0][CHAR_DATA_CHAR_INDEX], 'c');
          assert.equal(term.buffer.lines.get(2)[0][CHAR_DATA_CHAR_INDEX], 'd');
          assert.equal(term.buffer.lines.get(3)[0][CHAR_DATA_CHAR_INDEX], ' ', 'a blank line should be added at scrollBottom\'s index');
          assert.equal(term.buffer.lines.get(4)[0][CHAR_DATA_CHAR_INDEX], 'e');
        });

        it('should properly scroll inside a scroll region (scrollTop and scrollBottom set)', () => {
          term.buffer.lines.get(0)[0][CHAR_DATA_CHAR_INDEX] = 'a';
          term.buffer.lines.get(1)[0][CHAR_DATA_CHAR_INDEX] = 'b';
          term.buffer.lines.get(2)[0][CHAR_DATA_CHAR_INDEX] = 'c';
          term.buffer.lines.get(3)[0][CHAR_DATA_CHAR_INDEX] = 'd';
          term.buffer.lines.get(4)[0][CHAR_DATA_CHAR_INDEX] = 'e';
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          term.buffer.scrollTop = 1;
          term.buffer.scrollBottom = 3;
          term.scroll();
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          assert.equal(term.buffer.lines.get(0)[0][CHAR_DATA_CHAR_INDEX], 'a');
          assert.equal(term.buffer.lines.get(1)[0][CHAR_DATA_CHAR_INDEX], 'c', '\'b\' should be removed from the buffer');
          assert.equal(term.buffer.lines.get(2)[0][CHAR_DATA_CHAR_INDEX], 'd');
          assert.equal(term.buffer.lines.get(3)[0][CHAR_DATA_CHAR_INDEX], ' ', 'a blank line should be added at scrollBottom\'s index');
          assert.equal(term.buffer.lines.get(4)[0][CHAR_DATA_CHAR_INDEX], 'e');
        });
      });
    });
  });

  describe('evaluateKeyEscapeSequence', () => {
    it('should return the correct escape sequence for unmodified keys', () => {
      // Backspace
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 8 }).key, '\x7f'); // ^?
      // Tab
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 9 }).key, '\t');
      // Return/enter
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 13 }).key, '\r'); // CR
      // Escape
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 27 }).key, '\x1b');
      // Page up, page down
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 33 }).key, '\x1b[5~'); // CSI 5 ~
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 34 }).key, '\x1b[6~'); // CSI 6 ~
      // End, Home
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 35 }).key, '\x1b[F'); // SS3 F
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 36 }).key, '\x1b[H'); // SS3 H
      // Left, up, right, down arrows
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 37 }).key, '\x1b[D'); // CSI D
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 38 }).key, '\x1b[A'); // CSI A
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 39 }).key, '\x1b[C'); // CSI C
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 40 }).key, '\x1b[B'); // CSI B
      // Insert
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 45 }).key, '\x1b[2~'); // CSI 2 ~
      // Delete
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 46 }).key, '\x1b[3~'); // CSI 3 ~
      // F1-F12
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 112 }).key, '\x1bOP'); // SS3 P
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 113 }).key, '\x1bOQ'); // SS3 Q
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 114 }).key, '\x1bOR'); // SS3 R
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 115 }).key, '\x1bOS'); // SS3 S
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 116 }).key, '\x1b[15~'); // CSI 1 5 ~
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 117 }).key, '\x1b[17~'); // CSI 1 7 ~
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 118 }).key, '\x1b[18~'); // CSI 1 8 ~
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 119 }).key, '\x1b[19~'); // CSI 1 9 ~
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 120 }).key, '\x1b[20~'); // CSI 2 0 ~
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 121 }).key, '\x1b[21~'); // CSI 2 1 ~
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 122 }).key, '\x1b[23~'); // CSI 2 3 ~
      assert.equal(term.evaluateKeyEscapeSequence({ keyCode: 123 }).key, '\x1b[24~'); // CSI 2 4 ~
    });
    it('should return \\x1b[3;5~ for ctrl+delete', () => {
      assert.equal(term.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 46 }).key, '\x1b[3;5~');
    });
    it('should return \\x1b[3;2~ for shift+delete', () => {
      assert.equal(term.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 46 }).key, '\x1b[3;2~');
    });
    it('should return \\x1b[3;3~ for alt+delete', () => {
      assert.equal(term.evaluateKeyEscapeSequence({ altKey: true, keyCode: 46 }).key, '\x1b[3;3~');
    });
    it('should return \\x1b[5D for ctrl+left', () => {
      assert.equal(term.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 37 }).key, '\x1b[1;5D'); // CSI 5 D
    });
    it('should return \\x1b[5C for ctrl+right', () => {
      assert.equal(term.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 39 }).key, '\x1b[1;5C'); // CSI 5 C
    });
    it('should return \\x1b[5A for ctrl+up', () => {
      assert.equal(term.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 38 }).key, '\x1b[1;5A'); // CSI 5 A
    });
    it('should return \\x1b[5B for ctrl+down', () => {
      assert.equal(term.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 40 }).key, '\x1b[1;5B'); // CSI 5 B
    });

    describe('On non-macOS platforms', () => {
      beforeEach(() => {
        term.browser.isMac = false;
      });
      // Evalueate alt + arrow key movement, which is a feature of terminal emulators but not VT100
      // http://unix.stackexchange.com/a/108106
      it('should return \\x1b[5D for alt+left', () => {
        assert.equal(term.evaluateKeyEscapeSequence({ altKey: true, keyCode: 37 }).key, '\x1b[1;5D'); // CSI 5 D
      });
      it('should return \\x1b[5C for alt+right', () => {
        assert.equal(term.evaluateKeyEscapeSequence({ altKey: true, keyCode: 39 }).key, '\x1b[1;5C'); // CSI 5 C
      });
    });

    describe('On macOS platforms', () => {
      beforeEach(() => {
        term.browser.isMac = true;
      });
      it('should return \\x1bb for alt+left', () => {
        assert.equal(term.evaluateKeyEscapeSequence({ altKey: true, keyCode: 37 }).key, '\x1bb'); // CSI 5 D
      });
      it('should return \\x1bf for alt+right', () => {
        assert.equal(term.evaluateKeyEscapeSequence({ altKey: true, keyCode: 39 }).key, '\x1bf'); // CSI 5 C
      });
    });

    it('should return \\x1b[5A for alt+up', () => {
      assert.equal(term.evaluateKeyEscapeSequence({ altKey: true, keyCode: 38 }).key, '\x1b[1;5A'); // CSI 5 A
    });
    it('should return \\x1b[5B for alt+down', () => {
      assert.equal(term.evaluateKeyEscapeSequence({ altKey: true, keyCode: 40 }).key, '\x1b[1;5B'); // CSI 5 B
    });
    it('should return the correct escape sequence for modified F1-F12 keys', () => {
      assert.equal(term.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 112 }).key, '\x1b[1;2P');
      assert.equal(term.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 113 }).key, '\x1b[1;2Q');
      assert.equal(term.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 114 }).key, '\x1b[1;2R');
      assert.equal(term.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 115 }).key, '\x1b[1;2S');
      assert.equal(term.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 116 }).key, '\x1b[15;2~');
      assert.equal(term.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 117 }).key, '\x1b[17;2~');
      assert.equal(term.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 118 }).key, '\x1b[18;2~');
      assert.equal(term.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 119 }).key, '\x1b[19;2~');
      assert.equal(term.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 120 }).key, '\x1b[20;2~');
      assert.equal(term.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 121 }).key, '\x1b[21;2~');
      assert.equal(term.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 122 }).key, '\x1b[23;2~');
      assert.equal(term.evaluateKeyEscapeSequence({ shiftKey: true, keyCode: 123 }).key, '\x1b[24;2~');
      assert.equal(term.evaluateKeyEscapeSequence({ altKey: true, keyCode: 112 }).key, '\x1b[1;3P');
      assert.equal(term.evaluateKeyEscapeSequence({ altKey: true, keyCode: 113 }).key, '\x1b[1;3Q');
      assert.equal(term.evaluateKeyEscapeSequence({ altKey: true, keyCode: 114 }).key, '\x1b[1;3R');
      assert.equal(term.evaluateKeyEscapeSequence({ altKey: true, keyCode: 115 }).key, '\x1b[1;3S');
      assert.equal(term.evaluateKeyEscapeSequence({ altKey: true, keyCode: 116 }).key, '\x1b[15;3~');
      assert.equal(term.evaluateKeyEscapeSequence({ altKey: true, keyCode: 117 }).key, '\x1b[17;3~');
      assert.equal(term.evaluateKeyEscapeSequence({ altKey: true, keyCode: 118 }).key, '\x1b[18;3~');
      assert.equal(term.evaluateKeyEscapeSequence({ altKey: true, keyCode: 119 }).key, '\x1b[19;3~');
      assert.equal(term.evaluateKeyEscapeSequence({ altKey: true, keyCode: 120 }).key, '\x1b[20;3~');
      assert.equal(term.evaluateKeyEscapeSequence({ altKey: true, keyCode: 121 }).key, '\x1b[21;3~');
      assert.equal(term.evaluateKeyEscapeSequence({ altKey: true, keyCode: 122 }).key, '\x1b[23;3~');
      assert.equal(term.evaluateKeyEscapeSequence({ altKey: true, keyCode: 123 }).key, '\x1b[24;3~');

      assert.equal(term.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 112 }).key, '\x1b[1;5P');
      assert.equal(term.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 113 }).key, '\x1b[1;5Q');
      assert.equal(term.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 114 }).key, '\x1b[1;5R');
      assert.equal(term.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 115 }).key, '\x1b[1;5S');
      assert.equal(term.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 116 }).key, '\x1b[15;5~');
      assert.equal(term.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 117 }).key, '\x1b[17;5~');
      assert.equal(term.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 118 }).key, '\x1b[18;5~');
      assert.equal(term.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 119 }).key, '\x1b[19;5~');
      assert.equal(term.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 120 }).key, '\x1b[20;5~');
      assert.equal(term.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 121 }).key, '\x1b[21;5~');
      assert.equal(term.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 122 }).key, '\x1b[23;5~');
      assert.equal(term.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 123 }).key, '\x1b[24;5~');
    });
  });

  describe('Third level shift', () => {
    let evKeyDown;
    let evKeyPress;

    beforeEach(() => {
      term.handler = () => {};
      term.showCursor = () => {};
      term.clearSelection = () => {};
      // term.compositionHelper = {
      //   isComposing: false,
      //   keydown: {
      //     bind: () => {
      //       return () => { return true; };
      //     }
      //   }
      // };
      evKeyDown = {
        preventDefault: () => {},
        stopPropagation: () => {},
        type: 'keydown',
        altKey: null,
        keyCode: null
      };
      evKeyPress = {
        preventDefault: () => {},
        stopPropagation: () => {},
        type: 'keypress',
        altKey: null,
        charCode: null,
        keyCode: null
      };
    });

    describe('On Mac OS', () => {
      beforeEach(() => {
        term.browser.isMac = true;
      });

      it('should not interfere with the alt key on keyDown', () => {
        evKeyDown.altKey = true;
        evKeyDown.keyCode = 81;
        assert.equal(term.keyDown(evKeyDown), true);
        evKeyDown.altKey = true;
        evKeyDown.keyCode = 192;
        assert.equal(term.keyDown(evKeyDown), true);
      });

      it('should interefere with the alt + arrow keys', () => {
        evKeyDown.altKey = true;
        evKeyDown.keyCode = 37;
        assert.equal(term.keyDown(evKeyDown), false);
        evKeyDown.altKey = true;
        evKeyDown.keyCode = 39;
        assert.equal(term.keyDown(evKeyDown), false);
      });

      it('should emit key with alt + key on keyPress', (done) => {
        let keys = ['@', '@', '\\', '\\', '|', '|'];

        term.on('keypress', (key) => {
          if (key) {
            let index = keys.indexOf(key);
            assert(index !== -1, 'Emitted wrong key: ' + key);
            keys.splice(index, 1);
          }
          if (keys.length === 0) done();
        });

        evKeyPress.altKey = true;
        // @
        evKeyPress.charCode = null;
        evKeyPress.keyCode = 64;
        term.keyPress(evKeyPress);
        // Firefox @
        evKeyPress.charCode = 64;
        evKeyPress.keyCode = 0;
        term.keyPress(evKeyPress);
        // \
        evKeyPress.charCode = null;
        evKeyPress.keyCode = 92;
        term.keyPress(evKeyPress);
        // Firefox \
        evKeyPress.charCode = 92;
        evKeyPress.keyCode = 0;
        term.keyPress(evKeyPress);
        // |
        evKeyPress.charCode = null;
        evKeyPress.keyCode = 124;
        term.keyPress(evKeyPress);
        // Firefox |
        evKeyPress.charCode = 124;
        evKeyPress.keyCode = 0;
        term.keyPress(evKeyPress);
      });
    });

    describe('On MS Windows', () => {
      beforeEach(() => {
        term.browser.isMSWindows = true;
      });

      it('should not interfere with the alt + ctrl key on keyDown', () => {
        evKeyPress.altKey = true;
        evKeyPress.ctrlKey = true;
        evKeyPress.keyCode = 81;
        assert.equal(term.keyDown(evKeyPress), true);
        evKeyDown.altKey = true;
        evKeyDown.ctrlKey = true;
        evKeyDown.keyCode = 81;
        assert.equal(term.keyDown(evKeyDown), true);
      });

      it('should interefere with the alt + ctrl + arrow keys', () => {
        evKeyDown.altKey = true;
        evKeyDown.ctrlKey = true;

        evKeyDown.keyCode = 37;
        assert.equal(term.keyDown(evKeyDown), false);
        evKeyDown.keyCode = 39;
        assert.equal(term.keyDown(evKeyDown), false);
      });

      it('should emit key with alt + ctrl + key on keyPress', (done) => {
        let keys = ['@', '@', '\\', '\\', '|', '|'];

        term.on('keypress', (key) => {
          if (key) {
            let index = keys.indexOf(key);
            assert(index !== -1, 'Emitted wrong key: ' + key);
            keys.splice(index, 1);
          }
          if (keys.length === 0) done();
        });

        evKeyPress.altKey = true;
        evKeyPress.ctrlKey = true;

        // @
        evKeyPress.charCode = null;
        evKeyPress.keyCode = 64;
        term.keyPress(evKeyPress);
        // Firefox @
        evKeyPress.charCode = 64;
        evKeyPress.keyCode = 0;
        term.keyPress(evKeyPress);
        // \
        evKeyPress.charCode = null;
        evKeyPress.keyCode = 92;
        term.keyPress(evKeyPress);
        // Firefox \
        evKeyPress.charCode = 92;
        evKeyPress.keyCode = 0;
        term.keyPress(evKeyPress);
        // |
        evKeyPress.charCode = null;
        evKeyPress.keyCode = 124;
        term.keyPress(evKeyPress);
        // Firefox |
        evKeyPress.charCode = 124;
        evKeyPress.keyCode = 0;
        term.keyPress(evKeyPress);
      });
    });
  });

  describe('unicode - surrogates', () => {
    it('2 characters per cell', function (): void {
      this.timeout(10000);  // This is needed because istanbul patches code and slows it down
      let high = String.fromCharCode(0xD800);
      for (let i = 0xDC00; i <= 0xDCFF; ++i) {
        term.write(high + String.fromCharCode(i));
        let tchar = term.buffer.lines.get(0)[0];
        expect(tchar[CHAR_DATA_CHAR_INDEX]).eql(high + String.fromCharCode(i));
        expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(2);
        expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(1);
        expect(term.buffer.lines.get(0)[1][CHAR_DATA_CHAR_INDEX]).eql(' ');
        term.reset();
      }
    });
    it('2 characters at last cell', () => {
      let high = String.fromCharCode(0xD800);
      for (let i = 0xDC00; i <= 0xDCFF; ++i) {
        term.buffer.x = term.cols - 1;
        term.write(high + String.fromCharCode(i));
        expect(term.buffer.lines.get(0)[term.buffer.x - 1][CHAR_DATA_CHAR_INDEX]).eql(high + String.fromCharCode(i));
        expect(term.buffer.lines.get(0)[term.buffer.x - 1][CHAR_DATA_CHAR_INDEX].length).eql(2);
        expect(term.buffer.lines.get(1)[0][CHAR_DATA_CHAR_INDEX]).eql(' ');
        term.reset();
      }
    });
    it('2 characters per cell over line end with autowrap', () => {
      let high = String.fromCharCode(0xD800);
      for (let i = 0xDC00; i <= 0xDCFF; ++i) {
        term.buffer.x = term.cols - 1;
        term.wraparoundMode = true;
        term.write('a' + high + String.fromCharCode(i));
        expect(term.buffer.lines.get(0)[term.cols - 1][CHAR_DATA_CHAR_INDEX]).eql('a');
        expect(term.buffer.lines.get(1)[0][CHAR_DATA_CHAR_INDEX]).eql(high + String.fromCharCode(i));
        expect(term.buffer.lines.get(1)[0][CHAR_DATA_CHAR_INDEX].length).eql(2);
        expect(term.buffer.lines.get(1)[1][CHAR_DATA_CHAR_INDEX]).eql(' ');
        term.reset();
      }
    });
    it('2 characters per cell over line end without autowrap', () => {
      let high = String.fromCharCode(0xD800);
      for (let i = 0xDC00; i <= 0xDCFF; ++i) {
        term.buffer.x = term.cols - 1;
        term.wraparoundMode = false;
        term.write('a' + high + String.fromCharCode(i));
        // auto wraparound mode should cut off the rest of the line
        expect(term.buffer.lines.get(0)[term.cols - 1][CHAR_DATA_CHAR_INDEX]).eql('a');
        expect(term.buffer.lines.get(0)[term.cols - 1][CHAR_DATA_CHAR_INDEX].length).eql(1);
        expect(term.buffer.lines.get(1)[1][CHAR_DATA_CHAR_INDEX]).eql(' ');
        term.reset();
      }
    });
    it('splitted surrogates', () => {
      let high = String.fromCharCode(0xD800);
      for (let i = 0xDC00; i <= 0xDCFF; ++i) {
        term.write(high);
        term.write(String.fromCharCode(i));
        let tchar = term.buffer.lines.get(0)[0];
        expect(tchar[CHAR_DATA_CHAR_INDEX]).eql(high + String.fromCharCode(i));
        expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(2);
        expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(1);
        expect(term.buffer.lines.get(0)[1][CHAR_DATA_CHAR_INDEX]).eql(' ');
        term.reset();
      }
    });
  });

  describe('unicode - combining characters', () => {
    it('café', () => {
      term.write('cafe\u0301');
      expect(term.buffer.lines.get(0)[3][CHAR_DATA_CHAR_INDEX]).eql('e\u0301');
      expect(term.buffer.lines.get(0)[3][CHAR_DATA_CHAR_INDEX].length).eql(2);
      expect(term.buffer.lines.get(0)[3][CHAR_DATA_WIDTH_INDEX]).eql(1);
    });
    it('café - end of line', () => {
      term.buffer.x = term.cols - 1 - 3;
      term.write('cafe\u0301');
      expect(term.buffer.lines.get(0)[term.cols - 1][CHAR_DATA_CHAR_INDEX]).eql('e\u0301');
      expect(term.buffer.lines.get(0)[term.cols - 1][CHAR_DATA_CHAR_INDEX].length).eql(2);
      expect(term.buffer.lines.get(0)[term.cols - 1][CHAR_DATA_WIDTH_INDEX]).eql(1);
      expect(term.buffer.lines.get(0)[1][CHAR_DATA_CHAR_INDEX]).eql(' ');
      expect(term.buffer.lines.get(0)[1][CHAR_DATA_CHAR_INDEX].length).eql(1);
      expect(term.buffer.lines.get(0)[1][CHAR_DATA_WIDTH_INDEX]).eql(1);
    });
    it('multiple combined é', () => {
      term.wraparoundMode = true;
      term.write(Array(100).join('e\u0301'));
      for (let i = 0; i < term.cols; ++i) {
        let tchar = term.buffer.lines.get(0)[i];
        expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('e\u0301');
        expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(2);
        expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(1);
      }
      let tchar = term.buffer.lines.get(1)[0];
      expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('e\u0301');
      expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(2);
      expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(1);
    });
    it('multiple surrogate with combined', () => {
      term.wraparoundMode = true;
      term.write(Array(100).join('\uD800\uDC00\u0301'));
      for (let i = 0; i < term.cols; ++i) {
        let tchar = term.buffer.lines.get(0)[i];
        expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('\uD800\uDC00\u0301');
        expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(3);
        expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(1);
      }
      let tchar = term.buffer.lines.get(1)[0];
      expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('\uD800\uDC00\u0301');
      expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(3);
      expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(1);
    });
  });

  describe('unicode - fullwidth characters', () => {
    it('cursor movement even', () => {
      expect(term.buffer.x).eql(0);
      term.write('￥');
      expect(term.buffer.x).eql(2);
    });
    it('cursor movement odd', () => {
      term.buffer.x = 1;
      expect(term.buffer.x).eql(1);
      term.write('￥');
      expect(term.buffer.x).eql(3);
    });
    it('line of ￥ even', () => {
      term.wraparoundMode = true;
      term.write(Array(50).join('￥'));
      for (let i = 0; i < term.cols; ++i) {
        let tchar = term.buffer.lines.get(0)[i];
        if (i % 2) {
          expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('');
          expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(0);
          expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(0);
        } else {
          expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('￥');
          expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(1);
          expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(2);
        }
      }
      let tchar = term.buffer.lines.get(1)[0];
      expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('￥');
      expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(1);
      expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(2);
    });
    it('line of ￥ odd', () => {
      term.wraparoundMode = true;
      term.buffer.x = 1;
      term.write(Array(50).join('￥'));
      for (let i = 1; i < term.cols - 1; ++i) {
        let tchar = term.buffer.lines.get(0)[i];
        if (!(i % 2)) {
          expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('');
          expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(0);
          expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(0);
        } else {
          expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('￥');
          expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(1);
          expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(2);
        }
      }
      let tchar = term.buffer.lines.get(0)[term.cols - 1];
      expect(tchar[CHAR_DATA_CHAR_INDEX]).eql(' ');
      expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(1);
      expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(1);
      tchar = term.buffer.lines.get(1)[0];
      expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('￥');
      expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(1);
      expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(2);
    });
    it('line of ￥ with combining odd', () => {
      term.wraparoundMode = true;
      term.buffer.x = 1;
      term.write(Array(50).join('￥\u0301'));
      for (let i = 1; i < term.cols - 1; ++i) {
        let tchar = term.buffer.lines.get(0)[i];
        if (!(i % 2)) {
          expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('');
          expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(0);
          expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(0);
        } else {
          expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('￥\u0301');
          expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(2);
          expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(2);
        }
      }
      let tchar = term.buffer.lines.get(0)[term.cols - 1];
      expect(tchar[CHAR_DATA_CHAR_INDEX]).eql(' ');
      expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(1);
      expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(1);
      tchar = term.buffer.lines.get(1)[0];
      expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('￥\u0301');
      expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(2);
      expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(2);
    });
    it('line of ￥ with combining even', () => {
      term.wraparoundMode = true;
      term.write(Array(50).join('￥\u0301'));
      for (let i = 0; i < term.cols; ++i) {
        let tchar = term.buffer.lines.get(0)[i];
        if (i % 2) {
          expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('');
          expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(0);
          expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(0);
        } else {
          expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('￥\u0301');
          expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(2);
          expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(2);
        }
      }
      let tchar = term.buffer.lines.get(1)[0];
      expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('￥\u0301');
      expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(2);
      expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(2);
    });
    it('line of surrogate fullwidth with combining odd', () => {
      term.wraparoundMode = true;
      term.buffer.x = 1;
      term.write(Array(50).join('\ud843\ude6d\u0301'));
      for (let i = 1; i < term.cols - 1; ++i) {
        let tchar = term.buffer.lines.get(0)[i];
        if (!(i % 2)) {
          expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('');
          expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(0);
          expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(0);
        } else {
          expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('\ud843\ude6d\u0301');
          expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(3);
          expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(2);
        }
      }
      let tchar = term.buffer.lines.get(0)[term.cols - 1];
      expect(tchar[CHAR_DATA_CHAR_INDEX]).eql(' ');
      expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(1);
      expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(1);
      tchar = term.buffer.lines.get(1)[0];
      expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('\ud843\ude6d\u0301');
      expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(3);
      expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(2);
    });
    it('line of surrogate fullwidth with combining even', () => {
      term.wraparoundMode = true;
      term.write(Array(50).join('\ud843\ude6d\u0301'));
      for (let i = 0; i < term.cols; ++i) {
        let tchar = term.buffer.lines.get(0)[i];
        if (i % 2) {
          expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('');
          expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(0);
          expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(0);
        } else {
          expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('\ud843\ude6d\u0301');
          expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(3);
          expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(2);
        }
      }
      let tchar = term.buffer.lines.get(1)[0];
      expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('\ud843\ude6d\u0301');
      expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(3);
      expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(2);
    });
  });

  describe('insert mode', () => {
    it('halfwidth - all', () => {
      term.write(Array(9).join('0123456789').slice(-80));
      term.buffer.x = 10;
      term.buffer.y = 0;
      term.insertMode = true;
      term.write('abcde');
      expect(term.buffer.lines.get(0).length).eql(term.cols);
      expect(term.buffer.lines.get(0)[10][CHAR_DATA_CHAR_INDEX]).eql('a');
      expect(term.buffer.lines.get(0)[14][CHAR_DATA_CHAR_INDEX]).eql('e');
      expect(term.buffer.lines.get(0)[15][CHAR_DATA_CHAR_INDEX]).eql('0');
      expect(term.buffer.lines.get(0)[79][CHAR_DATA_CHAR_INDEX]).eql('4');
    });
    it('fullwidth - insert', () => {
      term.write(Array(9).join('0123456789').slice(-80));
      term.buffer.x = 10;
      term.buffer.y = 0;
      term.insertMode = true;
      term.write('￥￥￥');
      expect(term.buffer.lines.get(0).length).eql(term.cols);
      expect(term.buffer.lines.get(0)[10][CHAR_DATA_CHAR_INDEX]).eql('￥');
      expect(term.buffer.lines.get(0)[11][CHAR_DATA_CHAR_INDEX]).eql('');
      expect(term.buffer.lines.get(0)[14][CHAR_DATA_CHAR_INDEX]).eql('￥');
      expect(term.buffer.lines.get(0)[15][CHAR_DATA_CHAR_INDEX]).eql('');
      expect(term.buffer.lines.get(0)[79][CHAR_DATA_CHAR_INDEX]).eql('3');
    });
    it('fullwidth - right border', () => {
      term.write(Array(41).join('￥'));
      term.buffer.x = 10;
      term.buffer.y = 0;
      term.insertMode = true;
      term.write('a');
      expect(term.buffer.lines.get(0).length).eql(term.cols);
      expect(term.buffer.lines.get(0)[10][CHAR_DATA_CHAR_INDEX]).eql('a');
      expect(term.buffer.lines.get(0)[11][CHAR_DATA_CHAR_INDEX]).eql('￥');
      expect(term.buffer.lines.get(0)[79][CHAR_DATA_CHAR_INDEX]).eql(' ');  // fullwidth char got replaced
      term.write('b');
      expect(term.buffer.lines.get(0).length).eql(term.cols);
      expect(term.buffer.lines.get(0)[11][CHAR_DATA_CHAR_INDEX]).eql('b');
      expect(term.buffer.lines.get(0)[12][CHAR_DATA_CHAR_INDEX]).eql('￥');
      expect(term.buffer.lines.get(0)[79][CHAR_DATA_CHAR_INDEX]).eql('');  // empty cell after fullwidth
    });
  });
});
