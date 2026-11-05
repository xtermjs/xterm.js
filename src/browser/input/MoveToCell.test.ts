/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { IBufferService } from '../../common/services/Services';
import { MockBufferService, createCellData } from '../../common/TestUtils.test';
import { moveToCellSequence } from './MoveToCell';

describe('MoveToCell', () => {
  let bufferService: IBufferService;

  beforeEach(() => {
    bufferService = new MockBufferService(5, 5);
    bufferService.buffer.x = 3;
    bufferService.buffer.y = 3;
  });

  /**
   * Writes characters into a row, giving CJK ideographs and surrogate pairs 2
   * cells (a width 2 cell followed by a width 0 cell) and everything else 1.
   */
  function fillLine(y: number, chars: string[], isWrapped: boolean = false): void {
    const line = bufferService.buffer.lines.get(bufferService.buffer.ybase + y)!;
    line.isWrapped = isWrapped;
    let x = 0;
    for (const char of chars) {
      const width = /^[一-鿿\ud800-\udbff]/.test(char) ? 2 : 1;
      line.setCell(x++, createCellData(0, char, width));
      if (width === 2) {
        line.setCell(x++, createCellData(0, '', 0));
      }
    }
  }

  describe('normal buffer', () => {
    it('should use the right directional escape sequences', () => {
      assert.equal(moveToCellSequence(1, 3, bufferService, false), '\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(2, 3, bufferService, false), '\x1b[D');
      assert.equal(moveToCellSequence(4, 3, bufferService, false), '\x1b[C');
      assert.equal(moveToCellSequence(5, 3, bufferService, false), '\x1b[C\x1b[C');
    });
    it('should wrap around entire row instead of doing up and down when the Y value differs', () => {
      assert.equal(moveToCellSequence(1, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(2, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(3, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(4, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(5, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(1, 2, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(2, 2, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(3, 2, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(4, 2, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(5, 2, bufferService, false), '\x1b[D\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(1, 4, bufferService, false), '\x1b[C\x1b[C\x1b[C');
      assert.equal(moveToCellSequence(2, 4, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C');
      assert.equal(moveToCellSequence(3, 4, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C');
      assert.equal(moveToCellSequence(4, 4, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C');
      assert.equal(moveToCellSequence(5, 4, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C');
      assert.equal(moveToCellSequence(1, 5, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C');
      assert.equal(moveToCellSequence(2, 5, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C');
      assert.equal(moveToCellSequence(3, 5, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C');
      assert.equal(moveToCellSequence(4, 5, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C');
      assert.equal(moveToCellSequence(5, 5, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C');
    });
    it('should use the correct character for application cursor', () => {
      assert.equal(moveToCellSequence(3, 1, bufferService, true), '\x1bOD\x1bOD\x1bOD\x1bOD\x1bOD\x1bOD\x1bOD\x1bOD\x1bOD\x1bOD');
      assert.equal(moveToCellSequence(3, 2, bufferService, true), '\x1bOD\x1bOD\x1bOD\x1bOD\x1bOD');
      assert.equal(moveToCellSequence(2, 3, bufferService, true), '\x1bOD');
      assert.equal(moveToCellSequence(4, 3, bufferService, true), '\x1bOC');
      assert.equal(moveToCellSequence(3, 4, bufferService, true), '\x1bOC\x1bOC\x1bOC\x1bOC\x1bOC');
      assert.equal(moveToCellSequence(3, 5, bufferService, true), '\x1bOC\x1bOC\x1bOC\x1bOC\x1bOC\x1bOC\x1bOC\x1bOC\x1bOC\x1bOC');
    });

    describe('wide characters', () => {
      beforeEach(() => {
        bufferService = new MockBufferService(12, 5);
      });

      it('should move one character per wide character when moving left', () => {
        // a b c 中 文 d e f, cursor after f
        fillLine(1, ['a', 'b', 'c', '中', '文', 'd', 'e', 'f']);
        bufferService.buffer.x = 10;
        bufferService.buffer.y = 1;
        assert.equal(moveToCellSequence(7, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D');
        assert.equal(moveToCellSequence(5, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D');
        assert.equal(moveToCellSequence(3, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
        assert.equal(moveToCellSequence(0, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
      });
      it('should move one character per wide character when moving right', () => {
        fillLine(1, ['a', 'b', 'c', '中', '文', 'd', 'e', 'f']);
        bufferService.buffer.x = 0;
        bufferService.buffer.y = 1;
        assert.equal(moveToCellSequence(3, 1, bufferService, false), '\x1b[C\x1b[C\x1b[C');
        assert.equal(moveToCellSequence(5, 1, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C');
        assert.equal(moveToCellSequence(7, 1, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C');
        assert.equal(moveToCellSequence(10, 1, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C');
      });
      it('should treat the trailing cell of a wide character as the character itself', () => {
        fillLine(1, ['a', 'b', 'c', '中', '文', 'd', 'e', 'f']);
        bufferService.buffer.x = 10;
        bufferService.buffer.y = 1;
        assert.equal(moveToCellSequence(4, 1, bufferService, false), moveToCellSequence(3, 1, bufferService, false));
        assert.equal(moveToCellSequence(6, 1, bufferService, false), moveToCellSequence(5, 1, bufferService, false));
        bufferService.buffer.x = 0;
        assert.equal(moveToCellSequence(4, 1, bufferService, false), moveToCellSequence(3, 1, bufferService, false));
        assert.equal(moveToCellSequence(6, 1, bufferService, false), moveToCellSequence(5, 1, bufferService, false));
      });
      it('should count combining characters as a single character', () => {
        // a é 中 b, cursor after b
        fillLine(1, ['a', 'é', '中', 'b']);
        bufferService.buffer.x = 5;
        bufferService.buffer.y = 1;
        assert.equal(moveToCellSequence(1, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D');
        assert.equal(moveToCellSequence(0, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D');
      });
      it('should skip trailing cells of wide characters across wrapped rows', () => {
        bufferService = new MockBufferService(6, 5);
        // a b 中 文 | c d 中 e, cursor after e
        fillLine(1, ['a', 'b', '中', '文']);
        fillLine(2, ['c', 'd', '中', 'e'], true);
        bufferService.buffer.x = 5;
        bufferService.buffer.y = 2;
        assert.equal(moveToCellSequence(2, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
        assert.equal(moveToCellSequence(0, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
        bufferService.buffer.x = 0;
        bufferService.buffer.y = 1;
        assert.equal(moveToCellSequence(4, 2, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C');
      });
      it('should skip the unused last cell of a row when a wide character wrapped early', () => {
        bufferService = new MockBufferService(6, 5);
        // a b c d e _ | 中 f, cursor after f
        fillLine(1, ['a', 'b', 'c', 'd', 'e']);
        fillLine(2, ['中', 'f'], true);
        bufferService.buffer.x = 3;
        bufferService.buffer.y = 2;
        assert.equal(moveToCellSequence(2, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
        assert.equal(moveToCellSequence(4, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D');
        bufferService.buffer.x = 2;
        bufferService.buffer.y = 1;
        assert.equal(moveToCellSequence(2, 2, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C');
      });
      it('should not skip the last cell of a row when the next row is not wrapped', () => {
        bufferService = new MockBufferService(6, 5);
        fillLine(1, ['a', 'b', 'c', 'd', 'e']);
        fillLine(2, ['中', 'f']);
        bufferService.buffer.x = 3;
        bufferService.buffer.y = 2;
        assert.equal(moveToCellSequence(2, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
      });
    });
  });

  describe('alt buffer', () => {
    beforeEach(() => {
      bufferService.buffers.activateAltBuffer();
      bufferService.buffer.x = 3;
      bufferService.buffer.y = 3;
    });

    it('should move the cursor across rows', () => {
      assert.equal(moveToCellSequence(4, 4, bufferService, false), '\x1b[B\x1b[C');
    });

    describe('wide characters', () => {
      beforeEach(() => {
        bufferService = new MockBufferService(12, 5);
        bufferService.buffers.activateAltBuffer();
      });

      it('should move one character per wide character', () => {
        fillLine(1, ['a', 'b', 'c', '中', '文', 'd', 'e', 'f']);
        bufferService.buffer.x = 0;
        bufferService.buffer.y = 1;
        assert.equal(moveToCellSequence(3, 1, bufferService, false), '\x1b[C\x1b[C\x1b[C');
        assert.equal(moveToCellSequence(7, 1, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C');
        bufferService.buffer.x = 10;
        assert.equal(moveToCellSequence(7, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D');
        assert.equal(moveToCellSequence(3, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
      });
      it('should treat the trailing cell of a wide character as the character itself', () => {
        fillLine(1, ['a', 'b', 'c', '中', '文', 'd', 'e', 'f']);
        bufferService.buffer.x = 0;
        bufferService.buffer.y = 1;
        assert.equal(moveToCellSequence(4, 1, bufferService, false), '\x1b[C\x1b[C\x1b[C');
        assert.equal(moveToCellSequence(6, 1, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C');
      });
      it('should count a surrogate pair as a single character', () => {
        fillLine(1, ['a', '😀', 'b']);
        bufferService.buffer.x = 0;
        bufferService.buffer.y = 1;
        assert.equal(moveToCellSequence(3, 1, bufferService, false), '\x1b[C\x1b[C');
      });
    });
  });
});
