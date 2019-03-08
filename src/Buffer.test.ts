/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert, expect } from 'chai';
import { ITerminal } from './Types';
import { Buffer, DEFAULT_ATTR, CHAR_DATA_CHAR_INDEX } from './Buffer';
import { CircularList } from './common/CircularList';
import { MockTerminal, TestTerminal } from './ui/TestUtils.test';
import { BufferLine } from './BufferLine';

const INIT_COLS = 80;
const INIT_ROWS = 24;

describe('Buffer', () => {
  let terminal: ITerminal;
  let buffer: Buffer;

  beforeEach(() => {
    terminal = new MockTerminal();
    (terminal as any).cols = INIT_COLS;
    (terminal as any).rows = INIT_ROWS;
    terminal.options.scrollback = 1000;
    buffer = new Buffer(terminal, true);
  });

  describe('constructor', () => {
    it('should create a CircularList with max length equal to rows + scrollback, for its lines', () => {
      assert.instanceOf(buffer.lines, CircularList);
      assert.equal(buffer.lines.maxLength, terminal.rows + terminal.options.scrollback);
    });
    it('should set the Buffer\'s scrollBottom value equal to the terminal\'s rows -1', () => {
      assert.equal(buffer.scrollBottom, terminal.rows - 1);
    });
  });

  describe('fillViewportRows', () => {
    it('should fill the buffer with blank lines based on the size of the viewport', () => {
      const blankLineChar = buffer.getBlankLine(DEFAULT_ATTR).get(0);
      buffer.fillViewportRows();
      assert.equal(buffer.lines.length, INIT_ROWS);
      for (let y = 0; y < INIT_ROWS; y++) {
        assert.equal(buffer.lines.get(y).length, INIT_COLS);
        for (let x = 0; x < INIT_COLS; x++) {
          assert.deepEqual(buffer.lines.get(y).get(x), blankLineChar);
        }
      }
    });
  });

  describe('getWrappedRangeForLine', () => {
    describe('non-wrapped', () => {
      it('should return a single row for the first row', () => {
        buffer.fillViewportRows();
        assert.deepEqual(buffer.getWrappedRangeForLine(0), { first: 0, last: 0 });
      });
      it('should return a single row for a middle row', () => {
        buffer.fillViewportRows();
        assert.deepEqual(buffer.getWrappedRangeForLine(12), { first: 12, last: 12 });
      });
      it('should return a single row for the last row', () => {
        buffer.fillViewportRows();
        assert.deepEqual(buffer.getWrappedRangeForLine(buffer.lines.length - 1), { first: 23, last: 23 });
      });
    });
    describe('wrapped', () => {
      it('should return a range for the first row', () => {
        buffer.fillViewportRows();
        buffer.lines.get(1).isWrapped = true;
        assert.deepEqual(buffer.getWrappedRangeForLine(0), { first: 0, last: 1 });
      });
      it('should return a range for a middle row wrapping upwards', () => {
        buffer.fillViewportRows();
        buffer.lines.get(12).isWrapped = true;
        assert.deepEqual(buffer.getWrappedRangeForLine(12), { first: 11, last: 12 });
      });
      it('should return a range for a middle row wrapping downwards', () => {
        buffer.fillViewportRows();
        buffer.lines.get(13).isWrapped = true;
        assert.deepEqual(buffer.getWrappedRangeForLine(12), { first: 12, last: 13 });
      });
      it('should return a range for a middle row wrapping both ways', () => {
        buffer.fillViewportRows();
        buffer.lines.get(11).isWrapped = true;
        buffer.lines.get(12).isWrapped = true;
        buffer.lines.get(13).isWrapped = true;
        buffer.lines.get(14).isWrapped = true;
        assert.deepEqual(buffer.getWrappedRangeForLine(12), { first: 10, last: 14 });
      });
      it('should return a range for the last row', () => {
        buffer.fillViewportRows();
        buffer.lines.get(23).isWrapped = true;
        assert.deepEqual(buffer.getWrappedRangeForLine(buffer.lines.length - 1), { first: 22, last: 23 });
      });
      it('should return a range for a row that wraps upward to first row', () => {
        buffer.fillViewportRows();
        buffer.lines.get(1).isWrapped = true;
        assert.deepEqual(buffer.getWrappedRangeForLine(1), { first: 0, last: 1 });
      });
      it('should return a range for a row that wraps downward to last row', () => {
        buffer.fillViewportRows();
        buffer.lines.get(buffer.lines.length - 1).isWrapped = true;
        assert.deepEqual(buffer.getWrappedRangeForLine(buffer.lines.length - 2), { first: 22, last: 23 });
      });
    });
  });

  describe('resize', () => {
    describe('column size is reduced', () => {
      it('should trim the data in the buffer', () => {
        buffer.fillViewportRows();
        buffer.resize(INIT_COLS / 2, INIT_ROWS);
        assert.equal(buffer.lines.length, INIT_ROWS);
        for (let i = 0; i < INIT_ROWS; i++) {
          assert.equal(buffer.lines.get(i).length, INIT_COLS / 2);
        }
      });
    });

    describe('column size is increased', () => {
      it('should add pad columns', () => {
        buffer.fillViewportRows();
        buffer.resize(INIT_COLS + 10, INIT_ROWS);
        assert.equal(buffer.lines.length, INIT_ROWS);
        for (let i = 0; i < INIT_ROWS; i++) {
          assert.equal(buffer.lines.get(i).length, INIT_COLS + 10);
        }
      });
    });

    describe('row size reduced', () => {
      it('should trim blank lines from the end', () => {
        buffer.fillViewportRows();
        buffer.resize(INIT_COLS, INIT_ROWS - 10);
        assert.equal(buffer.lines.length, INIT_ROWS - 10);
      });

      it('should move the viewport down when it\'s at the end', () => {
        buffer.fillViewportRows();
        // Set cursor y to have 5 blank lines below it
        buffer.y = INIT_ROWS - 5 - 1;
        buffer.resize(INIT_COLS, INIT_ROWS - 10);
        // Trim 5 rows
        assert.equal(buffer.lines.length, INIT_ROWS - 5);
        // Shift the viewport down 5 rows
        assert.equal(buffer.ydisp, 5);
        assert.equal(buffer.ybase, 5);
      });

      describe('no scrollback', () => {
        it('should trim from the top of the buffer when the cursor reaches the bottom', () => {
          terminal.options.scrollback = 0;
          buffer = new Buffer(terminal, true);
          assert.equal(buffer.lines.maxLength, INIT_ROWS);
          buffer.y = INIT_ROWS - 1;
          buffer.fillViewportRows();
          let chData = buffer.lines.get(5).get(0);
          chData[1] = 'a';
          buffer.lines.get(5).set(0, chData);
          chData = buffer.lines.get(INIT_ROWS - 1).get(0);
          chData[1] = 'b';
          buffer.lines.get(INIT_ROWS - 1).set(0, chData);
          buffer.resize(INIT_COLS, INIT_ROWS - 5);
          assert.equal(buffer.lines.get(0).get(0)[1], 'a');
          assert.equal(buffer.lines.get(INIT_ROWS - 1 - 5).get(0)[1], 'b');
        });
      });
    });

    describe('row size increased', () => {
      describe('empty buffer', () => {
        it('should add blank lines to end', () => {
          buffer.fillViewportRows();
          assert.equal(buffer.ydisp, 0);
          buffer.resize(INIT_COLS, INIT_ROWS + 10);
          assert.equal(buffer.ydisp, 0);
          assert.equal(buffer.lines.length, INIT_ROWS + 10);
        });
      });

      describe('filled buffer', () => {
        it('should show more of the buffer above', () => {
          buffer.fillViewportRows();
          // Create 10 extra blank lines
          for (let i = 0; i < 10; i++) {
            buffer.lines.push(buffer.getBlankLine(DEFAULT_ATTR));
          }
          // Set cursor to the bottom of the buffer
          buffer.y = INIT_ROWS - 1;
          // Scroll down 10 lines
          buffer.ybase = 10;
          buffer.ydisp = 10;
          assert.equal(buffer.lines.length, INIT_ROWS + 10);
          buffer.resize(INIT_COLS, INIT_ROWS + 5);
          // Should be should 5 more lines
          assert.equal(buffer.ydisp, 5);
          assert.equal(buffer.ybase, 5);
          // Should not trim the buffer
          assert.equal(buffer.lines.length, INIT_ROWS + 10);
        });

        it('should show more of the buffer below when the viewport is at the top of the buffer', () => {
          buffer.fillViewportRows();
          // Create 10 extra blank lines
          for (let i = 0; i < 10; i++) {
            buffer.lines.push(buffer.getBlankLine(DEFAULT_ATTR));
          }
          // Set cursor to the bottom of the buffer
          buffer.y = INIT_ROWS - 1;
          // Scroll down 10 lines
          buffer.ybase = 10;
          buffer.ydisp = 0;
          assert.equal(buffer.lines.length, INIT_ROWS + 10);
          buffer.resize(INIT_COLS, INIT_ROWS + 5);
          // The viewport should remain at the top
          assert.equal(buffer.ydisp, 0);
          // The buffer ybase should move up 5 lines
          assert.equal(buffer.ybase, 5);
          // Should not trim the buffer
          assert.equal(buffer.lines.length, INIT_ROWS + 10);
        });
      });
    });

    describe('row and column increased', () => {
      it('should resize properly', () => {
        buffer.fillViewportRows();
        buffer.resize(INIT_COLS + 5, INIT_ROWS + 5);
        assert.equal(buffer.lines.length, INIT_ROWS + 5);
        for (let i = 0; i < INIT_ROWS + 5; i++) {
          assert.equal(buffer.lines.get(i).length, INIT_COLS + 5);
        }
      });
    });

    describe('reflow', () => {
      it('should not wrap empty lines', () => {
        buffer.fillViewportRows();
        assert.equal(buffer.lines.length, INIT_ROWS);
        buffer.resize(INIT_COLS - 5, INIT_ROWS);
        assert.equal(buffer.lines.length, INIT_ROWS);
      });
      it('should shrink row length', () => {
        buffer.fillViewportRows();
        buffer.resize(5, 10);
        assert.equal(buffer.lines.length, 10);
        assert.equal(buffer.lines.get(0).length, 5);
        assert.equal(buffer.lines.get(1).length, 5);
        assert.equal(buffer.lines.get(2).length, 5);
        assert.equal(buffer.lines.get(3).length, 5);
        assert.equal(buffer.lines.get(4).length, 5);
        assert.equal(buffer.lines.get(5).length, 5);
        assert.equal(buffer.lines.get(6).length, 5);
        assert.equal(buffer.lines.get(7).length, 5);
        assert.equal(buffer.lines.get(8).length, 5);
        assert.equal(buffer.lines.get(9).length, 5);
      });
      it('should wrap and unwrap lines', () => {
        buffer.fillViewportRows();
        buffer.resize(5, 10);
        const firstLine = buffer.lines.get(0);
        for (let i = 0; i < 5; i++) {
          const code = 'a'.charCodeAt(0) + i;
          const char = String.fromCharCode(code);
          firstLine.set(i, [null, char, 1, code]);
        }
        buffer.y = 1;
        assert.equal(buffer.lines.get(0).length, 5);
        assert.equal(buffer.lines.get(0).translateToString(), 'abcde');
        buffer.resize(1, 10);
        assert.equal(buffer.lines.length, 10);
        assert.equal(buffer.lines.get(0).translateToString(), 'a');
        assert.equal(buffer.lines.get(1).translateToString(), 'b');
        assert.equal(buffer.lines.get(2).translateToString(), 'c');
        assert.equal(buffer.lines.get(3).translateToString(), 'd');
        assert.equal(buffer.lines.get(4).translateToString(), 'e');
        assert.equal(buffer.lines.get(5).translateToString(), ' ');
        assert.equal(buffer.lines.get(6).translateToString(), ' ');
        assert.equal(buffer.lines.get(7).translateToString(), ' ');
        assert.equal(buffer.lines.get(8).translateToString(), ' ');
        assert.equal(buffer.lines.get(9).translateToString(), ' ');
        buffer.resize(5, 10);
        assert.equal(buffer.lines.length, 10);
        assert.equal(buffer.lines.get(0).translateToString(), 'abcde');
        assert.equal(buffer.lines.get(1).translateToString(), '     ');
        assert.equal(buffer.lines.get(2).translateToString(), '     ');
        assert.equal(buffer.lines.get(3).translateToString(), '     ');
        assert.equal(buffer.lines.get(4).translateToString(), '     ');
        assert.equal(buffer.lines.get(5).translateToString(), '     ');
        assert.equal(buffer.lines.get(6).translateToString(), '     ');
        assert.equal(buffer.lines.get(7).translateToString(), '     ');
        assert.equal(buffer.lines.get(8).translateToString(), '     ');
        assert.equal(buffer.lines.get(9).translateToString(), '     ');
      });
      it('should discard parts of wrapped lines that go out of the scrollback', () => {
        buffer.fillViewportRows();
        terminal.options.scrollback = 1;
        buffer.resize(10, 5);
        const lastLine = buffer.lines.get(3);
        for (let i = 0; i < 10; i++) {
          const code = 'a'.charCodeAt(0) + i;
          const char = String.fromCharCode(code);
          lastLine.set(i, [null, char, 1, code]);
        }
        assert.equal(buffer.lines.length, 5);
        buffer.y = 4;
        buffer.resize(2, 5);
        assert.equal(buffer.y, 4);
        assert.equal(buffer.ybase, 1);
        assert.equal(buffer.lines.length, 6);
        assert.equal(buffer.lines.get(0).translateToString(), 'ab');
        assert.equal(buffer.lines.get(1).translateToString(), 'cd');
        assert.equal(buffer.lines.get(2).translateToString(), 'ef');
        assert.equal(buffer.lines.get(3).translateToString(), 'gh');
        assert.equal(buffer.lines.get(4).translateToString(), 'ij');
        assert.equal(buffer.lines.get(5).translateToString(), '  ');
        buffer.resize(1, 5);
        assert.equal(buffer.y, 4);
        assert.equal(buffer.ybase, 1);
        assert.equal(buffer.lines.length, 6);
        assert.equal(buffer.lines.get(0).translateToString(), 'f');
        assert.equal(buffer.lines.get(1).translateToString(), 'g');
        assert.equal(buffer.lines.get(2).translateToString(), 'h');
        assert.equal(buffer.lines.get(3).translateToString(), 'i');
        assert.equal(buffer.lines.get(4).translateToString(), 'j');
        assert.equal(buffer.lines.get(5).translateToString(), ' ');
        buffer.resize(10, 5);
        assert.equal(buffer.y, 1);
        assert.equal(buffer.ybase, 0);
        assert.equal(buffer.lines.length, 5);
        assert.equal(buffer.lines.get(0).translateToString(), 'fghij     ');
        assert.equal(buffer.lines.get(1).translateToString(), '          ');
        assert.equal(buffer.lines.get(2).translateToString(), '          ');
        assert.equal(buffer.lines.get(3).translateToString(), '          ');
        assert.equal(buffer.lines.get(4).translateToString(), '          ');
      });
      it('should remove the correct amount of rows when reflowing larger', () => {
        // This is a regression test to ensure that successive wrapped lines that are getting
        // 3+ lines removed on a reflow actually remove the right lines
        buffer.fillViewportRows();
        buffer.resize(10, 10);
        buffer.y = 2;
        const firstLine = buffer.lines.get(0);
        const secondLine = buffer.lines.get(1);
        for (let i = 0; i < 10; i++) {
          const code = 'a'.charCodeAt(0) + i;
          const char = String.fromCharCode(code);
          firstLine.set(i, [null, char, 1, code]);
        }
        for (let i = 0; i < 10; i++) {
          const code = '0'.charCodeAt(0) + i;
          const char = String.fromCharCode(code);
          secondLine.set(i, [null, char, 1, code]);
        }
        assert.equal(buffer.lines.length, 10);
        assert.equal(buffer.lines.get(0).translateToString(), 'abcdefghij');
        assert.equal(buffer.lines.get(1).translateToString(), '0123456789');
        for (let i = 2; i < 10; i++) {
          assert.equal(buffer.lines.get(i).translateToString(), '          ');
        }
        buffer.resize(2, 10);
        assert.equal(buffer.ybase, 1);
        assert.equal(buffer.lines.length, 11);
        assert.equal(buffer.lines.get(0).translateToString(), 'ab');
        assert.equal(buffer.lines.get(1).translateToString(), 'cd');
        assert.equal(buffer.lines.get(2).translateToString(), 'ef');
        assert.equal(buffer.lines.get(3).translateToString(), 'gh');
        assert.equal(buffer.lines.get(4).translateToString(), 'ij');
        assert.equal(buffer.lines.get(5).translateToString(), '01');
        assert.equal(buffer.lines.get(6).translateToString(), '23');
        assert.equal(buffer.lines.get(7).translateToString(), '45');
        assert.equal(buffer.lines.get(8).translateToString(), '67');
        assert.equal(buffer.lines.get(9).translateToString(), '89');
        assert.equal(buffer.lines.get(10).translateToString(), '  ');
        buffer.resize(10, 10);
        assert.equal(buffer.ybase, 0);
        assert.equal(buffer.lines.length, 10);
        assert.equal(buffer.lines.get(0).translateToString(), 'abcdefghij');
        assert.equal(buffer.lines.get(1).translateToString(), '0123456789');
        for (let i = 2; i < 10; i++) {
          assert.equal(buffer.lines.get(i).translateToString(), '          ');
        }
      });
      it('should transfer combined char data over to reflowed lines', () => {
        buffer.fillViewportRows();
        buffer.resize(4, 3);
        buffer.y = 2;
        const firstLine = buffer.lines.get(0);
        firstLine.set(0, [ null, 'a', 1, 'a'.charCodeAt(0) ]);
        firstLine.set(1, [ null, 'b', 1, 'b'.charCodeAt(0) ]);
        firstLine.set(2, [ null, 'c', 1, 'c'.charCodeAt(0) ]);
        firstLine.set(3, [ null, '😁', 1, '😁'.charCodeAt(0) ]);
        assert.equal(buffer.lines.length, 3);
        assert.equal(buffer.lines.get(0).translateToString(), 'abc😁');
        assert.equal(buffer.lines.get(1).translateToString(), '    ');
        buffer.resize(2, 3);
        assert.equal(buffer.lines.get(0).translateToString(), 'ab');
        assert.equal(buffer.lines.get(1).translateToString(), 'c😁');
      });
      it('should adjust markers when reflowing', () => {
        buffer.fillViewportRows();
        buffer.resize(10, 16);
        for (let i = 0; i < 10; i++) {
          const code = 'a'.charCodeAt(0) + i;
          const char = String.fromCharCode(code);
          buffer.lines.get(0).set(i, [null, char, 1, code]);
        }
        for (let i = 0; i < 10; i++) {
          const code = '0'.charCodeAt(0) + i;
          const char = String.fromCharCode(code);
          buffer.lines.get(1).set(i, [null, char, 1, code]);
        }
        for (let i = 0; i < 10; i++) {
          const code = 'k'.charCodeAt(0) + i;
          const char = String.fromCharCode(code);
          buffer.lines.get(2).set(i, [null, char, 1, code]);
        }
        buffer.y = 3;
        // Buffer:
        // abcdefghij
        // 0123456789
        // abcdefghij
        const firstMarker = buffer.addMarker(0);
        const secondMarker = buffer.addMarker(1);
        const thirdMarker = buffer.addMarker(2);
        assert.equal(buffer.lines.get(0).translateToString(), 'abcdefghij');
        assert.equal(buffer.lines.get(1).translateToString(), '0123456789');
        assert.equal(buffer.lines.get(2).translateToString(), 'klmnopqrst');
        assert.equal(firstMarker.line, 0);
        assert.equal(secondMarker.line, 1);
        assert.equal(thirdMarker.line, 2);
        buffer.resize(2, 16);
        assert.equal(buffer.lines.get(0).translateToString(), 'ab');
        assert.equal(buffer.lines.get(1).translateToString(), 'cd');
        assert.equal(buffer.lines.get(2).translateToString(), 'ef');
        assert.equal(buffer.lines.get(3).translateToString(), 'gh');
        assert.equal(buffer.lines.get(4).translateToString(), 'ij');
        assert.equal(buffer.lines.get(5).translateToString(), '01');
        assert.equal(buffer.lines.get(6).translateToString(), '23');
        assert.equal(buffer.lines.get(7).translateToString(), '45');
        assert.equal(buffer.lines.get(8).translateToString(), '67');
        assert.equal(buffer.lines.get(9).translateToString(), '89');
        assert.equal(buffer.lines.get(10).translateToString(), 'kl');
        assert.equal(buffer.lines.get(11).translateToString(), 'mn');
        assert.equal(buffer.lines.get(12).translateToString(), 'op');
        assert.equal(buffer.lines.get(13).translateToString(), 'qr');
        assert.equal(buffer.lines.get(14).translateToString(), 'st');
        assert.equal(firstMarker.line, 0, 'first marker should remain unchanged');
        assert.equal(secondMarker.line, 5, 'second marker should be shifted since the first line wrapped');
        assert.equal(thirdMarker.line, 10, 'third marker should be shifted since the first and second lines wrapped');
        buffer.resize(10, 16);
        assert.equal(buffer.lines.get(0).translateToString(), 'abcdefghij');
        assert.equal(buffer.lines.get(1).translateToString(), '0123456789');
        assert.equal(buffer.lines.get(2).translateToString(), 'klmnopqrst');
        assert.equal(firstMarker.line, 0, 'first marker should remain unchanged');
        assert.equal(secondMarker.line, 1, 'second marker should be restored to it\'s original line');
        assert.equal(thirdMarker.line, 2, 'third marker should be restored to it\'s original line');
        assert.equal(firstMarker.isDisposed, false);
        assert.equal(secondMarker.isDisposed, false);
        assert.equal(thirdMarker.isDisposed, false);
      });
      it('should dispose markers whose rows are trimmed during a reflow', () => {
        buffer.fillViewportRows();
        terminal.options.scrollback = 1;
        buffer.resize(10, 11);
        for (let i = 0; i < 10; i++) {
          const code = 'a'.charCodeAt(0) + i;
          const char = String.fromCharCode(code);
          buffer.lines.get(0).set(i, [null, char, 1, code]);
        }
        for (let i = 0; i < 10; i++) {
          const code = '0'.charCodeAt(0) + i;
          const char = String.fromCharCode(code);
          buffer.lines.get(1).set(i, [null, char, 1, code]);
        }
        for (let i = 0; i < 10; i++) {
          const code = 'k'.charCodeAt(0) + i;
          const char = String.fromCharCode(code);
          buffer.lines.get(2).set(i, [null, char, 1, code]);
        }
        buffer.y = 10;
        // Buffer:
        // abcdefghij
        // 0123456789
        // abcdefghij
        const firstMarker = buffer.addMarker(0);
        const secondMarker = buffer.addMarker(1);
        const thirdMarker = buffer.addMarker(2);
        buffer.y = 3;
        assert.equal(buffer.lines.get(0).translateToString(), 'abcdefghij');
        assert.equal(buffer.lines.get(1).translateToString(), '0123456789');
        assert.equal(buffer.lines.get(2).translateToString(), 'klmnopqrst');
        assert.equal(firstMarker.line, 0);
        assert.equal(secondMarker.line, 1);
        assert.equal(thirdMarker.line, 2);
        buffer.resize(2, 11);
        assert.equal(buffer.lines.get(0).translateToString(), 'ij');
        assert.equal(buffer.lines.get(1).translateToString(), '01');
        assert.equal(buffer.lines.get(2).translateToString(), '23');
        assert.equal(buffer.lines.get(3).translateToString(), '45');
        assert.equal(buffer.lines.get(4).translateToString(), '67');
        assert.equal(buffer.lines.get(5).translateToString(), '89');
        assert.equal(buffer.lines.get(6).translateToString(), 'kl');
        assert.equal(buffer.lines.get(7).translateToString(), 'mn');
        assert.equal(buffer.lines.get(8).translateToString(), 'op');
        assert.equal(buffer.lines.get(9).translateToString(), 'qr');
        assert.equal(buffer.lines.get(10).translateToString(), 'st');
        assert.equal(secondMarker.line, 1, 'second marker should remain the same as it was shifted 4 and trimmed 4');
        assert.equal(thirdMarker.line, 6, 'third marker should be shifted since the first and second lines wrapped');
        assert.equal(firstMarker.isDisposed, true, 'first marker was trimmed');
        assert.equal(secondMarker.isDisposed, false);
        assert.equal(thirdMarker.isDisposed, false);
        buffer.resize(10, 11);
        assert.equal(buffer.lines.get(0).translateToString(), 'ij        ');
        assert.equal(buffer.lines.get(1).translateToString(), '0123456789');
        assert.equal(buffer.lines.get(2).translateToString(), 'klmnopqrst');
        assert.equal(secondMarker.line, 1, 'second marker should be restored');
        assert.equal(thirdMarker.line, 2, 'third marker should be restored');
      });
      it('should wrap wide characters correctly when reflowing larger', () => {
        buffer.fillViewportRows();
        buffer.resize(12, 10);
        buffer.y = 2;
        for (let i = 0; i < 12; i += 4) {
          buffer.lines.get(0).set(i, [null, '汉', 2, '汉'.charCodeAt(0)]);
          buffer.lines.get(1).set(i, [null, '汉', 2, '汉'.charCodeAt(0)]);
        }
        for (let i = 2; i < 12; i += 4) {
          buffer.lines.get(0).set(i, [null, '语', 2, '语'.charCodeAt(0)]);
          buffer.lines.get(1).set(i, [null, '语', 2, '语'.charCodeAt(0)]);
        }
        for (let i = 1; i < 12; i += 2) {
          buffer.lines.get(0).set(i, [null, '', 0, undefined]);
          buffer.lines.get(1).set(i, [null, '', 0, undefined]);
        }
        buffer.lines.get(1).isWrapped = true;
        // Buffer:
        // 汉语汉语汉语 (wrapped)
        // 汉语汉语汉语
        assert.equal(buffer.lines.get(0).translateToString(true), '汉语汉语汉语');
        assert.equal(buffer.lines.get(1).translateToString(true), '汉语汉语汉语');
        buffer.resize(13, 10);
        assert.equal(buffer.ybase, 0);
        assert.equal(buffer.lines.length, 10);
        assert.equal(buffer.lines.get(0).translateToString(true), '汉语汉语汉语');
        assert.equal(buffer.lines.get(0).translateToString(false), '汉语汉语汉语 ');
        assert.equal(buffer.lines.get(1).translateToString(true), '汉语汉语汉语');
        assert.equal(buffer.lines.get(1).translateToString(false), '汉语汉语汉语 ');
        buffer.resize(14, 10);
        assert.equal(buffer.lines.get(0).translateToString(true), '汉语汉语汉语汉');
        assert.equal(buffer.lines.get(0).translateToString(false), '汉语汉语汉语汉');
        assert.equal(buffer.lines.get(1).translateToString(true), '语汉语汉语');
        assert.equal(buffer.lines.get(1).translateToString(false), '语汉语汉语    ');
      });
      it('should wrap wide characters correctly when reflowing smaller', () => {
        buffer.fillViewportRows();
        buffer.resize(12, 10);
        buffer.y = 2;
        for (let i = 0; i < 12; i += 4) {
          buffer.lines.get(0).set(i, [null, '汉', 2, '汉'.charCodeAt(0)]);
          buffer.lines.get(1).set(i, [null, '汉', 2, '汉'.charCodeAt(0)]);
        }
        for (let i = 2; i < 12; i += 4) {
          buffer.lines.get(0).set(i, [null, '语', 2, '语'.charCodeAt(0)]);
          buffer.lines.get(1).set(i, [null, '语', 2, '语'.charCodeAt(0)]);
        }
        for (let i = 1; i < 12; i += 2) {
          buffer.lines.get(0).set(i, [null, '', 0, undefined]);
          buffer.lines.get(1).set(i, [null, '', 0, undefined]);
        }
        buffer.lines.get(1).isWrapped = true;
        // Buffer:
        // 汉语汉语汉语 (wrapped)
        // 汉语汉语汉语
        assert.equal(buffer.lines.get(0).translateToString(true), '汉语汉语汉语');
        assert.equal(buffer.lines.get(1).translateToString(true), '汉语汉语汉语');
        buffer.resize(11, 10);
        assert.equal(buffer.ybase, 0);
        assert.equal(buffer.lines.length, 10);
        assert.equal(buffer.lines.get(0).translateToString(true), '汉语汉语汉');
        assert.equal(buffer.lines.get(1).translateToString(true), '语汉语汉语');
        assert.equal(buffer.lines.get(2).translateToString(true), '汉语');
        buffer.resize(10, 10);
        assert.equal(buffer.lines.get(0).translateToString(true), '汉语汉语汉');
        assert.equal(buffer.lines.get(1).translateToString(true), '语汉语汉语');
        assert.equal(buffer.lines.get(2).translateToString(true), '汉语');
        buffer.resize(9, 10);
        assert.equal(buffer.lines.get(0).translateToString(true), '汉语汉语');
        assert.equal(buffer.lines.get(1).translateToString(true), '汉语汉语');
        assert.equal(buffer.lines.get(2).translateToString(true), '汉语汉语');
        buffer.resize(8, 10);
        assert.equal(buffer.lines.get(0).translateToString(true), '汉语汉语');
        assert.equal(buffer.lines.get(1).translateToString(true), '汉语汉语');
        assert.equal(buffer.lines.get(2).translateToString(true), '汉语汉语');
        buffer.resize(7, 10);
        assert.equal(buffer.lines.get(0).translateToString(true), '汉语汉');
        assert.equal(buffer.lines.get(1).translateToString(true), '语汉语');
        assert.equal(buffer.lines.get(2).translateToString(true), '汉语汉');
        assert.equal(buffer.lines.get(3).translateToString(true), '语汉语');
        buffer.resize(6, 10);
        assert.equal(buffer.lines.get(0).translateToString(true), '汉语汉');
        assert.equal(buffer.lines.get(1).translateToString(true), '语汉语');
        assert.equal(buffer.lines.get(2).translateToString(true), '汉语汉');
        assert.equal(buffer.lines.get(3).translateToString(true), '语汉语');
      });

      describe('reflowLarger cases', () => {
        beforeEach(() => {
          // Setup buffer state:
          // 'ab'
          // 'cd' (wrapped)
          // 'ef'
          // 'gh' (wrapped)
          // 'ij'
          // 'kl' (wrapped)
          // '  '
          // '  '
          // '  '
          // '  '
          buffer.fillViewportRows();
          buffer.resize(2, 10);
          buffer.lines.get(0).set(0, [null, 'a', 1, 'a'.charCodeAt(0)]);
          buffer.lines.get(0).set(1, [null, 'b', 1, 'b'.charCodeAt(0)]);
          buffer.lines.get(1).set(0, [null, 'c', 1, 'c'.charCodeAt(0)]);
          buffer.lines.get(1).set(1, [null, 'd', 1, 'd'.charCodeAt(0)]);
          buffer.lines.get(1).isWrapped = true;
          buffer.lines.get(2).set(0, [null, 'e', 1, 'e'.charCodeAt(0)]);
          buffer.lines.get(2).set(1, [null, 'f', 1, 'f'.charCodeAt(0)]);
          buffer.lines.get(3).set(0, [null, 'g', 1, 'g'.charCodeAt(0)]);
          buffer.lines.get(3).set(1, [null, 'h', 1, 'h'.charCodeAt(0)]);
          buffer.lines.get(3).isWrapped = true;
          buffer.lines.get(4).set(0, [null, 'i', 1, 'i'.charCodeAt(0)]);
          buffer.lines.get(4).set(1, [null, 'j', 1, 'j'.charCodeAt(0)]);
          buffer.lines.get(5).set(0, [null, 'k', 1, 'k'.charCodeAt(0)]);
          buffer.lines.get(5).set(1, [null, 'l', 1, 'l'.charCodeAt(0)]);
          buffer.lines.get(5).isWrapped = true;
        });
        describe('viewport not yet filled', () => {
          it('should move the cursor up and add empty lines', () => {
            buffer.y = 6;
            buffer.resize(4, 10);
            assert.equal(buffer.y, 3);
            assert.equal(buffer.ydisp, 0);
            assert.equal(buffer.ybase, 0);
            assert.equal(buffer.lines.length, 10);
            assert.equal(buffer.lines.get(0).translateToString(), 'abcd');
            assert.equal(buffer.lines.get(1).translateToString(), 'efgh');
            assert.equal(buffer.lines.get(2).translateToString(), 'ijkl');
            for (let i = 3; i < 10; i++) {
              assert.equal(buffer.lines.get(i).translateToString(), '    ');
            }
            const wrappedLines: number[] = [];
            for (let i = 0; i < buffer.lines.length; i++) {
              assert.equal(buffer.lines.get(i).isWrapped, wrappedLines.indexOf(i) !== -1, `line ${i} isWrapped must equal ${wrappedLines.indexOf(i) !== -1}`);
            }
          });
        });
        describe('viewport filled, scrollback remaining', () => {
          beforeEach(() => {
            buffer.y = 9;
          });
          describe('ybase === 0', () => {
            it('should move the cursor up and add empty lines', () => {
              buffer.resize(4, 10);
              assert.equal(buffer.y, 6);
              assert.equal(buffer.ydisp, 0);
              assert.equal(buffer.ybase, 0);
              assert.equal(buffer.lines.length, 10);
              assert.equal(buffer.lines.get(0).translateToString(), 'abcd');
              assert.equal(buffer.lines.get(1).translateToString(), 'efgh');
              assert.equal(buffer.lines.get(2).translateToString(), 'ijkl');
              for (let i = 3; i < 10; i++) {
                assert.equal(buffer.lines.get(i).translateToString(), '    ');
              }
              const wrappedLines: number[] = [];
              for (let i = 0; i < buffer.lines.length; i++) {
                assert.equal(buffer.lines.get(i).isWrapped, wrappedLines.indexOf(i) !== -1, `line ${i} isWrapped must equal ${wrappedLines.indexOf(i) !== -1}`);
              }
            });
          });
          describe('ybase !== 0', () => {
            beforeEach(() => {
              // Add 10 empty rows to start
              for (let i = 0; i < 10; i++) {
                buffer.lines.splice(0, 0, buffer.getBlankLine(DEFAULT_ATTR));
              }
              buffer.ybase = 10;
            });
            describe('&& ydisp === ybase', () => {
              it('should adjust the viewport and keep ydisp = ybase', () => {
                buffer.ydisp = 10;
                buffer.resize(4, 10);
                assert.equal(buffer.y, 9);
                assert.equal(buffer.ydisp, 7);
                assert.equal(buffer.ybase, 7);
                assert.equal(buffer.lines.length, 17);
                for (let i = 0; i < 10; i++) {
                  assert.equal(buffer.lines.get(i).translateToString(), '    ');
                }
                assert.equal(buffer.lines.get(10).translateToString(), 'abcd');
                assert.equal(buffer.lines.get(11).translateToString(), 'efgh');
                assert.equal(buffer.lines.get(12).translateToString(), 'ijkl');
                for (let i = 13; i < 17; i++) {
                  assert.equal(buffer.lines.get(i).translateToString(), '    ');
                }
                const wrappedLines: number[] = [];
                for (let i = 0; i < buffer.lines.length; i++) {
                  assert.equal(buffer.lines.get(i).isWrapped, wrappedLines.indexOf(i) !== -1, `line ${i} isWrapped must equal ${wrappedLines.indexOf(i) !== -1}`);
                }
              });
            });
            describe('&& ydisp !== ybase', () => {
              it('should keep ydisp at the same value', () => {
                buffer.ydisp = 5;
                buffer.resize(4, 10);
                assert.equal(buffer.y, 9);
                assert.equal(buffer.ydisp, 5);
                assert.equal(buffer.ybase, 7);
                assert.equal(buffer.lines.length, 17);
                for (let i = 0; i < 10; i++) {
                  assert.equal(buffer.lines.get(i).translateToString(), '    ');
                }
                assert.equal(buffer.lines.get(10).translateToString(), 'abcd');
                assert.equal(buffer.lines.get(11).translateToString(), 'efgh');
                assert.equal(buffer.lines.get(12).translateToString(), 'ijkl');
                for (let i = 13; i < 17; i++) {
                  assert.equal(buffer.lines.get(i).translateToString(), '    ');
                }
                const wrappedLines: number[] = [];
                for (let i = 0; i < buffer.lines.length; i++) {
                  assert.equal(buffer.lines.get(i).isWrapped, wrappedLines.indexOf(i) !== -1, `line ${i} isWrapped must equal ${wrappedLines.indexOf(i) !== -1}`);
                }
              });
            });
          });
        });
        describe('viewport filled, no scrollback remaining', () => {
          // ybase === 0 doesn't make sense here as scrollback=0 isn't really supported
          describe('ybase !== 0', () => {
            beforeEach(() => {
              terminal.options.scrollback = 10;
              // Add 10 empty rows to start
              for (let i = 0; i < 10; i++) {
                buffer.lines.splice(0, 0, buffer.getBlankLine(DEFAULT_ATTR));
              }
              buffer.y = 9;
              buffer.ybase = 10;
            });
            describe('&& ydisp === ybase', () => {
              it('should trim lines and keep ydisp = ybase', () => {
                buffer.ydisp = 10;
                buffer.resize(4, 10);
                assert.equal(buffer.y, 9);
                assert.equal(buffer.ydisp, 7);
                assert.equal(buffer.ybase, 7);
                assert.equal(buffer.lines.length, 17);
                for (let i = 0; i < 10; i++) {
                  assert.equal(buffer.lines.get(i).translateToString(), '    ');
                }
                assert.equal(buffer.lines.get(10).translateToString(), 'abcd');
                assert.equal(buffer.lines.get(11).translateToString(), 'efgh');
                assert.equal(buffer.lines.get(12).translateToString(), 'ijkl');
                for (let i = 13; i < 17; i++) {
                  assert.equal(buffer.lines.get(i).translateToString(), '    ');
                }
                const wrappedLines: number[] = [];
                for (let i = 0; i < buffer.lines.length; i++) {
                  assert.equal(buffer.lines.get(i).isWrapped, wrappedLines.indexOf(i) !== -1, `line ${i} isWrapped must equal ${wrappedLines.indexOf(i) !== -1}`);
                }
              });
            });
            describe('&& ydisp !== ybase', () => {
              it('should trim lines and not change ydisp', () => {
                buffer.ydisp = 5;
                buffer.resize(4, 10);
                assert.equal(buffer.y, 9);
                assert.equal(buffer.ydisp, 5);
                assert.equal(buffer.ybase, 7);
                assert.equal(buffer.lines.length, 17);
                for (let i = 0; i < 10; i++) {
                  assert.equal(buffer.lines.get(i).translateToString(), '    ');
                }
                assert.equal(buffer.lines.get(10).translateToString(), 'abcd');
                assert.equal(buffer.lines.get(11).translateToString(), 'efgh');
                assert.equal(buffer.lines.get(12).translateToString(), 'ijkl');
                for (let i = 13; i < 17; i++) {
                  assert.equal(buffer.lines.get(i).translateToString(), '    ');
                }
                const wrappedLines: number[] = [];
                for (let i = 0; i < buffer.lines.length; i++) {
                  assert.equal(buffer.lines.get(i).isWrapped, wrappedLines.indexOf(i) !== -1, `line ${i} isWrapped must equal ${wrappedLines.indexOf(i) !== -1}`);
                }
              });
            });
          });
        });
      });
      describe('reflowSmaller cases', () => {
        beforeEach(() => {
          // Setup buffer state:
          // 'abcd'
          // 'efgh' (wrapped)
          // 'ijkl'
          // '    '
          // '    '
          // '    '
          // '    '
          // '    '
          // '    '
          // '    '
          buffer.fillViewportRows();
          buffer.resize(4, 10);
          buffer.lines.get(0).set(0, [null, 'a', 1, 'a'.charCodeAt(0)]);
          buffer.lines.get(0).set(1, [null, 'b', 1, 'b'.charCodeAt(0)]);
          buffer.lines.get(0).set(2, [null, 'c', 1, 'c'.charCodeAt(0)]);
          buffer.lines.get(0).set(3, [null, 'd', 1, 'd'.charCodeAt(0)]);
          buffer.lines.get(1).set(0, [null, 'e', 1, 'e'.charCodeAt(0)]);
          buffer.lines.get(1).set(1, [null, 'f', 1, 'f'.charCodeAt(0)]);
          buffer.lines.get(1).set(2, [null, 'g', 1, 'g'.charCodeAt(0)]);
          buffer.lines.get(1).set(3, [null, 'h', 1, 'h'.charCodeAt(0)]);
          buffer.lines.get(2).set(0, [null, 'i', 1, 'i'.charCodeAt(0)]);
          buffer.lines.get(2).set(1, [null, 'j', 1, 'j'.charCodeAt(0)]);
          buffer.lines.get(2).set(2, [null, 'k', 1, 'k'.charCodeAt(0)]);
          buffer.lines.get(2).set(3, [null, 'l', 1, 'l'.charCodeAt(0)]);
        });
        describe('viewport not yet filled', () => {
          it('should move the cursor down', () => {
            buffer.y = 3;
            buffer.resize(2, 10);
            assert.equal(buffer.y, 6);
            assert.equal(buffer.ydisp, 0);
            assert.equal(buffer.ybase, 0);
            assert.equal(buffer.lines.length, 10);
            assert.equal(buffer.lines.get(0).translateToString(), 'ab');
            assert.equal(buffer.lines.get(1).translateToString(), 'cd');
            assert.equal(buffer.lines.get(2).translateToString(), 'ef');
            assert.equal(buffer.lines.get(3).translateToString(), 'gh');
            assert.equal(buffer.lines.get(4).translateToString(), 'ij');
            assert.equal(buffer.lines.get(5).translateToString(), 'kl');
            for (let i = 6; i < 10; i++) {
              assert.equal(buffer.lines.get(i).translateToString(), '  ');
            }
            const wrappedLines = [1, 3, 5];
            for (let i = 0; i < buffer.lines.length; i++) {
              assert.equal(buffer.lines.get(i).isWrapped, wrappedLines.indexOf(i) !== -1, `line ${i} isWrapped must equal ${wrappedLines.indexOf(i) !== -1}`);
            }
          });
        });
        describe('viewport filled, scrollback remaining', () => {
          beforeEach(() => {
            buffer.y = 9;
          });
          describe('ybase === 0', () => {
            it('should trim the top', () => {
              buffer.resize(2, 10);
              assert.equal(buffer.y, 9);
              assert.equal(buffer.ydisp, 3);
              assert.equal(buffer.ybase, 3);
              assert.equal(buffer.lines.length, 13);
              assert.equal(buffer.lines.get(0).translateToString(), 'ab');
              assert.equal(buffer.lines.get(1).translateToString(), 'cd');
              assert.equal(buffer.lines.get(2).translateToString(), 'ef');
              assert.equal(buffer.lines.get(3).translateToString(), 'gh');
              assert.equal(buffer.lines.get(4).translateToString(), 'ij');
              assert.equal(buffer.lines.get(5).translateToString(), 'kl');
              for (let i = 6; i < 13; i++) {
                assert.equal(buffer.lines.get(i).translateToString(), '  ');
              }
              const wrappedLines = [1, 3, 5];
              for (let i = 0; i < buffer.lines.length; i++) {
                assert.equal(buffer.lines.get(i).isWrapped, wrappedLines.indexOf(i) !== -1, `line ${i} isWrapped must equal ${wrappedLines.indexOf(i) !== -1}`);
              }
            });
          });
          describe('ybase !== 0', () => {
            beforeEach(() => {
              // Add 10 empty rows to start
              for (let i = 0; i < 10; i++) {
                buffer.lines.splice(0, 0, buffer.getBlankLine(DEFAULT_ATTR));
              }
              buffer.ybase = 10;
            });
            describe('&& ydisp === ybase', () => {
              it('should adjust the viewport and keep ydisp = ybase', () => {
                buffer.ydisp = 10;
                buffer.resize(2, 10);
                assert.equal(buffer.ydisp, 13);
                assert.equal(buffer.ybase, 13);
                assert.equal(buffer.lines.length, 23);
                for (let i = 0; i < 10; i++) {
                  assert.equal(buffer.lines.get(i).translateToString(), '  ');
                }
                assert.equal(buffer.lines.get(10).translateToString(), 'ab');
                assert.equal(buffer.lines.get(11).translateToString(), 'cd');
                assert.equal(buffer.lines.get(12).translateToString(), 'ef');
                assert.equal(buffer.lines.get(13).translateToString(), 'gh');
                assert.equal(buffer.lines.get(14).translateToString(), 'ij');
                assert.equal(buffer.lines.get(15).translateToString(), 'kl');
                for (let i = 16; i < 23; i++) {
                  assert.equal(buffer.lines.get(i).translateToString(), '  ');
                }
                const wrappedLines = [11, 13, 15];
                for (let i = 0; i < buffer.lines.length; i++) {
                  assert.equal(buffer.lines.get(i).isWrapped, wrappedLines.indexOf(i) !== -1, `line ${i} isWrapped must equal ${wrappedLines.indexOf(i) !== -1}`);
                }
              });
            });
            describe('&& ydisp !== ybase', () => {
              it('should keep ydisp at the same value', () => {
                buffer.ydisp = 5;
                buffer.resize(2, 10);
                assert.equal(buffer.ydisp, 5);
                assert.equal(buffer.ybase, 13);
                assert.equal(buffer.lines.length, 23);
                for (let i = 0; i < 10; i++) {
                  assert.equal(buffer.lines.get(i).translateToString(), '  ');
                }
                assert.equal(buffer.lines.get(10).translateToString(), 'ab');
                assert.equal(buffer.lines.get(11).translateToString(), 'cd');
                assert.equal(buffer.lines.get(12).translateToString(), 'ef');
                assert.equal(buffer.lines.get(13).translateToString(), 'gh');
                assert.equal(buffer.lines.get(14).translateToString(), 'ij');
                assert.equal(buffer.lines.get(15).translateToString(), 'kl');
                for (let i = 16; i < 23; i++) {
                  assert.equal(buffer.lines.get(i).translateToString(), '  ');
                }
                const wrappedLines = [11, 13, 15];
                for (let i = 0; i < buffer.lines.length; i++) {
                  assert.equal(buffer.lines.get(i).isWrapped, wrappedLines.indexOf(i) !== -1, `line ${i} isWrapped must equal ${wrappedLines.indexOf(i) !== -1}`);
                }
              });
            });
          });
        });
        describe('viewport filled, no scrollback remaining', () => {
          // ybase === 0 doesn't make sense here as scrollback=0 isn't really supported
          describe('ybase !== 0', () => {
            beforeEach(() => {
              terminal.options.scrollback = 10;
              // Add 10 empty rows to start
              for (let i = 0; i < 10; i++) {
                buffer.lines.splice(0, 0, buffer.getBlankLine(DEFAULT_ATTR));
              }
              buffer.ybase = 10;
            });
            describe('&& ydisp === ybase', () => {
              it('should trim lines and keep ydisp = ybase', () => {
                buffer.ydisp = 10;
                buffer.y = 13;
                buffer.resize(2, 10);
                assert.equal(buffer.ydisp, 10);
                assert.equal(buffer.ybase, 10);
                assert.equal(buffer.lines.length, 20);
                for (let i = 0; i < 7; i++) {
                  assert.equal(buffer.lines.get(i).translateToString(), '  ');
                }
                assert.equal(buffer.lines.get(7).translateToString(), 'ab');
                assert.equal(buffer.lines.get(8).translateToString(), 'cd');
                assert.equal(buffer.lines.get(9).translateToString(), 'ef');
                assert.equal(buffer.lines.get(10).translateToString(), 'gh');
                assert.equal(buffer.lines.get(11).translateToString(), 'ij');
                assert.equal(buffer.lines.get(12).translateToString(), 'kl');
                for (let i = 13; i < 20; i++) {
                  assert.equal(buffer.lines.get(i).translateToString(), '  ');
                }
                const wrappedLines = [8, 10, 12];
                for (let i = 0; i < buffer.lines.length; i++) {
                  assert.equal(buffer.lines.get(i).isWrapped, wrappedLines.indexOf(i) !== -1, `line ${i} isWrapped must equal ${wrappedLines.indexOf(i) !== -1}`);
                }
              });
            });
            describe('&& ydisp !== ybase', () => {
              it('should trim lines and not change ydisp', () => {
                buffer.ydisp = 5;
                buffer.y = 13;
                buffer.resize(2, 10);
                assert.equal(buffer.ydisp, 5);
                assert.equal(buffer.ybase, 10);
                assert.equal(buffer.lines.length, 20);
                for (let i = 0; i < 7; i++) {
                  assert.equal(buffer.lines.get(i).translateToString(), '  ');
                }
                assert.equal(buffer.lines.get(7).translateToString(), 'ab');
                assert.equal(buffer.lines.get(8).translateToString(), 'cd');
                assert.equal(buffer.lines.get(9).translateToString(), 'ef');
                assert.equal(buffer.lines.get(10).translateToString(), 'gh');
                assert.equal(buffer.lines.get(11).translateToString(), 'ij');
                assert.equal(buffer.lines.get(12).translateToString(), 'kl');
                for (let i = 13; i < 20; i++) {
                  assert.equal(buffer.lines.get(i).translateToString(), '  ');
                }
                const wrappedLines = [8, 10, 12];
                for (let i = 0; i < buffer.lines.length; i++) {
                  assert.equal(buffer.lines.get(i).isWrapped, wrappedLines.indexOf(i) !== -1, `line ${i} isWrapped must equal ${wrappedLines.indexOf(i) !== -1}`);
                }
              });
            });
          });
        });
      });
    });
  });

  describe('buffer marked to have no scrollback', () => {
    it('should always have a scrollback of 0', () => {
      assert.equal(terminal.options.scrollback, 1000);
      // Test size on initialization
      buffer = new Buffer(terminal, false);
      buffer.fillViewportRows();
      assert.equal(buffer.lines.maxLength, INIT_ROWS);
      // Test size on buffer increase
      buffer.resize(INIT_COLS, INIT_ROWS * 2);
      assert.equal(buffer.lines.maxLength, INIT_ROWS * 2);
      // Test size on buffer decrease
      buffer.resize(INIT_COLS, INIT_ROWS / 2);
      assert.equal(buffer.lines.maxLength, INIT_ROWS / 2);
    });
  });

  describe('addMarker', () => {
    it('should adjust a marker line when the buffer is trimmed', () => {
      terminal.options.scrollback = 0;
      buffer = new Buffer(terminal, true);
      buffer.fillViewportRows();
      const marker = buffer.addMarker(buffer.lines.length - 1);
      assert.equal(marker.line, buffer.lines.length - 1);
      buffer.lines.emit('trim', 1);
      assert.equal(marker.line, buffer.lines.length - 2);
    });
    it('should dispose of a marker if it is trimmed off the buffer', () => {
      terminal.options.scrollback = 0;
      buffer = new Buffer(terminal, true);
      buffer.fillViewportRows();
      assert.equal(buffer.markers.length, 0);
      const marker = buffer.addMarker(0);
      assert.equal(marker.isDisposed, false);
      assert.equal(buffer.markers.length, 1);
      buffer.lines.emit('trim', 1);
      assert.equal(marker.isDisposed, true);
      assert.equal(buffer.markers.length, 0);
    });
  });

  describe ('translateBufferLineToString', () => {
    it('should handle selecting a section of ascii text', () => {
      const line = new BufferLine(4);
      line.set(0, [ null, 'a', 1, 'a'.charCodeAt(0)]);
      line.set(1, [ null, 'b', 1, 'b'.charCodeAt(0)]);
      line.set(2, [ null, 'c', 1, 'c'.charCodeAt(0)]);
      line.set(3, [ null, 'd', 1, 'd'.charCodeAt(0)]);
      buffer.lines.set(0, line);

      const str = buffer.translateBufferLineToString(0, true, 0, 2);
      assert.equal(str, 'ab');
    });

    it('should handle a cut-off double width character by including it', () => {
      const line = new BufferLine(3);
      line.set(0, [ null, '語', 2, 35486 ]);
      line.set(1, [ null, '', 0, null]);
      line.set(2, [ null, 'a', 1, 'a'.charCodeAt(0)]);
      buffer.lines.set(0, line);

      const str1 = buffer.translateBufferLineToString(0, true, 0, 1);
      assert.equal(str1, '語');
    });

    it('should handle a zero width character in the middle of the string by not including it', () => {
      const line = new BufferLine(3);
      line.set(0, [ null, '語', 2, '語'.charCodeAt(0) ]);
      line.set(1, [ null, '', 0, null]);
      line.set(2, [ null, 'a', 1, 'a'.charCodeAt(0)]);
      buffer.lines.set(0, line);

      const str0 = buffer.translateBufferLineToString(0, true, 0, 1);
      assert.equal(str0, '語');

      const str1 = buffer.translateBufferLineToString(0, true, 0, 2);
      assert.equal(str1, '語');

      const str2 = buffer.translateBufferLineToString(0, true, 0, 3);
      assert.equal(str2, '語a');
    });

    it('should handle single width emojis', () => {
      const line = new BufferLine(2);
      line.set(0, [ null, '😁', 1, '😁'.charCodeAt(0) ]);
      line.set(1, [ null, 'a', 1, 'a'.charCodeAt(0)]);
      buffer.lines.set(0, line);

      const str1 = buffer.translateBufferLineToString(0, true, 0, 1);
      assert.equal(str1, '😁');

      const str2 = buffer.translateBufferLineToString(0, true, 0, 2);
      assert.equal(str2, '😁a');
    });

    it('should handle double width emojis', () => {
      const line = new BufferLine(2);
      line.set(0, [ null, '😁', 2, '😁'.charCodeAt(0) ]);
      line.set(1, [ null, '', 0, null]);
      buffer.lines.set(0, line);

      const str1 = buffer.translateBufferLineToString(0, true, 0, 1);
      assert.equal(str1, '😁');

      const str2 = buffer.translateBufferLineToString(0, true, 0, 2);
      assert.equal(str2, '😁');

      const line2 = new BufferLine(3);
      line2.set(0, [ null, '😁', 2, '😁'.charCodeAt(0) ]);
      line2.set(1, [ null, '', 0, null]);
      line2.set(2, [ null, 'a', 1, 'a'.charCodeAt(0)]);
      buffer.lines.set(0, line2);

      const str3 = buffer.translateBufferLineToString(0, true, 0, 3);
      assert.equal(str3, '😁a');
    });
  });
  describe('stringIndexToBufferIndex', () => {
    let terminal: TestTerminal;

    beforeEach(() => {
      terminal = new TestTerminal({rows: 5, cols: 10, scrollback: 5});
    });

    it('multiline ascii', () => {
      const input = 'This is ASCII text spanning multiple lines.';
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      for (let i = 0; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([(i / terminal.cols) | 0, i % terminal.cols], bufferIndex);
      }
    });

    it('combining e\u0301 in a sentence', () => {
      const input = 'Sitting in the cafe\u0301 drinking coffee.';
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      for (let i = 0; i < 19; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([(i / terminal.cols) | 0, i % terminal.cols], bufferIndex);
      }
      // string index 18 & 19 point to combining char e\u0301 ---> same buffer Index
      assert.deepEqual(
        terminal.buffer.stringIndexToBufferIndex(0, 18),
        terminal.buffer.stringIndexToBufferIndex(0, 19));
      // after the combining char every string index has an offset of -1
      for (let i = 19; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([((i - 1) / terminal.cols) | 0, (i - 1) % terminal.cols], bufferIndex);
      }
    });

    it('multiline combining e\u0301', () => {
      const input = 'e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301';
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      // every buffer cell index contains 2 string indices
      for (let i = 0; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([((i >> 1) / terminal.cols) | 0, (i >> 1) % terminal.cols], bufferIndex);
      }
    });

    it('surrogate char in a sentence', () => {
      const input = 'The 𝄞 is a clef widely used in modern notation.';
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      for (let i = 0; i < 5; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([(i / terminal.cols) | 0, i % terminal.cols], bufferIndex);
      }
      // string index 4 & 5 point to surrogate char 𝄞 ---> same buffer Index
      assert.deepEqual(
        terminal.buffer.stringIndexToBufferIndex(0, 4),
        terminal.buffer.stringIndexToBufferIndex(0, 5));
      // after the combining char every string index has an offset of -1
      for (let i = 5; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([((i - 1) / terminal.cols) | 0, (i - 1) % terminal.cols], bufferIndex);
      }
    });

    it('multiline surrogate char', () => {
      const input = '𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞';
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      // every buffer cell index contains 2 string indices
      for (let i = 0; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([((i >> 1) / terminal.cols) | 0, (i >> 1) % terminal.cols], bufferIndex);
      }
    });

    it('surrogate char with combining', () => {
      // eye of Ra with acute accent - string length of 3
      const input = '𓂀\u0301 - the eye hiroglyph with an acute accent.';
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      // index 0..2 should map to 0
      assert.deepEqual([0, 0], terminal.buffer.stringIndexToBufferIndex(0, 1));
      assert.deepEqual([0, 0], terminal.buffer.stringIndexToBufferIndex(0, 2));
      for (let i = 2; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([((i - 2) / terminal.cols) | 0, (i - 2) % terminal.cols], bufferIndex);
      }
    });

    it('multiline surrogate with combining', () => {
      const input = '𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301';
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      // every buffer cell index contains 3 string indices
      for (let i = 0; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([(((i / 3) | 0) / terminal.cols) | 0, ((i / 3) | 0) % terminal.cols], bufferIndex);
      }
    });

    it('fullwidth chars', () => {
      const input = 'These １２３ are some fat numbers.';
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      for (let i = 0; i < 6; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([(i / terminal.cols) | 0, i % terminal.cols], bufferIndex);
      }
      // string index 6, 7, 8 take 2 cells
      assert.deepEqual([0, 8], terminal.buffer.stringIndexToBufferIndex(0, 7));
      assert.deepEqual([1, 0], terminal.buffer.stringIndexToBufferIndex(0, 8));
      // rest of the string has offset of +3
      for (let i = 9; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([((i + 3) / terminal.cols) | 0, (i + 3) % terminal.cols], bufferIndex);
      }
    });

    it('multiline fullwidth chars', () => {
      const input = '１２３４５６７８９０１２３４５６７８９０';
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      for (let i = 9; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([((i << 1) / terminal.cols) | 0, (i << 1) % terminal.cols], bufferIndex);
      }
    });

    it('fullwidth combining with emoji - match emoji cell', () => {
      const input = 'Lots of ￥\u0301 make me 😃.';
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      const stringIndex = s.match(/😃/).index;
      const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, stringIndex);
      assert(terminal.buffer.lines.get(bufferIndex[0]).get(bufferIndex[1])[CHAR_DATA_CHAR_INDEX], '😃');
    });

    it('multiline fullwidth chars with offset 1 (currently tests for broken behavior)', () => {
      const input = 'a１２３４５６７８９０１２３４５６７８９０';
      // the 'a' at the beginning moves all fullwidth chars one to the right
      // now the end of the line contains a dangling empty cell since
      // the next fullwidth char has to wrap early
      // the dangling last cell is wrongly added in the string
      // --> fixable after resolving #1685
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      for (let i = 10; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i, true);
        const j = (i - 0) << 1;
        assert.deepEqual([(j / terminal.cols) | 0, j % terminal.cols], bufferIndex);
      }
    });

    it('test fully wrapped buffer up to last char', () => {
      const input = Array(6).join('1234567890');
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      for (let i = 0; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i, true);
        assert.equal(input[i], terminal.buffer.lines.get(bufferIndex[0]).get(bufferIndex[1])[CHAR_DATA_CHAR_INDEX]);
      }
    });

    it('test fully wrapped buffer up to last char with full width odd', () => {
      const input = 'a￥\u0301a￥\u0301a￥\u0301a￥\u0301a￥\u0301a￥\u0301a￥\u0301a￥\u0301'
                    + 'a￥\u0301a￥\u0301a￥\u0301a￥\u0301a￥\u0301a￥\u0301a￥\u0301';
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      for (let i = 0; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i, true);
        assert.equal(
          (!(i % 3))
            ? input[i]
            : (i % 3 === 1)
              ? input.substr(i, 2)
              : input.substr(i - 1, 2),
          terminal.buffer.lines.get(bufferIndex[0]).get(bufferIndex[1])[CHAR_DATA_CHAR_INDEX]);
      }
    });

    it('should handle \t in lines correctly', () => {
      const input = '\thttps://google.de';
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(s, Array(terminal.getOption('tabStopWidth') + 1).join(' ') + 'https://google.de');
    });
  });
  describe('BufferStringIterator', function(): void {
    it('iterator does not overflow buffer limits', function(): void {
      const terminal = new TestTerminal({rows: 5, cols: 10, scrollback: 5});
      const data = [
        'aaaaaaaaaa',
        'aaaaaaaaa\n',
        'aaaaaaaaaa',
        'aaaaaaaaa\n',
        'aaaaaaaaaa',
        'aaaaaaaaaa',
        'aaaaaaaaaa',
        'aaaaaaaaa\n',
        'aaaaaaaaaa',
        'aaaaaaaaaa'
      ];
      terminal.writeSync(data.join(''));
      // brute force test with insane values
      expect(() => {
        for (let overscan = 0; overscan < 20; ++overscan) {
          for (let start = -10; start < 20; ++start) {
            for (let end = -10; end < 20; ++end) {
              const it = terminal.buffer.iterator(false, start, end, overscan, overscan);
              while (it.hasNext()) {
                it.next();
              }
            }
          }
        }
      }).to.not.throw();
    });
  });
});
