/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { ITerminal } from './Interfaces';
import { Buffer } from './Buffer';
import { CircularList } from './utils/CircularList';
import { MockTerminal } from './utils/TestUtils.test';

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
      const blankLineChar = terminal.blankLine()[0];
      buffer.fillViewportRows();
      assert.equal(buffer.lines.length, INIT_ROWS);
      for (let y = 0; y < INIT_ROWS; y++) {
        assert.equal(buffer.lines.get(y).length, INIT_COLS);
        for (let x = 0; x < INIT_COLS; x++) {
          assert.deepEqual(buffer.lines.get(y)[x], blankLineChar);
        }
      }
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
          buffer.lines.get(5)[0][1] = 'a';
          buffer.lines.get(INIT_ROWS - 1)[0][1] = 'b';
          buffer.resize(INIT_COLS, INIT_ROWS - 5);
          assert.equal(buffer.lines.get(0)[0][1], 'a');
          assert.equal(buffer.lines.get(INIT_ROWS - 1 - 5)[0][1], 'b');
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
            buffer.lines.push(terminal.blankLine());
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
            buffer.lines.push(terminal.blankLine());
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
});
