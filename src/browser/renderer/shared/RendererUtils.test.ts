/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { allowRescaling, computeNextVariantOffset } from './RendererUtils';
import { assert } from 'chai';

describe('RendererUtils', () => {
  it('computeNextVariantOffset', () => {
    const cellWidth = 11;
    const doubleCellWidth = 22;
    let line = 1;
    let variantOffset = 0;

    // should line 1
    // =,_,=_,=_,
    let cells = [cellWidth, cellWidth, doubleCellWidth, doubleCellWidth];
    let result = [1, 0, 0, 0];
    for (let index = 0; index < cells.length; index++) {
      const cell = cells[index];
      variantOffset = computeNextVariantOffset(cell, line, variantOffset);
      assert.equal(variantOffset, result[index]);
    }

    // should line 2
    // ==__==__==_,_==__==__==,__==__==__==__==__==__,==__==__==__==__==__==,
    line = 2;
    variantOffset = 0;
    cells = [cellWidth, cellWidth, doubleCellWidth, doubleCellWidth];
    result = [3, 2, 0, 2];
    for (let index = 0; index < cells.length; index++) {
      const cell = cells[index];
      variantOffset = computeNextVariantOffset(cell, line, variantOffset);
      assert.equal(variantOffset, result[index]);
    }

    // should line 3
    // ===___===__,_===___===_,__===___===___===___==,=___===___===___===___,
    line = 3;
    variantOffset = 0;
    cells = [cellWidth, cellWidth, doubleCellWidth, doubleCellWidth];
    result = [5, 4, 2, 0];
    for (let index = 0; index < cells.length; index++) {
      const cell = cells[index];
      variantOffset = computeNextVariantOffset(cell, line, variantOffset);
      assert.equal(variantOffset, result[index]);
    }
  });

  describe('allowRescaling', () => {
    it('should rescale a glyph that ends more than half way into the following cell', () => {
      assert.equal(allowRescaling(0x2228, 1, 11, 7, 1), true);
      assert.equal(allowRescaling(0x222A, 1, 12, 8, 1), true);
    });

    it('should not rescale a glyph that ends at most half way into the following cell', () => {
      assert.equal(allowRescaling(0x2228, 1, 11, 7, 0), false);
      assert.equal(allowRescaling(0x2228, 1, 10, 7, 1), false);
      assert.equal(allowRescaling(0x222A, 1, 11, 8, 1), false);
      assert.equal(allowRescaling(0x2228, 1, 11, 7, -1), false);
    });

    it('should rescale a glyph wider than 1.5 cells that starts left of the cell', () => {
      assert.equal(allowRescaling(0x2228, 1, 12, 7, -2), true);
    });

    it('should not rescale a glyph no wider than its cell that starts far into the cell', () => {
      assert.equal(allowRescaling(0x230C, 1, 5, 7, 13), false);
      assert.equal(allowRescaling(0x25E2, 1, 7, 7, 6), false);
    });

    it('should not rescale excluded glyphs that end more than half way into the following cell', () => {
      assert.equal(allowRescaling(0x41, 1, 11, 7, 1), false);
      assert.equal(allowRescaling(0x2228, 2, 11, 7, 1), false);
      assert.equal(allowRescaling(0x1F600, 1, 11, 7, 1), false);
      assert.equal(allowRescaling(0xE0B0, 1, 11, 7, 1), false);
      assert.equal(allowRescaling(0xF000, 1, 11, 7, 1), false);
    });

    it('should only add glyphs wider than their cell that end more than half way into the following cell', () => {
      for (let cellWidth = 1; cellWidth <= 24; cellWidth++) {
        for (let glyphSizeX = 1; glyphSizeX <= cellWidth * 3; glyphSizeX++) {
          for (let glyphLeft = -cellWidth; glyphLeft <= cellWidth * 2; glyphLeft++) {
            const rescaledBefore = glyphSizeX > Math.ceil(cellWidth * 1.5);
            const overlapIntoNextCell = glyphSizeX + glyphLeft - cellWidth;
            if (rescaledBefore || glyphSizeX <= cellWidth || overlapIntoNextCell <= cellWidth / 2) {
              assert.equal(allowRescaling(0x2228, 1, glyphSizeX, cellWidth, glyphLeft), rescaledBefore, `${glyphSizeX}px glyph at ${glyphLeft} in a ${cellWidth}px cell`);
            }
          }
        }
      }
    });
  });
});
