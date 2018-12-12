/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert, expect } from 'chai';
import { Terminal } from './Terminal';
import { MockViewport, MockCompositionHelper, MockRenderer } from './ui/TestUtils.test';
import { CHAR_DATA_CHAR_INDEX, CHAR_DATA_WIDTH_INDEX, DEFAULT_ATTR } from './Buffer';

const INIT_COLS = 80;
const INIT_ROWS = 24;

class TestTerminal extends Terminal {
  public keyDown(ev: any): boolean { return this._keyDown(ev); }
  public keyPress(ev: any): boolean { return this._keyPress(ev); }
}

describe('term.js addons', () => {
  let term: TestTerminal;
  const termOptions = {
    cols: INIT_COLS,
    rows: INIT_ROWS
  };

  beforeEach(() => {
    term = new TestTerminal(termOptions);
    term.refresh = () => { };
    (<any>term).renderer = new MockRenderer();
    term.viewport = new MockViewport();
    (<any>term)._compositionHelper = new MockCompositionHelper();
    // Force synchronous writes
    term.write = (data) => {
      term.writeBuffer.push(data);
      (<any>term)._innerWrite();
    };
    (<any>term).element = {
      classList: {
        toggle: () => { },
        remove: () => { }
      }
    };
  });

  it('should not mutate the options parameter', () => {
    term.setOption('cols', 1000);

    assert.deepEqual(termOptions, {
      cols: INIT_COLS,
      rows: INIT_ROWS
    });
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

  describe('on', () => {
    beforeEach(() => {
      term.on('key', () => { });
      term.on('keypress', () => { });
      term.on('keydown', () => { });
    });

    describe('data', () => {
      it('should emit a data event', (done) => {
        term.on('data', () => {
          done();
        });

        term.handler('fake');
      });
    });

    describe(`keypress (including 'key' event)`, () => {
      it('should receive a string and event object', (done) => {
        let steps = 0;

        const finish = () => {
          if ((++steps) === 2) {
            done();
          }
        };

        const evKeyPress = <KeyboardEvent>{
          preventDefault: () => { },
          stopPropagation: () => { },
          type: 'keypress',
          keyCode: 13
        };

        term.on('keypress', (key, event) => {
          assert.equal(typeof key, 'string');
          expect(event).to.be.an.instanceof(Object);
          finish();
        });

        term.on('key', (key, event) => {
          assert.equal(typeof key, 'string');
          expect(event).to.be.an.instanceof(Object);
          finish();
        });

        term.keyPress(evKeyPress);
      });
    });

    describe(`keydown (including 'key' event)`, () => {
      it(`should receive an event object for 'keydown' and a string and event object for 'key'`, (done) => {
        let steps = 0;

        const finish = () => {
          if ((++steps) === 2) {
            done();
          }
        };

        const evKeyDown = <KeyboardEvent>{
          preventDefault: () => { },
          stopPropagation: () => { },
          type: 'keydown',
          keyCode: 13
        };

        term.on('keydown', (event) => {
          expect(event).to.be.an.instanceof(Object);
          finish();
        });

        term.on('key', (key, event) => {
          assert.equal(typeof key, 'string');
          expect(event).to.be.an.instanceof(Object);
          finish();
        });

        term.keyDown(evKeyDown);
      });
    });

    describe('resize', () => {
      it('should receive an object: {cols: number, rows: number}', (done) => {
        term.on('resize', (data) => {
          expect(data).to.have.keys(['cols', 'rows']);
          assert.equal(typeof data.cols, 'number');
          assert.equal(typeof data.rows, 'number');
          done();
        });

        term.resize(1, 1);
      });
    });

    describe('scroll', () => {
      it('should receive a number', (done) => {
        term.on('scroll', (ydisp) => {
          assert.equal(typeof ydisp, 'number');
          done();
        });

        term.scroll();
      });
    });

    describe('title', () => {
      it('should receive a string', (done) => {
        term.on('title', (title) => {
          assert.equal(typeof title, 'string');
          done();
        });

        term.handleTitle('title');
      });
    });
  });

  describe('attachCustomKeyEventHandler', () => {
    const evKeyDown = <KeyboardEvent>{
      preventDefault: () => { },
      stopPropagation: () => { },
      type: 'keydown',
      keyCode: 77
    };
    const evKeyPress = <KeyboardEvent>{
      preventDefault: () => { },
      stopPropagation: () => { },
      type: 'keypress',
      keyCode: 77
    };

    beforeEach(() => {
      term.handler = () => { };
      term.showCursor = () => { };
      term.clearSelection = () => { };
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

  describe('reset', () => {
    it('should not affect cursorState', () => {
      term.cursorState = 1;
      term.reset();
      assert.equal(term.cursorState, 1);
      term.cursorState = 0;
      term.reset();
      assert.equal(term.cursorState, 0);
    });
  });

  describe('clear', () => {
    it('should clear a buffer equal to rows', () => {
      const promptLine = term.buffer.lines.get(term.buffer.ybase + term.buffer.y);
      term.clear();
      assert.equal(term.buffer.y, 0);
      assert.equal(term.buffer.ybase, 0);
      assert.equal(term.buffer.ydisp, 0);
      assert.equal(term.buffer.lines.length, term.rows);
      assert.deepEqual(term.buffer.lines.get(0), promptLine);
      for (let i = 1; i < term.rows; i++) {
        assert.deepEqual(term.buffer.lines.get(i), term.buffer.getBlankLine(DEFAULT_ATTR));
      }
    });
    it('should clear a buffer larger than rows', () => {
      // Fill the buffer with dummy rows
      for (let i = 0; i < term.rows * 2; i++) {
        term.write('test\n');
      }

      const promptLine = term.buffer.lines.get(term.buffer.ybase + term.buffer.y);
      term.clear();
      assert.equal(term.buffer.y, 0);
      assert.equal(term.buffer.ybase, 0);
      assert.equal(term.buffer.ydisp, 0);
      assert.equal(term.buffer.lines.length, term.rows);
      assert.deepEqual(term.buffer.lines.get(0), promptLine);
      for (let i = 1; i < term.rows; i++) {
        assert.deepEqual(term.buffer.lines.get(i), term.buffer.getBlankLine(DEFAULT_ATTR));
      }
    });
    it('should not break the prompt when cleared twice', () => {
      const promptLine = term.buffer.lines.get(term.buffer.ybase + term.buffer.y);
      term.clear();
      term.clear();
      assert.equal(term.buffer.y, 0);
      assert.equal(term.buffer.ybase, 0);
      assert.equal(term.buffer.ydisp, 0);
      assert.equal(term.buffer.lines.length, term.rows);
      assert.deepEqual(term.buffer.lines.get(0), promptLine);
      for (let i = 1; i < term.rows; i++) {
        assert.deepEqual(term.buffer.lines.get(i), term.buffer.getBlankLine(DEFAULT_ATTR));
      }
    });
  });

  describe('scroll', () => {
    describe('scrollLines', () => {
      let startYDisp: number;
      beforeEach(() => {
        for (let i = 0; i < term.rows * 2; i++) {
          term.writeln('test');
        }
        startYDisp = term.rows + 1;
      });
      it('should scroll a single line', () => {
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollLines(-1);
        assert.equal(term.buffer.ydisp, startYDisp - 1);
        term.scrollLines(1);
        assert.equal(term.buffer.ydisp, startYDisp);
      });
      it('should scroll multiple lines', () => {
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollLines(-5);
        assert.equal(term.buffer.ydisp, startYDisp - 5);
        term.scrollLines(5);
        assert.equal(term.buffer.ydisp, startYDisp);
      });
      it('should not scroll beyond the bounds of the buffer', () => {
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollLines(1);
        assert.equal(term.buffer.ydisp, startYDisp);
        for (let i = 0; i < startYDisp; i++) {
          term.scrollLines(-1);
        }
        assert.equal(term.buffer.ydisp, 0);
        term.scrollLines(-1);
        assert.equal(term.buffer.ydisp, 0);
      });
    });

    describe('scrollPages', () => {
      let startYDisp: number;
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
      let startYDisp: number;
      beforeEach(() => {
        for (let i = 0; i < term.rows * 3; i++) {
          term.writeln('test');
        }
        startYDisp = (term.rows * 2) + 1;
      });
      it('should scroll to the bottom', () => {
        term.scrollLines(-1);
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

    describe('scrollToLine', () => {
      let startYDisp: number;
      beforeEach(() => {
        for (let i = 0; i < term.rows * 3; i++) {
          term.writeln('test');
        }
        startYDisp = (term.rows * 2) + 1;
      });
      it('should scroll to requested line', () => {
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollToLine(0);
        assert.equal(term.buffer.ydisp, 0);
        term.scrollToLine(10);
        assert.equal(term.buffer.ydisp, 10);
        term.scrollToLine(startYDisp);
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollToLine(20);
        assert.equal(term.buffer.ydisp, 20);
      });
      it('should not scroll beyond boundary lines', () => {
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollToLine(-1);
        assert.equal(term.buffer.ydisp, 0);
        term.scrollToLine(startYDisp + 1);
        assert.equal(term.buffer.ydisp, startYDisp);
      });
    });

    describe('keyPress', () => {
      it('should scroll down, when a key is pressed and terminal is scrolled up', () => {
        const event = <KeyboardEvent>{
          type: 'keydown',
          key: 'a',
          keyCode: 65,
          preventDefault: () => { },
          stopPropagation: () => { }
        };

        term.buffer.ydisp = 0;
        term.buffer.ybase = 40;
        term.keyPress(event);

        // Ensure that now the terminal is scrolled to bottom
        assert.equal(term.buffer.ydisp, term.buffer.ybase);
      });

      it('should not scroll down, when a custom keydown handler prevents the event', () => {
        // Add some output to the terminal
        for (let i = 0; i < term.rows * 3; i++) {
          term.writeln('test');
        }
        const startYDisp = (term.rows * 2) + 1;
        term.attachCustomKeyEventHandler(() => {
          return false;
        });

        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollLines(-1);
        assert.equal(term.buffer.ydisp, startYDisp - 1);
        term.keyPress(<KeyboardEvent>{ keyCode: 0 });
        assert.equal(term.buffer.ydisp, startYDisp - 1);
      });
    });

    describe('scroll() function', () => {
      describe('when scrollback > 0', () => {
        it('should create a new line and scroll', () => {
          term.buffer.lines.get(0).set(0, [0, 'a', 0, 'a'.charCodeAt(0)]);
          term.buffer.lines.get(INIT_ROWS - 1).set(0, [0, 'b', 0, 'b'.charCodeAt(0)]);
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          term.scroll();
          assert.equal(term.buffer.lines.length, INIT_ROWS + 1);
          assert.equal(term.buffer.lines.get(0).get(0)[CHAR_DATA_CHAR_INDEX], 'a');
          assert.equal(term.buffer.lines.get(INIT_ROWS - 1).get(0)[CHAR_DATA_CHAR_INDEX], 'b');
          assert.equal(term.buffer.lines.get(INIT_ROWS).get(0)[CHAR_DATA_CHAR_INDEX], '');
        });

        it('should properly scroll inside a scroll region (scrollTop set)', () => {
          term.buffer.lines.get(0).set(0, [0, 'a', 0, 'a'.charCodeAt(0)]);
          term.buffer.lines.get(1).set(0, [0, 'b', 0, 'b'.charCodeAt(0)]);
          term.buffer.lines.get(2).set(0, [0, 'c', 0, 'c'.charCodeAt(0)]);
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          term.buffer.scrollTop = 1;
          term.scroll();
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          assert.equal(term.buffer.lines.get(0).get(0)[CHAR_DATA_CHAR_INDEX], 'a');
          assert.equal(term.buffer.lines.get(1).get(0)[CHAR_DATA_CHAR_INDEX], 'c');
        });

        it('should properly scroll inside a scroll region (scrollBottom set)', () => {
          term.buffer.lines.get(0).set(0, [0, 'a', 0, 'a'.charCodeAt(0)]);
          term.buffer.lines.get(1).set(0, [0, 'b', 0, 'b'.charCodeAt(0)]);
          term.buffer.lines.get(2).set(0, [0, 'c', 0, 'c'.charCodeAt(0)]);
          term.buffer.lines.get(3).set(0, [0, 'd', 0, 'd'.charCodeAt(0)]);
          term.buffer.lines.get(4).set(0, [0, 'e', 0, 'e'.charCodeAt(0)]);
          term.buffer.y = 3;
          term.buffer.scrollBottom = 3;
          term.scroll();
          assert.equal(term.buffer.lines.length, INIT_ROWS + 1);
          assert.equal(term.buffer.lines.get(0).get(0)[CHAR_DATA_CHAR_INDEX], 'a', '\'a\' should be pushed to the scrollback');
          assert.equal(term.buffer.lines.get(1).get(0)[CHAR_DATA_CHAR_INDEX], 'b');
          assert.equal(term.buffer.lines.get(2).get(0)[CHAR_DATA_CHAR_INDEX], 'c');
          assert.equal(term.buffer.lines.get(3).get(0)[CHAR_DATA_CHAR_INDEX], 'd');
          assert.equal(term.buffer.lines.get(4).get(0)[CHAR_DATA_CHAR_INDEX], '', 'a blank line should be added at scrollBottom\'s index');
          assert.equal(term.buffer.lines.get(5).get(0)[CHAR_DATA_CHAR_INDEX], 'e');
        });

        it('should properly scroll inside a scroll region (scrollTop and scrollBottom set)', () => {
          term.buffer.lines.get(0).set(0, [0, 'a', 0, 'a'.charCodeAt(0)]);
          term.buffer.lines.get(1).set(0, [0, 'b', 0, 'b'.charCodeAt(0)]);
          term.buffer.lines.get(2).set(0, [0, 'c', 0, 'c'.charCodeAt(0)]);
          term.buffer.lines.get(3).set(0, [0, 'd', 0, 'd'.charCodeAt(0)]);
          term.buffer.lines.get(4).set(0, [0, 'e', 0, 'e'.charCodeAt(0)]);
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          term.buffer.scrollTop = 1;
          term.buffer.scrollBottom = 3;
          term.scroll();
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          assert.equal(term.buffer.lines.get(0).get(0)[CHAR_DATA_CHAR_INDEX], 'a');
          assert.equal(term.buffer.lines.get(1).get(0)[CHAR_DATA_CHAR_INDEX], 'c', '\'b\' should be removed from the buffer');
          assert.equal(term.buffer.lines.get(2).get(0)[CHAR_DATA_CHAR_INDEX], 'd');
          assert.equal(term.buffer.lines.get(3).get(0)[CHAR_DATA_CHAR_INDEX], '', 'a blank line should be added at scrollBottom\'s index');
          assert.equal(term.buffer.lines.get(4).get(0)[CHAR_DATA_CHAR_INDEX], 'e');
        });
      });

      describe('when scrollback === 0', () => {
        beforeEach(() => {
          term.setOption('scrollback', 0);
          assert.equal(term.buffer.lines.maxLength, INIT_ROWS);
        });

        it('should create a new line and shift everything up', () => {
          term.buffer.lines.get(0).set(0, [0, 'a', 0, 'a'.charCodeAt(0)]);
          term.buffer.lines.get(1).set(0, [0, 'b', 0, 'b'.charCodeAt(0)]);
          term.buffer.lines.get(INIT_ROWS - 1).set(0, [0, 'c', 0, 'c'.charCodeAt(0)]);
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          term.scroll();
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          // 'a' gets pushed out of buffer
          assert.equal(term.buffer.lines.get(0).get(0)[CHAR_DATA_CHAR_INDEX], 'b');
          assert.equal(term.buffer.lines.get(1).get(0)[CHAR_DATA_CHAR_INDEX], '');
          assert.equal(term.buffer.lines.get(INIT_ROWS - 2).get(0)[CHAR_DATA_CHAR_INDEX], 'c');
          assert.equal(term.buffer.lines.get(INIT_ROWS - 1).get(0)[CHAR_DATA_CHAR_INDEX], '');
        });

        it('should properly scroll inside a scroll region (scrollTop set)', () => {
          term.buffer.lines.get(0).set(0, [0, 'a', 0, 'a'.charCodeAt(0)]);
          term.buffer.lines.get(1).set(0, [0, 'b', 0, 'b'.charCodeAt(0)]);
          term.buffer.lines.get(2).set(0, [0, 'c', 0, 'c'.charCodeAt(0)]);
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          term.buffer.scrollTop = 1;
          term.scroll();
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          assert.equal(term.buffer.lines.get(0).get(0)[CHAR_DATA_CHAR_INDEX], 'a');
          assert.equal(term.buffer.lines.get(1).get(0)[CHAR_DATA_CHAR_INDEX], 'c');
        });

        it('should properly scroll inside a scroll region (scrollBottom set)', () => {
          term.buffer.lines.get(0).set(0, [0, 'a', 0, 'a'.charCodeAt(0)]);
          term.buffer.lines.get(1).set(0, [0, 'b', 0, 'b'.charCodeAt(0)]);
          term.buffer.lines.get(2).set(0, [0, 'c', 0, 'c'.charCodeAt(0)]);
          term.buffer.lines.get(3).set(0, [0, 'd', 0, 'd'.charCodeAt(0)]);
          term.buffer.lines.get(4).set(0, [0, 'e', 0, 'e'.charCodeAt(0)]);
          term.buffer.y = 3;
          term.buffer.scrollBottom = 3;
          term.scroll();
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          assert.equal(term.buffer.lines.get(0).get(0)[CHAR_DATA_CHAR_INDEX], 'b');
          assert.equal(term.buffer.lines.get(1).get(0)[CHAR_DATA_CHAR_INDEX], 'c');
          assert.equal(term.buffer.lines.get(2).get(0)[CHAR_DATA_CHAR_INDEX], 'd');
          assert.equal(term.buffer.lines.get(3).get(0)[CHAR_DATA_CHAR_INDEX], '', 'a blank line should be added at scrollBottom\'s index');
          assert.equal(term.buffer.lines.get(4).get(0)[CHAR_DATA_CHAR_INDEX], 'e');
        });

        it('should properly scroll inside a scroll region (scrollTop and scrollBottom set)', () => {
          term.buffer.lines.get(0).set(0, [0, 'a', 0, 'a'.charCodeAt(0)]);
          term.buffer.lines.get(1).set(0, [0, 'b', 0, 'b'.charCodeAt(0)]);
          term.buffer.lines.get(2).set(0, [0, 'c', 0, 'c'.charCodeAt(0)]);
          term.buffer.lines.get(3).set(0, [0, 'd', 0, 'd'.charCodeAt(0)]);
          term.buffer.lines.get(4).set(0, [0, 'e', 0, 'e'.charCodeAt(0)]);
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          term.buffer.scrollTop = 1;
          term.buffer.scrollBottom = 3;
          term.scroll();
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          assert.equal(term.buffer.lines.get(0).get(0)[CHAR_DATA_CHAR_INDEX], 'a');
          assert.equal(term.buffer.lines.get(1).get(0)[CHAR_DATA_CHAR_INDEX], 'c', '\'b\' should be removed from the buffer');
          assert.equal(term.buffer.lines.get(2).get(0)[CHAR_DATA_CHAR_INDEX], 'd');
          assert.equal(term.buffer.lines.get(3).get(0)[CHAR_DATA_CHAR_INDEX], '', 'a blank line should be added at scrollBottom\'s index');
          assert.equal(term.buffer.lines.get(4).get(0)[CHAR_DATA_CHAR_INDEX], 'e');
        });
      });
    });
  });

  describe('Third level shift', () => {
    let evKeyDown: any;
    let evKeyPress: any;

    beforeEach(() => {
      term.handler = () => { };
      term.showCursor = () => { };
      term.clearSelection = () => { };
      // term.compositionHelper = {
      //   isComposing: false,
      //   keydown: {
      //     bind: () => {
      //       return () => { return true; };
      //     }
      //   }
      // };
      evKeyDown = {
        preventDefault: () => { },
        stopPropagation: () => { },
        type: 'keydown',
        altKey: null,
        keyCode: null
      };
      evKeyPress = {
        preventDefault: () => { },
        stopPropagation: () => { },
        type: 'keypress',
        altKey: null,
        charCode: null,
        keyCode: null
      };
    });

    describe('with macOptionIsMeta', () => {
      beforeEach(() => {
        term.browser.isMac = true;
        term.setOption('macOptionIsMeta', true);
      });

      it('should interfere with the alt key on keyDown', () => {
        evKeyDown.altKey = true;
        evKeyDown.keyCode = 81;
        assert.equal(term.keyDown(evKeyDown), false);
        evKeyDown.altKey = true;
        evKeyDown.keyCode = 192;
        assert.equal(term.keyDown(evKeyDown), false);
      });
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
        const keys = ['@', '@', '\\', '\\', '|', '|'];

        term.on('keypress', (key) => {
          if (key) {
            const index = keys.indexOf(key);
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
        const keys = ['@', '@', '\\', '\\', '|', '|'];

        term.on('keypress', (key) => {
          if (key) {
            const index = keys.indexOf(key);
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
      const high = String.fromCharCode(0xD800);
      for (let i = 0xDC00; i <= 0xDCFF; ++i) {
        term.write(high + String.fromCharCode(i));
        const tchar = term.buffer.lines.get(0).get(0);
        expect(tchar[CHAR_DATA_CHAR_INDEX]).eql(high + String.fromCharCode(i));
        expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(2);
        expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(1);
        expect(term.buffer.lines.get(0).get(1)[CHAR_DATA_CHAR_INDEX]).eql('');
        term.reset();
      }
    });
    it('2 characters at last cell', () => {
      const high = String.fromCharCode(0xD800);
      for (let i = 0xDC00; i <= 0xDCFF; ++i) {
        term.buffer.x = term.cols - 1;
        term.write(high + String.fromCharCode(i));
        expect(term.buffer.lines.get(0).get(term.buffer.x - 1)[CHAR_DATA_CHAR_INDEX]).eql(high + String.fromCharCode(i));
        expect(term.buffer.lines.get(0).get(term.buffer.x - 1)[CHAR_DATA_CHAR_INDEX].length).eql(2);
        expect(term.buffer.lines.get(1).get(0)[CHAR_DATA_CHAR_INDEX]).eql('');
        term.reset();
      }
    });
    it('2 characters per cell over line end with autowrap', () => {
      const high = String.fromCharCode(0xD800);
      for (let i = 0xDC00; i <= 0xDCFF; ++i) {
        term.buffer.x = term.cols - 1;
        term.wraparoundMode = true;
        term.write('a' + high + String.fromCharCode(i));
        expect(term.buffer.lines.get(0).get(term.cols - 1)[CHAR_DATA_CHAR_INDEX]).eql('a');
        expect(term.buffer.lines.get(1).get(0)[CHAR_DATA_CHAR_INDEX]).eql(high + String.fromCharCode(i));
        expect(term.buffer.lines.get(1).get(0)[CHAR_DATA_CHAR_INDEX].length).eql(2);
        expect(term.buffer.lines.get(1).get(1)[CHAR_DATA_CHAR_INDEX]).eql('');
        term.reset();
      }
    });
    it('2 characters per cell over line end without autowrap', () => {
      const high = String.fromCharCode(0xD800);
      for (let i = 0xDC00; i <= 0xDCFF; ++i) {
        term.buffer.x = term.cols - 1;
        term.wraparoundMode = false;
        term.write('a' + high + String.fromCharCode(i));
        // auto wraparound mode should cut off the rest of the line
        expect(term.buffer.lines.get(0).get(term.cols - 1)[CHAR_DATA_CHAR_INDEX]).eql('a');
        expect(term.buffer.lines.get(0).get(term.cols - 1)[CHAR_DATA_CHAR_INDEX].length).eql(1);
        expect(term.buffer.lines.get(1).get(1)[CHAR_DATA_CHAR_INDEX]).eql('');
        term.reset();
      }
    });
    it('splitted surrogates', () => {
      const high = String.fromCharCode(0xD800);
      for (let i = 0xDC00; i <= 0xDCFF; ++i) {
        term.write(high);
        term.write(String.fromCharCode(i));
        const tchar = term.buffer.lines.get(0).get(0);
        expect(tchar[CHAR_DATA_CHAR_INDEX]).eql(high + String.fromCharCode(i));
        expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(2);
        expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(1);
        expect(term.buffer.lines.get(0).get(1)[CHAR_DATA_CHAR_INDEX]).eql('');
        term.reset();
      }
    });
  });

  describe('unicode - combining characters', () => {
    it('café', () => {
      term.write('cafe\u0301');
      expect(term.buffer.lines.get(0).get(3)[CHAR_DATA_CHAR_INDEX]).eql('e\u0301');
      expect(term.buffer.lines.get(0).get(3)[CHAR_DATA_CHAR_INDEX].length).eql(2);
      expect(term.buffer.lines.get(0).get(3)[CHAR_DATA_WIDTH_INDEX]).eql(1);
    });
    it('café - end of line', () => {
      term.buffer.x = term.cols - 1 - 3;
      term.write('cafe\u0301');
      expect(term.buffer.lines.get(0).get(term.cols - 1)[CHAR_DATA_CHAR_INDEX]).eql('e\u0301');
      expect(term.buffer.lines.get(0).get(term.cols - 1)[CHAR_DATA_CHAR_INDEX].length).eql(2);
      expect(term.buffer.lines.get(0).get(term.cols - 1)[CHAR_DATA_WIDTH_INDEX]).eql(1);
      expect(term.buffer.lines.get(0).get(1)[CHAR_DATA_CHAR_INDEX]).eql('');
      expect(term.buffer.lines.get(0).get(1)[CHAR_DATA_CHAR_INDEX].length).eql(0);
      expect(term.buffer.lines.get(0).get(1)[CHAR_DATA_WIDTH_INDEX]).eql(1);
    });
    it('multiple combined é', () => {
      term.wraparoundMode = true;
      term.write(Array(100).join('e\u0301'));
      for (let i = 0; i < term.cols; ++i) {
        const tchar = term.buffer.lines.get(0).get(i);
        expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('e\u0301');
        expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(2);
        expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(1);
      }
      const tchar = term.buffer.lines.get(1).get(0);
      expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('e\u0301');
      expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(2);
      expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(1);
    });
    it('multiple surrogate with combined', () => {
      term.wraparoundMode = true;
      term.write(Array(100).join('\uD800\uDC00\u0301'));
      for (let i = 0; i < term.cols; ++i) {
        const tchar = term.buffer.lines.get(0).get(i);
        expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('\uD800\uDC00\u0301');
        expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(3);
        expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(1);
      }
      const tchar = term.buffer.lines.get(1).get(0);
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
        const tchar = term.buffer.lines.get(0).get(i);
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
      const tchar = term.buffer.lines.get(1).get(0);
      expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('￥');
      expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(1);
      expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(2);
    });
    it('line of ￥ odd', () => {
      term.wraparoundMode = true;
      term.buffer.x = 1;
      term.write(Array(50).join('￥'));
      for (let i = 1; i < term.cols - 1; ++i) {
        const tchar = term.buffer.lines.get(0).get(i);
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
      let tchar = term.buffer.lines.get(0).get(term.cols - 1);
      expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('');
      expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(0);
      expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(1);
      tchar = term.buffer.lines.get(1).get(0);
      expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('￥');
      expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(1);
      expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(2);
    });
    it('line of ￥ with combining odd', () => {
      term.wraparoundMode = true;
      term.buffer.x = 1;
      term.write(Array(50).join('￥\u0301'));
      for (let i = 1; i < term.cols - 1; ++i) {
        const tchar = term.buffer.lines.get(0).get(i);
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
      let tchar = term.buffer.lines.get(0).get(term.cols - 1);
      expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('');
      expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(0);
      expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(1);
      tchar = term.buffer.lines.get(1).get(0);
      expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('￥\u0301');
      expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(2);
      expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(2);
    });
    it('line of ￥ with combining even', () => {
      term.wraparoundMode = true;
      term.write(Array(50).join('￥\u0301'));
      for (let i = 0; i < term.cols; ++i) {
        const tchar = term.buffer.lines.get(0).get(i);
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
      const tchar = term.buffer.lines.get(1).get(0);
      expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('￥\u0301');
      expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(2);
      expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(2);
    });
    it('line of surrogate fullwidth with combining odd', () => {
      term.wraparoundMode = true;
      term.buffer.x = 1;
      term.write(Array(50).join('\ud843\ude6d\u0301'));
      for (let i = 1; i < term.cols - 1; ++i) {
        const tchar = term.buffer.lines.get(0).get(i);
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
      let tchar = term.buffer.lines.get(0).get(term.cols - 1);
      expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('');
      expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(0);
      expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(1);
      tchar = term.buffer.lines.get(1).get(0);
      expect(tchar[CHAR_DATA_CHAR_INDEX]).eql('\ud843\ude6d\u0301');
      expect(tchar[CHAR_DATA_CHAR_INDEX].length).eql(3);
      expect(tchar[CHAR_DATA_WIDTH_INDEX]).eql(2);
    });
    it('line of surrogate fullwidth with combining even', () => {
      term.wraparoundMode = true;
      term.write(Array(50).join('\ud843\ude6d\u0301'));
      for (let i = 0; i < term.cols; ++i) {
        const tchar = term.buffer.lines.get(0).get(i);
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
      const tchar = term.buffer.lines.get(1).get(0);
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
      expect(term.buffer.lines.get(0).get(10)[CHAR_DATA_CHAR_INDEX]).eql('a');
      expect(term.buffer.lines.get(0).get(14)[CHAR_DATA_CHAR_INDEX]).eql('e');
      expect(term.buffer.lines.get(0).get(15)[CHAR_DATA_CHAR_INDEX]).eql('0');
      expect(term.buffer.lines.get(0).get(79)[CHAR_DATA_CHAR_INDEX]).eql('4');
    });
    it('fullwidth - insert', () => {
      term.write(Array(9).join('0123456789').slice(-80));
      term.buffer.x = 10;
      term.buffer.y = 0;
      term.insertMode = true;
      term.write('￥￥￥');
      expect(term.buffer.lines.get(0).length).eql(term.cols);
      expect(term.buffer.lines.get(0).get(10)[CHAR_DATA_CHAR_INDEX]).eql('￥');
      expect(term.buffer.lines.get(0).get(11)[CHAR_DATA_CHAR_INDEX]).eql('');
      expect(term.buffer.lines.get(0).get(14)[CHAR_DATA_CHAR_INDEX]).eql('￥');
      expect(term.buffer.lines.get(0).get(15)[CHAR_DATA_CHAR_INDEX]).eql('');
      expect(term.buffer.lines.get(0).get(79)[CHAR_DATA_CHAR_INDEX]).eql('3');
    });
    it('fullwidth - right border', () => {
      term.write(Array(41).join('￥'));
      term.buffer.x = 10;
      term.buffer.y = 0;
      term.insertMode = true;
      term.write('a');
      expect(term.buffer.lines.get(0).length).eql(term.cols);
      expect(term.buffer.lines.get(0).get(10)[CHAR_DATA_CHAR_INDEX]).eql('a');
      expect(term.buffer.lines.get(0).get(11)[CHAR_DATA_CHAR_INDEX]).eql('￥');
      expect(term.buffer.lines.get(0).get(79)[CHAR_DATA_CHAR_INDEX]).eql('');  // fullwidth char got replaced
      term.write('b');
      expect(term.buffer.lines.get(0).length).eql(term.cols);
      expect(term.buffer.lines.get(0).get(11)[CHAR_DATA_CHAR_INDEX]).eql('b');
      expect(term.buffer.lines.get(0).get(12)[CHAR_DATA_CHAR_INDEX]).eql('￥');
      expect(term.buffer.lines.get(0).get(79)[CHAR_DATA_CHAR_INDEX]).eql('');  // empty cell after fullwidth
    });
  });
});
