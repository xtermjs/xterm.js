/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { MockViewport, MockCompositionHelper, MockRenderer, TestTerminal } from 'browser/TestUtils.test';
import { DEFAULT_ATTR_DATA } from 'common/buffer/BufferLine';
import { CellData } from 'common/buffer/CellData';
import { MockUnicodeService } from 'common/TestUtils.test';
import { IMarker, ScrollSource } from 'common/Types';
import { ICoreService } from 'common/services/Services';

const INIT_COLS = 80;
const INIT_ROWS = 24;

// grab wcwidth from mock unicode service (hardcoded to V6)
const wcwidth = (new MockUnicodeService()).wcwidth;

describe('Terminal', () => {
  let term: TestTerminal;
  const termOptions = {
    cols: INIT_COLS,
    rows: INIT_ROWS
  };

  beforeEach(() => {
    term = new TestTerminal(termOptions);
    term.refresh = () => { };
    (term as any).renderer = new MockRenderer();
    term.viewport = new MockViewport();
    term.viewport.onRequestScrollLines(e => term.scrollLines(e.amount, e.suppressScrollEvent, ScrollSource.VIEWPORT));
    (term as any)._compositionHelper = new MockCompositionHelper();
    (term as any).element = {
      classList: {
        toggle: () => { },
        remove: () => { }
      }
    };
  });

  it('should not mutate the options parameter', () => {
    term.options.cols = 1000;

    assert.deepEqual(termOptions, {
      cols: INIT_COLS,
      rows: INIT_ROWS
    });
  });

  describe('events', () => {
    it('should fire the onData evnet', (done) => {
      term.onData(() => done());
      term.coreService.triggerDataEvent('fake');
    });
    it('should fire the onCursorMove event', () => {
      return new Promise<void>(async r => {
        term.onCursorMove(() => r());
        await term.writeP('foo');
      });
    });
    it('should fire the onLineFeed event', () => {
      return new Promise<void>(async r => {
        term.onLineFeed(() => r());
        await term.writeP('\n');
      });
    });
    it('should fire a scroll event when scrollback is created', () => {
      return new Promise<void>(async r => {
        term.onScroll(() => r());
        await term.writeP('\n'.repeat(INIT_ROWS));
      });
    });
    it('should fire a scroll event when scrollback is cleared', () => {
      return new Promise<void>(async r => {
        await term.writeP('\n'.repeat(INIT_ROWS));
        term.onScroll(() => r());
        term.clear();
      });
    });
    it('should fire a key event after a keypress DOM event', (done) => {
      term.onKey(e => {
        assert.equal(typeof e.key, 'string');
        assert.equal(e.domEvent instanceof Object, true);
        done();
      });
      const evKeyPress = {
        preventDefault: () => { },
        stopPropagation: () => { },
        type: 'keypress',
        keyCode: 13
      } as KeyboardEvent;
      term.keyPress(evKeyPress);
    });
    it('should fire a key event after a keydown DOM event', (done) => {
      term.onKey(e => {
        assert.equal(typeof e.key, 'string');
        assert.equal(e.domEvent instanceof Object, true);
        done();
      });
      (term as any).textarea = { value: '' };
      const evKeyDown = {
        preventDefault: () => { },
        stopPropagation: () => { },
        type: 'keydown',
        keyCode: 13
      } as KeyboardEvent;
      term.keyDown(evKeyDown);
    });
    it('should fire the onResize event', (done) => {
      term.onResize(e => {
        assert.equal(typeof e.cols, 'number');
        assert.equal(typeof e.rows, 'number');
        done();
      });
      term.resize(1, 1);
    });
    it('should fire the onScroll event', (done) => {
      term.onScroll(e => {
        assert.equal(typeof e, 'number');
        done();
      });
      term.scroll(DEFAULT_ATTR_DATA.clone());
    });
    it('should fire the onTitleChange event', (done) => {
      term.onTitleChange(e => {
        assert.equal(e, 'title');
        done();
      });
      term.write('\x1b]2;title\x07');
    });
    it('should fire the onBell event', (done) => {
      term.onBell(e => {
        done();
      });
      term.write('\x07');
    });
  });

  describe('attachCustomKeyEventHandler', () => {
    const evKeyDown = {
      preventDefault: () => { },
      stopPropagation: () => { },
      type: 'keydown',
      keyCode: 77
    } as KeyboardEvent;
    const evKeyPress = {
      preventDefault: () => { },
      stopPropagation: () => { },
      type: 'keypress',
      keyCode: 77
    } as KeyboardEvent;

    beforeEach(() => {
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
        assert.deepEqual(term.buffer.lines.get(i), term.buffer.getBlankLine(DEFAULT_ATTR_DATA));
      }
    });
    it('should clear a buffer larger than rows', async () => {
      // Fill the buffer with dummy rows
      for (let i = 0; i < term.rows * 2; i++) {
        await term.writeP('test\n');
      }

      const promptLine = term.buffer.lines.get(term.buffer.ybase + term.buffer.y);
      term.clear();
      assert.equal(term.buffer.y, 0);
      assert.equal(term.buffer.ybase, 0);
      assert.equal(term.buffer.ydisp, 0);
      assert.equal(term.buffer.lines.length, term.rows);
      assert.deepEqual(term.buffer.lines.get(0), promptLine);
      for (let i = 1; i < term.rows; i++) {
        assert.deepEqual(term.buffer.lines.get(i), term.buffer.getBlankLine(DEFAULT_ATTR_DATA));
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
        assert.deepEqual(term.buffer.lines.get(i), term.buffer.getBlankLine(DEFAULT_ATTR_DATA));
      }
    });
  });

  describe('paste', () => {
    it('should fire data event', done => {
      term.onData(e => {
        assert.equal(e, 'foo');
        done();
      });
      term.paste('foo');
    });
    it('should sanitize \\n chars', done => {
      term.onData(e => {
        assert.equal(e, '\rfoo\rbar\r');
        done();
      });
      term.paste('\r\nfoo\nbar\r');
    });
    it('should respect bracketed paste mode', () => {
      return new Promise<void>(async r => {
        term.onData(e => {
          assert.equal(e, '\x1b[200~foo\x1b[201~');
          r();
        });
        await term.writeP('\x1b[?2004h');
        term.paste('foo');
      });
    });
  });

  describe('scroll', () => {
    describe('scrollLines', () => {
      let startYDisp: number;
      beforeEach(async () => {
        for (let i = 0; i < INIT_ROWS * 2; i++) {
          await term.writeP('test\r\n');
        }
        startYDisp = INIT_ROWS + 1;
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
      beforeEach(async () => {
        for (let i = 0; i < term.rows * 3; i++) {
          await term.writeP('test\r\n');
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
      beforeEach(async () => {
        for (let i = 0; i < term.rows * 3; i++) {
          await term.writeP('test\r\n');
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
      beforeEach(async () => {
        for (let i = 0; i < term.rows * 3; i++) {
          await term.writeP('test\r\n');
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
      beforeEach(async () => {
        for (let i = 0; i < term.rows * 3; i++) {
          await term.writeP('test\r\n');
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
        const event = {
          type: 'keydown',
          key: 'a',
          keyCode: 65,
          preventDefault: () => { },
          stopPropagation: () => { }
        } as KeyboardEvent;

        term.buffer.ydisp = 0;
        term.buffer.ybase = 40;
        term.keyPress(event);

        // Ensure that now the terminal is scrolled to bottom
        assert.equal(term.buffer.ydisp, term.buffer.ybase);
      });

      it('should not scroll down, when a custom keydown handler prevents the event', async () => {
        // Add some output to the terminal
        for (let i = 0; i < term.rows * 3; i++) {
          await term.writeP('test\r\n');
        }
        const startYDisp = (term.rows * 2) + 1;
        term.attachCustomKeyEventHandler(() => {
          return false;
        });

        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollLines(-1);
        assert.equal(term.buffer.ydisp, startYDisp - 1);
        term.keyPress({ keyCode: 0 });
        assert.equal(term.buffer.ydisp, startYDisp - 1);
      });
    });

    describe('scroll() function', () => {
      describe('when scrollback > 0', () => {
        it('should create a new line and scroll', () => {
          term.buffer.lines.get(0)!.setCell(0, CellData.fromCharData([0, 'a', 0, 'a'.charCodeAt(0)]));
          term.buffer.lines.get(INIT_ROWS - 1)!.setCell(0, CellData.fromCharData([0, 'b', 0, 'b'.charCodeAt(0)]));
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          term.scroll(DEFAULT_ATTR_DATA.clone());
          assert.equal(term.buffer.lines.length, INIT_ROWS + 1);
          assert.equal(term.buffer.lines.get(0)!.loadCell(0, new CellData()).getChars(), 'a');
          assert.equal(term.buffer.lines.get(INIT_ROWS - 1)!.loadCell(0, new CellData()).getChars(), 'b');
          assert.equal(term.buffer.lines.get(INIT_ROWS)!.loadCell(0, new CellData()).getChars(), '');
        });

        it('should properly scroll inside a scroll region (scrollTop set)', () => {
          term.buffer.lines.get(0)!.setCell(0, CellData.fromCharData([0, 'a', 0, 'a'.charCodeAt(0)]));
          term.buffer.lines.get(1)!.setCell(0, CellData.fromCharData([0, 'b', 0, 'b'.charCodeAt(0)]));
          term.buffer.lines.get(2)!.setCell(0, CellData.fromCharData([0, 'c', 0, 'c'.charCodeAt(0)]));
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          term.buffer.scrollTop = 1;
          term.scroll(DEFAULT_ATTR_DATA.clone());
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          assert.equal(term.buffer.lines.get(0)!.loadCell(0, new CellData()).getChars(), 'a');
          assert.equal(term.buffer.lines.get(1)!.loadCell(0, new CellData()).getChars(), 'c');
        });

        it('should properly scroll inside a scroll region (scrollBottom set)', () => {
          term.buffer.lines.get(0)!.setCell(0, CellData.fromCharData([0, 'a', 0, 'a'.charCodeAt(0)]));
          term.buffer.lines.get(1)!.setCell(0, CellData.fromCharData([0, 'b', 0, 'b'.charCodeAt(0)]));
          term.buffer.lines.get(2)!.setCell(0, CellData.fromCharData([0, 'c', 0, 'c'.charCodeAt(0)]));
          term.buffer.lines.get(3)!.setCell(0, CellData.fromCharData([0, 'd', 0, 'd'.charCodeAt(0)]));
          term.buffer.lines.get(4)!.setCell(0, CellData.fromCharData([0, 'e', 0, 'e'.charCodeAt(0)]));
          term.buffer.y = 3;
          term.buffer.scrollBottom = 3;
          term.scroll(DEFAULT_ATTR_DATA.clone());
          assert.equal(term.buffer.lines.length, INIT_ROWS + 1);
          assert.equal(term.buffer.lines.get(0)!.loadCell(0, new CellData()).getChars(), 'a', '\'a\' should be pushed to the scrollback');
          assert.equal(term.buffer.lines.get(1)!.loadCell(0, new CellData()).getChars(), 'b');
          assert.equal(term.buffer.lines.get(2)!.loadCell(0, new CellData()).getChars(), 'c');
          assert.equal(term.buffer.lines.get(3)!.loadCell(0, new CellData()).getChars(), 'd');
          assert.equal(term.buffer.lines.get(4)!.loadCell(0, new CellData()).getChars(), '', 'a blank line should be added at scrollBottom\'s index');
          assert.equal(term.buffer.lines.get(5)!.loadCell(0, new CellData()).getChars(), 'e');
        });

        it('should properly scroll inside a scroll region (scrollTop and scrollBottom set)', () => {
          term.buffer.lines.get(0)!.setCell(0, CellData.fromCharData([0, 'a', 0, 'a'.charCodeAt(0)]));
          term.buffer.lines.get(1)!.setCell(0, CellData.fromCharData([0, 'b', 0, 'b'.charCodeAt(0)]));
          term.buffer.lines.get(2)!.setCell(0, CellData.fromCharData([0, 'c', 0, 'c'.charCodeAt(0)]));
          term.buffer.lines.get(3)!.setCell(0, CellData.fromCharData([0, 'd', 0, 'd'.charCodeAt(0)]));
          term.buffer.lines.get(4)!.setCell(0, CellData.fromCharData([0, 'e', 0, 'e'.charCodeAt(0)]));
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          term.buffer.scrollTop = 1;
          term.buffer.scrollBottom = 3;
          term.scroll(DEFAULT_ATTR_DATA.clone());
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          assert.equal(term.buffer.lines.get(0)!.loadCell(0, new CellData()).getChars(), 'a');
          assert.equal(term.buffer.lines.get(1)!.loadCell(0, new CellData()).getChars(), 'c', '\'b\' should be removed from the buffer');
          assert.equal(term.buffer.lines.get(2)!.loadCell(0, new CellData()).getChars(), 'd');
          assert.equal(term.buffer.lines.get(3)!.loadCell(0, new CellData()).getChars(), '', 'a blank line should be added at scrollBottom\'s index');
          assert.equal(term.buffer.lines.get(4)!.loadCell(0, new CellData()).getChars(), 'e');
        });
      });

      describe('when scrollback === 0', () => {
        beforeEach(() => {
          term.optionsService.options.scrollback = 0;
          assert.equal(term.buffer.lines.maxLength, INIT_ROWS);
        });

        it('should create a new line and shift everything up', () => {
          term.buffer.lines.get(0)!.setCell(0, CellData.fromCharData([0, 'a', 0, 'a'.charCodeAt(0)]));
          term.buffer.lines.get(1)!.setCell(0, CellData.fromCharData([0, 'b', 0, 'b'.charCodeAt(0)]));
          term.buffer.lines.get(INIT_ROWS - 1)!.setCell(0, CellData.fromCharData([0, 'c', 0, 'c'.charCodeAt(0)]));
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          term.scroll(DEFAULT_ATTR_DATA.clone());
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          // 'a' gets pushed out of buffer
          assert.equal(term.buffer.lines.get(0)!.loadCell(0, new CellData()).getChars(), 'b');
          assert.equal(term.buffer.lines.get(1)!.loadCell(0, new CellData()).getChars(), '');
          assert.equal(term.buffer.lines.get(INIT_ROWS - 2)!.loadCell(0, new CellData()).getChars(), 'c');
          assert.equal(term.buffer.lines.get(INIT_ROWS - 1)!.loadCell(0, new CellData()).getChars(), '');
        });

        it('should properly scroll inside a scroll region (scrollTop set)', () => {
          term.buffer.lines.get(0)!.setCell(0, CellData.fromCharData([0, 'a', 0, 'a'.charCodeAt(0)]));
          term.buffer.lines.get(1)!.setCell(0, CellData.fromCharData([0, 'b', 0, 'b'.charCodeAt(0)]));
          term.buffer.lines.get(2)!.setCell(0, CellData.fromCharData([0, 'c', 0, 'c'.charCodeAt(0)]));
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          term.buffer.scrollTop = 1;
          term.scroll(DEFAULT_ATTR_DATA.clone());
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          assert.equal(term.buffer.lines.get(0)!.loadCell(0, new CellData()).getChars(), 'a');
          assert.equal(term.buffer.lines.get(1)!.loadCell(0, new CellData()).getChars(), 'c');
        });

        it('should properly scroll inside a scroll region (scrollBottom set)', () => {
          term.buffer.lines.get(0)!.setCell(0, CellData.fromCharData([0, 'a', 0, 'a'.charCodeAt(0)]));
          term.buffer.lines.get(1)!.setCell(0, CellData.fromCharData([0, 'b', 0, 'b'.charCodeAt(0)]));
          term.buffer.lines.get(2)!.setCell(0, CellData.fromCharData([0, 'c', 0, 'c'.charCodeAt(0)]));
          term.buffer.lines.get(3)!.setCell(0, CellData.fromCharData([0, 'd', 0, 'd'.charCodeAt(0)]));
          term.buffer.lines.get(4)!.setCell(0, CellData.fromCharData([0, 'e', 0, 'e'.charCodeAt(0)]));
          term.buffer.y = 3;
          term.buffer.scrollBottom = 3;
          term.scroll(DEFAULT_ATTR_DATA.clone());
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          assert.equal(term.buffer.lines.get(0)!.loadCell(0, new CellData()).getChars(), 'b');
          assert.equal(term.buffer.lines.get(1)!.loadCell(0, new CellData()).getChars(), 'c');
          assert.equal(term.buffer.lines.get(2)!.loadCell(0, new CellData()).getChars(), 'd');
          assert.equal(term.buffer.lines.get(3)!.loadCell(0, new CellData()).getChars(), '', 'a blank line should be added at scrollBottom\'s index');
          assert.equal(term.buffer.lines.get(4)!.loadCell(0, new CellData()).getChars(), 'e');
        });

        it('should properly scroll inside a scroll region (scrollTop and scrollBottom set)', () => {
          term.buffer.lines.get(0)!.setCell(0, CellData.fromCharData([0, 'a', 0, 'a'.charCodeAt(0)]));
          term.buffer.lines.get(1)!.setCell(0, CellData.fromCharData([0, 'b', 0, 'b'.charCodeAt(0)]));
          term.buffer.lines.get(2)!.setCell(0, CellData.fromCharData([0, 'c', 0, 'c'.charCodeAt(0)]));
          term.buffer.lines.get(3)!.setCell(0, CellData.fromCharData([0, 'd', 0, 'd'.charCodeAt(0)]));
          term.buffer.lines.get(4)!.setCell(0, CellData.fromCharData([0, 'e', 0, 'e'.charCodeAt(0)]));
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          term.buffer.scrollTop = 1;
          term.buffer.scrollBottom = 3;
          term.scroll(DEFAULT_ATTR_DATA.clone());
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          assert.equal(term.buffer.lines.get(0)!.loadCell(0, new CellData()).getChars(), 'a');
          assert.equal(term.buffer.lines.get(1)!.loadCell(0, new CellData()).getChars(), 'c', '\'b\' should be removed from the buffer');
          assert.equal(term.buffer.lines.get(2)!.loadCell(0, new CellData()).getChars(), 'd');
          assert.equal(term.buffer.lines.get(3)!.loadCell(0, new CellData()).getChars(), '', 'a blank line should be added at scrollBottom\'s index');
          assert.equal(term.buffer.lines.get(4)!.loadCell(0, new CellData()).getChars(), 'e');
        });
      });
    });
  });

  describe('Third level shift', () => {
    let evKeyDown: any;
    let evKeyPress: any;

    beforeEach(() => {
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
      let originalIsMac: boolean;
      beforeEach(() => {
        originalIsMac = term.browser.isMac;
        term.options.macOptionIsMeta = true;
      });
      afterEach(() => term.browser.isMac = originalIsMac);

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
      let originalIsMac: boolean;
      beforeEach(() => {
        originalIsMac = term.browser.isMac;
        term.browser.isMac = true;
      });
      afterEach(() => term.browser.isMac = originalIsMac);

      it('should not interfere with the alt key on keyDown', () => {
        evKeyDown.altKey = true;
        evKeyDown.keyCode = 81;
        assert.equal(term.keyDown(evKeyDown), true);
        evKeyDown.altKey = true;
        evKeyDown.keyCode = 192;
        term.keyDown(evKeyDown);
        assert.equal(term.keyDown(evKeyDown), true);
      });

      it('should interfere with the alt + arrow keys', () => {
        evKeyDown.altKey = true;
        evKeyDown.keyCode = 37;
        assert.equal(term.keyDown(evKeyDown), false);
        evKeyDown.altKey = true;
        evKeyDown.keyCode = 39;
        assert.equal(term.keyDown(evKeyDown), false);
      });

      it('should emit key with alt + key on keyPress', (done) => {
        const keys = ['@', '@', '\\', '\\', '|', '|'];

        term.onKey(e => {
          if (e.key) {
            const index = keys.indexOf(e.key);
            assert(index !== -1, 'Emitted wrong key: ' + e.key);
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
      let originalIsWindows: boolean;
      beforeEach(() => {
        originalIsWindows = term.browser.isWindows;
        term.browser.isWindows = true;
      });
      afterEach(() => term.browser.isWindows = originalIsWindows);

      it('should not interfere with the alt + ctrl key on keyDown', () => {
        evKeyPress.altKey = true;
        evKeyPress.ctrlKey = true;
        evKeyPress.keyCode = 81;
        assert.equal(term.keyDown(evKeyPress), true);
        evKeyDown.altKey = true;
        evKeyDown.ctrlKey = true;
        evKeyDown.keyCode = 81;
        term.keyDown(evKeyDown);
        assert.equal(term.keyDown(evKeyPress), true);
      });

      it('should interfere with the alt + ctrl + arrow keys', () => {
        evKeyDown.altKey = true;
        evKeyDown.ctrlKey = true;

        evKeyDown.keyCode = 37;
        assert.equal(term.keyDown(evKeyDown), false);
        evKeyDown.keyCode = 39;
        term.keyDown(evKeyDown);
        assert.equal(term.keyDown(evKeyDown), false);
      });

      it('should emit key with alt + ctrl + key on keyPress', (done) => {
        const keys = ['@', '@', '\\', '\\', '|', '|'];

        term.onKey(e => {
          if (e.key) {
            const index = keys.indexOf(e.key);
            assert(index !== -1, 'Emitted wrong key: ' + e.key);
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
    for (let i = 0xDC00; i <= 0xDCF0; i += 0x10) {
      const range = `0x${i.toString(16).toUpperCase()}-0x${(i + 0xF).toString(16).toUpperCase()}`;
      it(`${range}: 2 characters per cell`, async function (): Promise<void> {
        const high = String.fromCharCode(0xD800);
        const cell = new CellData();
        for (let j = i; j <= i + 0xF; j++) {
          await term.writeP(high + String.fromCharCode(j));
          const tchar = term.buffer.lines.get(0)!.loadCell(0, cell);
          assert.equal(tchar.getChars(), high + String.fromCharCode(j));
          assert.equal(tchar.getChars().length, 2);
          assert.equal(tchar.getWidth(), 1);
          assert.equal(term.buffer.lines.get(0)!.loadCell(1, cell).getChars(), '');
          term.reset();
        }
      });
      it(`${range}: 2 characters at last cell`, async () => {
        const high = String.fromCharCode(0xD800);
        const cell = new CellData();
        term.buffer.x = term.cols - 1;
        for (let j = i; j <= i + 0xF; j++) {
          await term.writeP(high + String.fromCharCode(j));
          assert.equal(term.buffer.lines.get(0)!.loadCell(term.buffer.x - 1, cell).getChars(), high + String.fromCharCode(j));
          assert.equal(term.buffer.lines.get(0)!.loadCell(term.buffer.x - 1, cell).getChars().length, 2);
          assert.equal(term.buffer.lines.get(1)!.loadCell(0, cell).getChars(), '');
          term.reset();
        }
      });
      it(`${range}: 2 characters per cell over line end with autowrap`, async function (): Promise<void> {
        const high = String.fromCharCode(0xD800);
        const cell = new CellData();
        for (let j = i; j <= i + 0xF; j++) {
          term.buffer.x = term.cols - 1;
          await term.writeP('a' + high + String.fromCharCode(j));
          assert.equal(term.buffer.lines.get(0)!.loadCell(term.cols - 1, cell).getChars(), 'a');
          assert.equal(term.buffer.lines.get(1)!.loadCell(0, cell).getChars(), high + String.fromCharCode(j));
          assert.equal(term.buffer.lines.get(1)!.loadCell(0, cell).getChars().length, 2);
          assert.equal(term.buffer.lines.get(1)!.loadCell(1, cell).getChars(), '');
          term.reset();
        }
      });
      it(`${range}: 2 characters per cell over line end without autowrap`, async function (): Promise<void> {
        const high = String.fromCharCode(0xD800);
        const cell = new CellData();
        for (let j = i; j <= i + 0xF; j++) {
          term.buffer.x = term.cols - 1;
          await term.writeP('\x1b[?7l'); // Disable wraparound mode
          const width = wcwidth((0xD800 - 0xD800) * 0x400 + j - 0xDC00 + 0x10000);
          if (width !== 1) {
            continue;
          }
          await term.writeP('a' + high + String.fromCharCode(j));
          // auto wraparound mode should cut off the rest of the line
          assert.equal(term.buffer.lines.get(0)!.loadCell(term.cols - 1, cell).getChars(), high + String.fromCharCode(j));
          assert.equal(term.buffer.lines.get(0)!.loadCell(term.cols - 1, cell).getChars().length, 2);
          assert.equal(term.buffer.lines.get(1)!.loadCell(1, cell).getChars(), '');
          term.reset();
        }
      });
      it(`${range}: splitted surrogates`, async function (): Promise<void> {
        const high = String.fromCharCode(0xD800);
        const cell = new CellData();
        for (let j = i; j <= i + 0xF; j++) {
          await term.writeP(high + String.fromCharCode(j));
          const tchar = term.buffer.lines.get(0)!.loadCell(0, cell);
          assert.equal(tchar.getChars(), high + String.fromCharCode(j));
          assert.equal(tchar.getChars().length, 2);
          assert.equal(tchar.getWidth(), 1);
          assert.equal(term.buffer.lines.get(0)!.loadCell(1, cell).getChars(), '');
          term.reset();
        }
      });
    }
  });

  describe('unicode - combining characters', () => {
    const cell = new CellData();
    it('café', async () => {
      await term.writeP('cafe\u0301');
      term.buffer.lines.get(0)!.loadCell(3, cell);
      assert.equal(cell.getChars(), 'e\u0301');
      assert.equal(cell.getChars().length, 2);
      assert.equal(cell.getWidth(), 1);
    });
    it('café - end of line', async () => {
      term.buffer.x = term.cols - 1 - 3;
      await term.writeP('cafe\u0301');
      term.buffer.lines.get(0)!.loadCell(term.cols - 1, cell);
      assert.equal(cell.getChars(), 'e\u0301');
      assert.equal(cell.getChars().length, 2);
      assert.equal(cell.getWidth(), 1);
      term.buffer.lines.get(0)!.loadCell(1, cell);
      assert.equal(cell.getChars(), '');
      assert.equal(cell.getChars().length, 0);
      assert.equal(cell.getWidth(), 1);
    });
    it('multiple combined é', async () => {
      await term.writeP(Array(100).join('e\u0301'));
      for (let i = 0; i < term.cols; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        assert.equal(cell.getChars(), 'e\u0301');
        assert.equal(cell.getChars().length, 2);
        assert.equal(cell.getWidth(), 1);
      }
      term.buffer.lines.get(1)!.loadCell(0, cell);
      assert.equal(cell.getChars(), 'e\u0301');
      assert.equal(cell.getChars().length, 2);
      assert.equal(cell.getWidth(), 1);
    });
    it('multiple surrogate with combined', async () => {
      await term.writeP(Array(100).join('\uD800\uDC00\u0301'));
      for (let i = 0; i < term.cols; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        assert.equal(cell.getChars(), '\uD800\uDC00\u0301');
        assert.equal(cell.getChars().length, 3);
        assert.equal(cell.getWidth(), 1);
      }
      term.buffer.lines.get(1)!.loadCell(0, cell);
      assert.equal(cell.getChars(), '\uD800\uDC00\u0301');
      assert.equal(cell.getChars().length, 3);
      assert.equal(cell.getWidth(), 1);
    });
  });

  describe('unicode - fullwidth characters', () => {
    const cell = new CellData();
    it('cursor movement even', async () => {
      assert.equal(term.buffer.x, 0);
      await term.writeP('￥');
      assert.equal(term.buffer.x, 2);
    });
    it('cursor movement odd', async () => {
      term.buffer.x = 1;
      assert.equal(term.buffer.x, 1);
      await term.writeP('￥');
      assert.equal(term.buffer.x, 3);
    });
    it('line of ￥ even', async () => {
      await term.writeP(Array(50).join('￥'));
      for (let i = 0; i < term.cols; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        if (i % 2) {
          assert.equal(cell.getChars(), '');
          assert.equal(cell.getChars().length, 0);
          assert.equal(cell.getWidth(), 0);
        } else {
          assert.equal(cell.getChars(), '￥');
          assert.equal(cell.getChars().length, 1);
          assert.equal(cell.getWidth(), 2);
        }
      }
      term.buffer.lines.get(1)!.loadCell(0, cell);
      assert.equal(cell.getChars(), '￥');
      assert.equal(cell.getChars().length, 1);
      assert.equal(cell.getWidth(), 2);
    });
    it('line of ￥ odd', async () => {
      term.buffer.x = 1;
      await term.writeP(Array(50).join('￥'));
      for (let i = 1; i < term.cols - 1; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        if (!(i % 2)) {
          assert.equal(cell.getChars(), '');
          assert.equal(cell.getChars().length, 0);
          assert.equal(cell.getWidth(), 0);
        } else {
          assert.equal(cell.getChars(), '￥');
          assert.equal(cell.getChars().length, 1);
          assert.equal(cell.getWidth(), 2);
        }
      }
      term.buffer.lines.get(0)!.loadCell(term.cols - 1, cell);
      assert.equal(cell.getChars(), '');
      assert.equal(cell.getChars().length, 0);
      assert.equal(cell.getWidth(), 1);
      term.buffer.lines.get(1)!.loadCell(0, cell);
      assert.equal(cell.getChars(), '￥');
      assert.equal(cell.getChars().length, 1);
      assert.equal(cell.getWidth(), 2);
    });
    it('line of ￥ with combining odd', async () => {
      term.buffer.x = 1;
      await term.writeP(Array(50).join('￥\u0301'));
      for (let i = 1; i < term.cols - 1; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        if (!(i % 2)) {
          assert.equal(cell.getChars(), '');
          assert.equal(cell.getChars().length, 0);
          assert.equal(cell.getWidth(), 0);
        } else {
          assert.equal(cell.getChars(), '￥\u0301');
          assert.equal(cell.getChars().length, 2);
          assert.equal(cell.getWidth(), 2);
        }
      }
      term.buffer.lines.get(0)!.loadCell(term.cols - 1, cell);
      assert.equal(cell.getChars(), '');
      assert.equal(cell.getChars().length, 0);
      assert.equal(cell.getWidth(), 1);
      term.buffer.lines.get(1)!.loadCell(0, cell);
      assert.equal(cell.getChars(), '￥\u0301');
      assert.equal(cell.getChars().length, 2);
      assert.equal(cell.getWidth(), 2);
    });
    it('line of ￥ with combining even', async () => {
      await term.writeP(Array(50).join('￥\u0301'));
      for (let i = 0; i < term.cols; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        if (i % 2) {
          assert.equal(cell.getChars(), '');
          assert.equal(cell.getChars().length, 0);
          assert.equal(cell.getWidth(), 0);
        } else {
          assert.equal(cell.getChars(), '￥\u0301');
          assert.equal(cell.getChars().length, 2);
          assert.equal(cell.getWidth(), 2);
        }
      }
      term.buffer.lines.get(1)!.loadCell(0, cell);
      assert.equal(cell.getChars(), '￥\u0301');
      assert.equal(cell.getChars().length, 2);
      assert.equal(cell.getWidth(), 2);
    });
    it('line of surrogate fullwidth with combining odd', async () => {
      term.buffer.x = 1;
      await term.writeP(Array(50).join('\ud843\ude6d\u0301'));
      for (let i = 1; i < term.cols - 1; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        if (!(i % 2)) {
          assert.equal(cell.getChars(), '');
          assert.equal(cell.getChars().length, 0);
          assert.equal(cell.getWidth(), 0);
        } else {
          assert.equal(cell.getChars(), '\ud843\ude6d\u0301');
          assert.equal(cell.getChars().length, 3);
          assert.equal(cell.getWidth(), 2);
        }
      }
      term.buffer.lines.get(0)!.loadCell(term.cols - 1, cell);
      assert.equal(cell.getChars(), '');
      assert.equal(cell.getChars().length, 0);
      assert.equal(cell.getWidth(), 1);
      term.buffer.lines.get(1)!.loadCell(0, cell);
      assert.equal(cell.getChars(), '\ud843\ude6d\u0301');
      assert.equal(cell.getChars().length, 3);
      assert.equal(cell.getWidth(), 2);
    });
    it('line of surrogate fullwidth with combining even', async () => {
      await term.writeP(Array(50).join('\ud843\ude6d\u0301'));
      for (let i = 0; i < term.cols; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        if (i % 2) {
          assert.equal(cell.getChars(), '');
          assert.equal(cell.getChars().length, 0);
          assert.equal(cell.getWidth(), 0);
        } else {
          assert.equal(cell.getChars(), '\ud843\ude6d\u0301');
          assert.equal(cell.getChars().length, 3);
          assert.equal(cell.getWidth(), 2);
        }
      }
      term.buffer.lines.get(1)!.loadCell(0, cell);
      assert.equal(cell.getChars(), '\ud843\ude6d\u0301');
      assert.equal(cell.getChars().length, 3);
      assert.equal(cell.getWidth(), 2);
    });
  });

  describe('insert mode', () => {
    const cell = new CellData();
    it('halfwidth - all', async () => {
      await term.writeP(Array(9).join('0123456789').slice(-80));
      term.buffer.x = 10;
      term.buffer.y = 0;
      term.write('\x1b[4h');
      await term.writeP('abcde');
      assert.equal(term.buffer.lines.get(0)!.length, term.cols);
      assert.equal(term.buffer.lines.get(0)!.loadCell(10, cell).getChars(), 'a');
      assert.equal(term.buffer.lines.get(0)!.loadCell(14, cell).getChars(), 'e');
      assert.equal(term.buffer.lines.get(0)!.loadCell(15, cell).getChars(), '0');
      assert.equal(term.buffer.lines.get(0)!.loadCell(79, cell).getChars(), '4');
    });
    it('fullwidth - insert', async () => {
      await term.writeP(Array(9).join('0123456789').slice(-80));
      term.buffer.x = 10;
      term.buffer.y = 0;
      term.write('\x1b[4h');
      await term.writeP('￥￥￥');
      assert.equal(term.buffer.lines.get(0)!.length, term.cols);
      assert.equal(term.buffer.lines.get(0)!.loadCell(10, cell).getChars(), '￥');
      assert.equal(term.buffer.lines.get(0)!.loadCell(11, cell).getChars(), '');
      assert.equal(term.buffer.lines.get(0)!.loadCell(14, cell).getChars(), '￥');
      assert.equal(term.buffer.lines.get(0)!.loadCell(15, cell).getChars(), '');
      assert.equal(term.buffer.lines.get(0)!.loadCell(79, cell).getChars(), '3');
    });
    it('fullwidth - right border', async () => {
      await term.writeP(Array(41).join('￥'));
      term.buffer.x = 10;
      term.buffer.y = 0;
      term.write('\x1b[4h');
      await term.writeP('a');
      assert.equal(term.buffer.lines.get(0)!.length, term.cols);
      assert.equal(term.buffer.lines.get(0)!.loadCell(10, cell).getChars(), 'a');
      assert.equal(term.buffer.lines.get(0)!.loadCell(11, cell).getChars(), '￥');
      assert.equal(term.buffer.lines.get(0)!.loadCell(79, cell).getChars(), '');  // fullwidth char got replaced
      await term.writeP('b');
      assert.equal(term.buffer.lines.get(0)!.length, term.cols);
      assert.equal(term.buffer.lines.get(0)!.loadCell(11, cell).getChars(), 'b');
      assert.equal(term.buffer.lines.get(0)!.loadCell(12, cell).getChars(), '￥');
      assert.equal(term.buffer.lines.get(0)!.loadCell(79, cell).getChars(), '');  // empty cell after fullwidth
    });
  });

  describe('Windows Pty', () => {
    it('should mark lines as wrapped when the line ends in a non-null character after a LF', async () => {
      const data = [
        'aaaaaaaaaa\n\r', // cannot wrap as it's the first
        'aaaaaaaaa\n\r',  // wrapped (windows mode only)
        'aaaaaaaaa'       // not wrapped
      ];

      const normalTerminal = new TestTerminal({ rows: 5, cols: 10, windowsPty: {} });
      await normalTerminal.writeP(data.join(''));
      assert.equal(normalTerminal.buffer.lines.get(0)!.isWrapped, false);
      assert.equal(normalTerminal.buffer.lines.get(1)!.isWrapped, false);
      assert.equal(normalTerminal.buffer.lines.get(2)!.isWrapped, false);

      const windowsModeTerminal = new TestTerminal({ rows: 5, cols: 10, windowsPty: { backend: 'conpty', buildNumber: 19000 } });
      await windowsModeTerminal.writeP(data.join(''));
      assert.equal(windowsModeTerminal.buffer.lines.get(0)!.isWrapped, false);
      assert.equal(windowsModeTerminal.buffer.lines.get(1)!.isWrapped, true, 'This line should wrap in Windows mode as the previous line ends in a non-null character');
      assert.equal(windowsModeTerminal.buffer.lines.get(2)!.isWrapped, false);
    });

    it('should mark lines as wrapped when the line ends in a non-null character after a CUP', async () => {
      const data = [
        'aaaaaaaaaa\x1b[2;1H', // cannot wrap as it's the first
        'aaaaaaaaa\x1b[3;1H',  // wrapped (windows mode only)
        'aaaaaaaaa'             // not wrapped
      ];

      const normalTerminal = new TestTerminal({ rows: 5, cols: 10, windowsPty: {} });
      await normalTerminal.writeP(data.join(''));
      assert.equal(normalTerminal.buffer.lines.get(0)!.isWrapped, false);
      assert.equal(normalTerminal.buffer.lines.get(1)!.isWrapped, false);
      assert.equal(normalTerminal.buffer.lines.get(2)!.isWrapped, false);

      const windowsModeTerminal = new TestTerminal({ rows: 5, cols: 10, windowsPty: { backend: 'conpty', buildNumber: 19000 } });
      await windowsModeTerminal.writeP(data.join(''));
      assert.equal(windowsModeTerminal.buffer.lines.get(0)!.isWrapped, false);
      assert.equal(windowsModeTerminal.buffer.lines.get(1)!.isWrapped, true, 'This line should wrap in Windows mode as the previous line ends in a non-null character');
      assert.equal(windowsModeTerminal.buffer.lines.get(2)!.isWrapped, false);
    });
  });
  describe('Windows Mode', () => {
    it('should mark lines as wrapped when the line ends in a non-null character after a LF', async () => {
      const data = [
        'aaaaaaaaaa\n\r', // cannot wrap as it's the first
        'aaaaaaaaa\n\r',  // wrapped (windows mode only)
        'aaaaaaaaa'       // not wrapped
      ];

      const normalTerminal = new TestTerminal({ rows: 5, cols: 10, windowsMode: false });
      await normalTerminal.writeP(data.join(''));
      assert.equal(normalTerminal.buffer.lines.get(0)!.isWrapped, false);
      assert.equal(normalTerminal.buffer.lines.get(1)!.isWrapped, false);
      assert.equal(normalTerminal.buffer.lines.get(2)!.isWrapped, false);

      const windowsModeTerminal = new TestTerminal({ rows: 5, cols: 10, windowsMode: true });
      await windowsModeTerminal.writeP(data.join(''));
      assert.equal(windowsModeTerminal.buffer.lines.get(0)!.isWrapped, false);
      assert.equal(windowsModeTerminal.buffer.lines.get(1)!.isWrapped, true, 'This line should wrap in Windows mode as the previous line ends in a non-null character');
      assert.equal(windowsModeTerminal.buffer.lines.get(2)!.isWrapped, false);
    });

    it('should mark lines as wrapped when the line ends in a non-null character after a CUP', async () => {
      const data = [
        'aaaaaaaaaa\x1b[2;1H', // cannot wrap as it's the first
        'aaaaaaaaa\x1b[3;1H',  // wrapped (windows mode only)
        'aaaaaaaaa'             // not wrapped
      ];

      const normalTerminal = new TestTerminal({ rows: 5, cols: 10, windowsMode: false });
      await normalTerminal.writeP(data.join(''));
      assert.equal(normalTerminal.buffer.lines.get(0)!.isWrapped, false);
      assert.equal(normalTerminal.buffer.lines.get(1)!.isWrapped, false);
      assert.equal(normalTerminal.buffer.lines.get(2)!.isWrapped, false);

      const windowsModeTerminal = new TestTerminal({ rows: 5, cols: 10, windowsMode: true });
      await windowsModeTerminal.writeP(data.join(''));
      assert.equal(windowsModeTerminal.buffer.lines.get(0)!.isWrapped, false);
      assert.equal(windowsModeTerminal.buffer.lines.get(1)!.isWrapped, true, 'This line should wrap in Windows mode as the previous line ends in a non-null character');
      assert.equal(windowsModeTerminal.buffer.lines.get(2)!.isWrapped, false);
    });
  });
  it('convertEol setting', async () => {
    // not converting
    const termNotConverting = new TestTerminal({ cols: 15, rows: 10 });
    await termNotConverting.writeP('Hello\nWorld');
    assert.equal(termNotConverting.buffer.lines.get(0)!.translateToString(false), 'Hello          ');
    assert.equal(termNotConverting.buffer.lines.get(1)!.translateToString(false), '     World     ');
    assert.equal(termNotConverting.buffer.lines.get(0)!.translateToString(true), 'Hello');
    assert.equal(termNotConverting.buffer.lines.get(1)!.translateToString(true), '     World');

    // converting
    const termConverting = new TestTerminal({ cols: 15, rows: 10, convertEol: true });
    await termConverting.writeP('Hello\nWorld');
    assert.equal(termConverting.buffer.lines.get(0)!.translateToString(false), 'Hello          ');
    assert.equal(termConverting.buffer.lines.get(1)!.translateToString(false), 'World          ');
    assert.equal(termConverting.buffer.lines.get(0)!.translateToString(true), 'Hello');
    assert.equal(termConverting.buffer.lines.get(1)!.translateToString(true), 'World');
  });

  // FIXME: move to common/CoreTerminal.test once the trimming is moved over
  describe('marker lifecycle', () => {
    // create a 10x5 terminal with markers on every line
    // to test marker lifecycle under various terminal actions
    let markers: IMarker[];
    let disposeStack: IMarker[];
    let term: TestTerminal;
    beforeEach(async () => {
      term = new TestTerminal({});
      markers = [];
      disposeStack = [];
      term.optionsService.options.scrollback = 1;
      term.resize(10, 5);
      markers.push(term.buffers.active.addMarker(term.buffers.active.y));
      await term.writeP('\x1b[r0\r\n');
      markers.push(term.buffers.active.addMarker(term.buffers.active.y));
      await term.writeP('1\r\n');
      markers.push(term.buffers.active.addMarker(term.buffers.active.y));
      await term.writeP('2\r\n');
      markers.push(term.buffers.active.addMarker(term.buffers.active.y));
      await term.writeP('3\r\n');
      markers.push(term.buffers.active.addMarker(term.buffers.active.y));
      await term.writeP('4');
      for (let i = 0; i < markers.length; ++i) {
        const marker = markers[i];
        marker.onDispose(() => disposeStack.push(marker));
      }
    });
    it('initial', () => {
      assert.deepEqual(markers.map(m => m.line), [0, 1, 2, 3, 4]);
    });
    it('should dispose on normal trim off the top', async () => {
      // moves top line into scrollback
      await term.writeP('\n');
      assert.deepEqual(disposeStack, []);
      // trims first marker
      await term.writeP('\n');
      assert.deepEqual(disposeStack, [markers[0]]);
      // trims second marker
      await term.writeP('\n');
      assert.deepEqual(disposeStack, [markers[0], markers[1]]);
      // trimmed marker objs should be disposed
      assert.deepEqual(disposeStack.map(el => el.isDisposed), [true, true]);
      // trimmed markers should contain line -1
      assert.deepEqual(disposeStack.map(el => el.line), [-1, -1]);
    });
    it('should dispose on DL', async () => {
      await term.writeP('\x1b[3;1H');  // move cursor to 0, 2
      await term.writeP('\x1b[2M');    // delete 2 lines
      assert.deepEqual(disposeStack, [markers[2], markers[3]]);
    });
    it('should dispose on IL', async () => {
      await term.writeP('\x1b[3;1H');  // move cursor to 0, 2
      await term.writeP('\x1b[2L');    // insert 2 lines
      assert.deepEqual(disposeStack, [markers[4], markers[3]]);
      assert.deepEqual(markers.map(el => el.line), [0, 1, 4, -1, -1]);
    });
    it('should dispose on resize', () => {
      term.resize(10, 2);
      assert.deepEqual(disposeStack, [markers[0], markers[1]]);
      assert.deepEqual(markers.map(el => el.line), [-1, -1, 0, 1, 2]);
    });
  });

  describe('options', () => {
    beforeEach(async () => {
      term = new TestTerminal({});
    });
    it('get options', () => {
      assert.equal(term.options.cols, 80);
      assert.equal(term.options.rows, 24);
    });
    it('set options', async () => {
      term.options.cols = 40;
      assert.equal(term.options.cols, 40);
      term.options.rows = 20;
      assert.equal(term.options.rows, 20);
    });
  });
});
