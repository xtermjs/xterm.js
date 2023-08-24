import { computeVarinatOffset } from 'browser/renderer/shared/RendererUtils';
import { assert } from 'chai';

describe('RendererUtils', () => {
  it('computeVarinatOffset', () => {
    const cellWidth = 11;
    const doubleCellWidth = 22;
    let line = 1;
    let varinatOffset = 0;

    // should line 1
    // =,_,=_,=_,
    let cells = [cellWidth, cellWidth, doubleCellWidth, doubleCellWidth];
    let result = [1, 0, 0, 0];
    for (let index = 0; index < cells.length; index++) {
      const cell = cells[index];
      varinatOffset = computeVarinatOffset(cell, line, varinatOffset);
      assert.equal(varinatOffset, result[index]);
    }

    // should line 2
    // ==__==__==_,_==__==__==,__==__==__==__==__==__,==__==__==__==__==__==,
    line = 2;
    varinatOffset = 0;
    cells = [cellWidth, cellWidth, doubleCellWidth, doubleCellWidth];
    result = [3, 2, 0 ,2];
    for (let index = 0; index < cells.length; index++) {
      const cell = cells[index];
      varinatOffset = computeVarinatOffset(cell, line, varinatOffset);
      assert.equal(varinatOffset, result[index]);
    }

    // should line 3
    // ===___===__,_===___===_,__===___===___===___==,=___===___===___===___,
    line = 3;
    varinatOffset = 0;
    cells = [cellWidth, cellWidth, doubleCellWidth, doubleCellWidth];
    result = [5, 4, 2, 0];
    for (let index = 0; index < cells.length; index++) {
      const cell = cells[index];
      varinatOffset = computeVarinatOffset(cell, line, varinatOffset);
      assert.equal(varinatOffset, result[index]);
    }
  });
});
