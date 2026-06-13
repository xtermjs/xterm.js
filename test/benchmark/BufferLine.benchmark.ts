/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { perfContext, before, RuntimeCase } from 'xterm-benchmark';
import { BufferLine, DEFAULT_ATTR_DATA } from 'common/buffer/BufferLine';
import { BufferLineStringCache } from 'common/buffer/BufferLineStringCache';
import { CellData } from 'common/buffer/CellData';
import { BgFlags, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE, UnderlineStyle } from 'common/buffer/Constants';

const ITERATIONS = 500_000;
const stringCache = new BufferLineStringCache();
const nullCell = CellData.fromCharData([0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]);
const yCell = CellData.fromCharData([0, 'y', 1, 'y'.charCodeAt(0)]);

function fillPlainY(line: BufferLine, cols: number): void {
  for (let i = 0; i < cols; i++) {
    line.setCellFromCodepoint(i, 'y'.charCodeAt(0), 1, DEFAULT_ATTR_DATA);
  }
}

function setupScrollRecyclePair(cols: number): { recycled: BufferLine, blank: BufferLine } {
  const blank = new BufferLine(stringCache, cols, nullCell, false);
  const recycled = new BufferLine(stringCache, cols, yCell, false);
  fillPlainY(recycled, cols);
  return { recycled, blank };
}

/** Source line with combining chars and extended attrs spread across columns. */
function buildSparseSourceLine(cols: number): BufferLine {
  const line = new BufferLine(stringCache, cols, nullCell, false);
  for (let i = 0; i < cols; i++) {
    if (i % 10 === 0) {
      const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
      cell.extended.underlineStyle = UnderlineStyle.CURLY;
      cell.bg |= BgFlags.HAS_EXTENDED;
      line.setCell(i, cell);
    } else if (i % 17 === 0) {
      line.setCell(i, CellData.fromCharData([1, 'e\u0301', 1, '\u0301'.charCodeAt(0)]));
    } else {
      line.setCellFromCodepoint(i, 'y'.charCodeAt(0), 1, DEFAULT_ATTR_DATA);
    }
  }
  return line;
}

function setupCopyFromSparsePair(cols: number): { dest: BufferLine, src: BufferLine } {
  const src = buildSparseSourceLine(cols);
  const dest = new BufferLine(stringCache, cols, yCell, false);
  fillPlainY(dest, cols);
  return { dest, src };
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

perfContext('BufferLine.copyFrom (sparse source: combined + extended attrs)', () => {
  perfContext('cols=80', () => {
    let dest: BufferLine;
    let src: BufferLine;
    before(() => {
      ({ dest, src } = setupCopyFromSparsePair(80));
    });
    new RuntimeCase('', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        dest.copyFrom(src);
      }
      return { payloadSize: ITERATIONS };
    }, { fork: false }).showAverageRuntime();
  });

  perfContext('cols=279', () => {
    let dest: BufferLine;
    let src: BufferLine;
    before(() => {
      ({ dest, src } = setupCopyFromSparsePair(279));
    });
    new RuntimeCase('', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        dest.copyFrom(src);
      }
      return { payloadSize: ITERATIONS };
    }, { fork: false }).showAverageRuntime();
  });
});
