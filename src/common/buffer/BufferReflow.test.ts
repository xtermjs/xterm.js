/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { BufferLine } from 'common/buffer/BufferLine';
import { NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE } from 'common/buffer/Constants';
import { reflowSmallerGetNewLineLengths } from 'common/buffer/BufferReflow';

describe('BufferReflow', () => {
  describe('reflowSmallerGetNewLineLengths', () => {
    it('should return correct line lengths for a small line with wide characters', () => {
      const line = new BufferLine(4);
      line.set(0, [0, '汉', 2, '汉'.charCodeAt(0)]);
      line.set(1, [0, '', 0, 0]);
      line.set(2, [0, '语', 2, '语'.charCodeAt(0)]);
      line.set(3, [0, '', 0, 0]);
      assert.equal(line.translateToString(true), '汉语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 4, 3), [2, 2], 'line: 汉, 语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 4, 2), [2, 2], 'line: 汉, 语');
    });
    it('should return correct line lengths for a large line with wide characters', () => {
      const line = new BufferLine(12);
      for (let i = 0; i < 12; i += 4) {
        line.set(i, [0, '汉', 2, '汉'.charCodeAt(0)]);
        line.set(i + 2, [0, '语', 2, '语'.charCodeAt(0)]);
      }
      for (let i = 1; i < 12; i += 2) {
        line.set(i, [0, '', 0, 0]);
        line.set(i, [0, '', 0, 0]);
      }
      assert.equal(line.translateToString(), '汉语汉语汉语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 12, 11), [10, 2], 'line: 汉语汉语汉, 语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 12, 10), [10, 2], 'line: 汉语汉语汉, 语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 12, 9), [8, 4], 'line: 汉语汉语, 汉语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 12, 8), [8, 4], 'line: 汉语汉语, 汉语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 12, 7), [6, 6], 'line: 汉语汉, 语汉语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 12, 6), [6, 6], 'line: 汉语汉, 语汉语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 12, 5), [4, 4, 4], 'line: 汉语, 汉语, 汉语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 12, 4), [4, 4, 4], 'line: 汉语, 汉语, 汉语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 12, 3), [2, 2, 2, 2, 2, 2], 'line: 汉, 语, 汉, 语, 汉, 语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 12, 2), [2, 2, 2, 2, 2, 2], 'line: 汉, 语, 汉, 语, 汉, 语');
    });
    it('should return correct line lengths for a string with wide and single characters', () => {
      const line = new BufferLine(6);
      line.set(0, [0, 'a', 1, 'a'.charCodeAt(0)]);
      line.set(1, [0, '汉', 2, '汉'.charCodeAt(0)]);
      line.set(2, [0, '', 0, 0]);
      line.set(3, [0, '语', 2, '语'.charCodeAt(0)]);
      line.set(4, [0, '', 0, 0]);
      line.set(5, [0, 'b', 1, 'b'.charCodeAt(0)]);
      assert.equal(line.translateToString(), 'a汉语b');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 6, 5), [5, 1], 'line: a汉语b');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 6, 4), [3, 3], 'line: a汉, 语b');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 6, 3), [3, 3], 'line: a汉, 语b');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 6, 2), [1, 2, 2, 1], 'line: a, 汉, 语, b');
    });
    it('should return correct line lengths for a wrapped line with wide and single characters', () => {
      const line1 = new BufferLine(6);
      line1.set(0, [0, 'a', 1, 'a'.charCodeAt(0)]);
      line1.set(1, [0, '汉', 2, '汉'.charCodeAt(0)]);
      line1.set(2, [0, '', 0, 0]);
      line1.set(3, [0, '语', 2, '语'.charCodeAt(0)]);
      line1.set(4, [0, '', 0, 0]);
      line1.set(5, [0, 'b', 1, 'b'.charCodeAt(0)]);
      const line2 = new BufferLine(6, undefined, true);
      line2.set(0, [0, 'a', 1, 'a'.charCodeAt(0)]);
      line2.set(1, [0, '汉', 2, '汉'.charCodeAt(0)]);
      line2.set(2, [0, '', 0, 0]);
      line2.set(3, [0, '语', 2, '语'.charCodeAt(0)]);
      line2.set(4, [0, '', 0, 0]);
      line2.set(5, [0, 'b', 1, 'b'.charCodeAt(0)]);
      assert.equal(line1.translateToString(), 'a汉语b');
      assert.equal(line2.translateToString(), 'a汉语b');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line1, line2], 6, 5), [5, 4, 3], 'lines: a汉语, ba汉, 语b');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line1, line2], 6, 4), [3, 4, 4, 1], 'lines: a汉, 语ba, 汉语, b');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line1, line2], 6, 3), [3, 3, 3, 3], 'lines: a汉, 语b, a汉, 语b');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line1, line2], 6, 2), [1, 2, 2, 2, 2, 2, 1], 'lines: a, 汉, 语, ba, 汉, 语, b');
    });
    it('should work on lines ending in null space', () => {
      const line = new BufferLine(5);
      line.set(0, [0, '汉', 2, '汉'.charCodeAt(0)]);
      line.set(1, [0, '', 0, 0]);
      line.set(2, [0, '语', 2, '语'.charCodeAt(0)]);
      line.set(3, [0, '', 0, 0]);
      line.set(4, [0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]);
      assert.equal(line.translateToString(true), '汉语');
      assert.equal(line.translateToString(false), '汉语 ');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 4, 3), [2, 2], 'line: 汉, 语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 4, 2), [2, 2], 'line: 汉, 语');
    });
  });
});
