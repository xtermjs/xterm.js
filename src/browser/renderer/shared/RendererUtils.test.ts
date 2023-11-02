/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { computeNextVariantOffset } from 'browser/renderer/shared/RendererUtils';
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
    result = [3, 2, 0 ,2];
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
});
