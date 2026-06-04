/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { perfContext, before, RuntimeCase } from 'xterm-benchmark';
import { BufferLine } from 'common/buffer/BufferLine';
import { BufferLineStringCache } from 'common/buffer/BufferLineStringCache';
import { DEFAULT_ATTR_DATA } from 'common/buffer/BufferLine';
import { CellData } from 'common/buffer/CellData';
import { NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE } from 'common/buffer/Constants';

const ITERATIONS = 500_000;
const stringCache = new BufferLineStringCache();
const nullCell = CellData.fromCharData([0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]);
const yCell = CellData.fromCharData([0, 'y', 1, 'y'.charCodeAt(0)]);

function setupScrollRecyclePair(cols: number): { recycled: BufferLine; blank: BufferLine } {
  const blank = new BufferLine(stringCache, cols, nullCell, false);
  const recycled = new BufferLine(stringCache, cols, yCell, false);
  for (let i = 0; i < cols; i++) {
    recycled.setCellFromCodepoint(i, 'y'.charCodeAt(0), 1, DEFAULT_ATTR_DATA);
  }
  return { recycled, blank };
}

perfContext('BufferLine.copyFrom (scroll recycle)', () => {
  perfContext('cols=80', () => {
    let recycled: BufferLine;
    let blank: BufferLine;
    before(() => {
      ({ recycled, blank } = setupScrollRecyclePair(80));
    });
    new RuntimeCase('', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        recycled.copyFrom(blank);
      }
      return { payloadSize: ITERATIONS };
    }, { fork: false }).showAverageRuntime();
  });

  perfContext('cols=279', () => {
    let recycled: BufferLine;
    let blank: BufferLine;
    before(() => {
      ({ recycled, blank } = setupScrollRecyclePair(279));
    });
    new RuntimeCase('', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        recycled.copyFrom(blank);
      }
      return { payloadSize: ITERATIONS };
    }, { fork: false }).showAverageRuntime();
  });
});
