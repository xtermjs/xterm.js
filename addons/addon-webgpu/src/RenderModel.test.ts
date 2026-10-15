/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { RenderModel } from './RenderModel';

describe('RenderModel scrolling', () => {
  for (const offset of [-3, -1, 1, 3]) {
    it(`rotates cell metadata without copying or clearing storage for offset ${offset}`, () => {
      const model = new RenderModel();
      model.resize(4, 5);
      for (let i = 0; i < 20; i++) {
        model.cells.set([i + 1, i + 101, i + 201, i + 301], i * 4);
        model.widths[i] = i % 3;
        model.combinedChars[i] = `combined-${i}`;
        model.lastBg[i] = i + 401;
      }
      for (let step = 1; step <= 12; step++) {
        model.scrollRows(offset, 5);
        for (let y = 0; y < 5; y++) {
          const sourceRow = ((y + step * offset) % 5 + 5) % 5;
          for (let x = 0; x < 4; x++) {
            const index = model.getRowOffset(y, 4, 5) + x;
            const source = sourceRow * 4 + x;
            assert.deepEqual(Array.from(model.cells.subarray(index * 4, index * 4 + 4)), [source + 1, source + 101, source + 201, source + 301]);
            assert.equal(model.widths[index], source % 3);
            assert.equal(model.combinedChars[index], `combined-${source}`);
            assert.equal(model.lastBg[index], source + 401);
          }
        }
      }
      model.clear();
      assert.equal(model.getRowOffset(0, 4, 5), 0);
      assert.isTrue(model.cells.every(value => value === 0));
      model.scrollRows(1, 5);
      model.resize(5, 6);
      assert.equal(model.getRowOffset(0, 5, 6), 0);
    });
  }
});
