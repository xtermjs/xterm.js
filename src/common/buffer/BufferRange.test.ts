/**
 * Copyright (c) 2021 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { getRangeLength } from 'common/buffer/BufferRange';
import { IBufferRange } from 'xterm';

describe('BufferRange', () => {
  describe('getRangeLength', () => {
    it('should get range for single line', () => {
      assert.equal(getRangeLength(createRange(1, 1, 4, 1), 0), 3);
    });
    it('should throw for invalid range', () => {
      assert.throws(() => getRangeLength(createRange(1, 3, 1, 1), 0));
    });
    it('should get range multiple lines', () => {
      assert.equal(getRangeLength(createRange(1, 1, 4, 5), 5), 23);
    });
    it('should get range for end line right after start line', () => {
      assert.equal(getRangeLength(createRange(1, 1, 7, 2), 5), 11);
    });
  });
});

function createRange(x1: number, y1: number, x2: number, y2: number): IBufferRange {
  return {
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 }
  };
}
