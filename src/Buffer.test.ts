/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert, expect } from 'chai';
import { ITerminal } from './Types';
import { Buffer, DEFAULT_ATTR, CHAR_DATA_CHAR_INDEX } from './Buffer';
import { CircularList } from './common/CircularList';
import { MockTerminal, TestTerminal } from './utils/TestUtils.test';
import { BufferLine } from './BufferLine';

const INIT_COLS = 80;
const INIT_ROWS = 24;

describe('Buffer', () => {
  let terminal: ITerminal;
  let buffer: Buffer;

  beforeEach(() => {
    terminal = new MockTerminal();
    terminal.cols = INIT_COLS;
    terminal.rows = INIT_ROWS;
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
      const blankLineChar = BufferLine.blankLine(terminal.cols, DEFAULT_ATTR).get(0);
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
      it('should not trim the data in the buffer', () => {
        buffer.fillViewportRows();
        buffer.resize(INIT_COLS / 2, INIT_ROWS);
        assert.equal(buffer.lines.length, INIT_ROWS);
        for (let i = 0; i < INIT_ROWS; i++) {
          assert.equal(buffer.lines.get(i).length, INIT_COLS);
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
          buffer.lines.get(5).get(0)[1] = 'a';
          buffer.lines.get(INIT_ROWS - 1).get(0)[1] = 'b';
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
            buffer.lines.push(BufferLine.blankLine(terminal.cols, DEFAULT_ATTR));
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
            buffer.lines.push(BufferLine.blankLine(terminal.cols, DEFAULT_ATTR));
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
      const line = new BufferLine();
      line.push([ null, 'a', 1, 'a'.charCodeAt(0)]);
      line.push([ null, 'b', 1, 'b'.charCodeAt(0)]);
      line.push([ null, 'c', 1, 'c'.charCodeAt(0)]);
      line.push([ null, 'd', 1, 'd'.charCodeAt(0)]);
      buffer.lines.set(0, line);

      const str = buffer.translateBufferLineToString(0, true, 0, 2);
      assert.equal(str, 'ab');
    });

    it('should handle a cut-off double width character by including it', () => {
      const line = new BufferLine();
      line.push([ null, '語', 2, 35486 ]);
      line.push([ null, '', 0, null]);
      line.push([ null, 'a', 1, 'a'.charCodeAt(0)]);
      buffer.lines.set(0, line);

      const str1 = buffer.translateBufferLineToString(0, true, 0, 1);
      assert.equal(str1, '語');
    });

    it('should handle a zero width character in the middle of the string by not including it', () => {
      const line = new BufferLine();
      line.push([ null, '語', 2, '語'.charCodeAt(0) ]);
      line.push([ null, '', 0, null]);
      line.push([ null, 'a', 1, 'a'.charCodeAt(0)]);
      buffer.lines.set(0, line);

      const str0 = buffer.translateBufferLineToString(0, true, 0, 1);
      assert.equal(str0, '語');

      const str1 = buffer.translateBufferLineToString(0, true, 0, 2);
      assert.equal(str1, '語');

      const str2 = buffer.translateBufferLineToString(0, true, 0, 3);
      assert.equal(str2, '語a');
    });

    it('should handle single width emojis', () => {
      const line = new BufferLine();
      line.push([ null, '😁', 1, '😁'.charCodeAt(0) ]);
      line.push([ null, 'a', 1, 'a'.charCodeAt(0)]);
      buffer.lines.set(0, line);

      const str1 = buffer.translateBufferLineToString(0, true, 0, 1);
      assert.equal(str1, '😁');

      const str2 = buffer.translateBufferLineToString(0, true, 0, 2);
      assert.equal(str2, '😁a');
    });

    it('should handle double width emojis', () => {
      const line = new BufferLine();
      line.push([ null, '😁', 2, '😁'.charCodeAt(0) ]);
      line.push([ null, '', 0, null]);
      buffer.lines.set(0, line);

      const str1 = buffer.translateBufferLineToString(0, true, 0, 1);
      assert.equal(str1, '😁');

      const str2 = buffer.translateBufferLineToString(0, true, 0, 2);
      assert.equal(str2, '😁');

      const line2 = new BufferLine();
      line2.push([ null, '😁', 2, '😁'.charCodeAt(0) ]);
      line2.push([ null, '', 0, null]);
      line2.push([ null, 'a', 1, 'a'.charCodeAt(0)]);
      buffer.lines.set(0, line2);

      const str3 = buffer.translateBufferLineToString(0, true, 0, 3);
      assert.equal(str3, '😁a');
    });
  });
  describe('stringIndexToBufferIndex', () => {
    let terminal: TestTerminal;

    beforeEach(() => {
      terminal = new TestTerminal({rows: 5, cols: 10});
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
      // TODO: reenable after fix
      // const s = terminal.buffer.contents(true).toArray()[0];
      // assert.equal(input, s);
      for (let i = 10; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i + 1); // TODO: remove +1 after fix
        const j = (i - 0) << 1;
        assert.deepEqual([(j / terminal.cols) | 0, j % terminal.cols], bufferIndex);
      }
    });
  });
  describe('BufferStringIterator', function(): void {
    it('iterator does not ovrflow buffer limits', function(): void {
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
