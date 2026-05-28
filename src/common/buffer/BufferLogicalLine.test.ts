/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { BufferLine } from 'common/buffer/BufferLine';
import { BufferLineStringCache } from 'common/buffer/BufferLineStringCache';
import { attachWrappedRow } from 'common/buffer/BufferLineUtils';
import { BufferOverflowLine } from 'common/buffer/BufferOverflowLine';
import { CellData } from 'common/buffer/CellData';
import { NULL_CELL_CHAR, NULL_CELL_CODE, NULL_CELL_WIDTH } from 'common/buffer/Constants';
import { IBufferLine } from 'common/Types';

const TEST_STRING_CACHE = new BufferLineStringCache();
const NULL_CELL = CellData.fromCharData([0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]);

class LineList {
  private _lines: IBufferLine[] = [];
  public get(index: number): IBufferLine | undefined { return this._lines[index]; }
  public set(index: number, line: IBufferLine): void { this._lines[index] = line; }
  public get length(): number { return this._lines.length; }
}

describe('BufferLogicalLine', () => {
  it('should share storage across wrapped rows', () => {
    const cols = 5;
    const lines = new LineList();
    const head = new BufferLine(TEST_STRING_CACHE, cols, NULL_CELL, false);
    lines.set(0, head);
    for (let i = 0; i < cols; i++) {
      head.setCellFromCodepoint(i, 'a'.charCodeAt(0) + i, 1, NULL_CELL);
    }
    attachWrappedRow(lines, 1, TEST_STRING_CACHE, cols, NULL_CELL);
    const overflow = lines.get(1)!;
    assert.instanceOf(overflow, BufferOverflowLine);
    for (let i = 0; i < cols; i++) {
      (overflow as BufferLine).setCellFromCodepoint(i, 'f'.charCodeAt(0) + i, 1, NULL_CELL);
    }
    assert.equal(head.translateToString(true), 'abcde');
    assert.equal(overflow.translateToString(true), 'fghij');
    assert.equal(head.getLogicalTrimmedLength(), 10);
  });

  it('should reflow unwrap without copying when logical content fits', () => {
    const lines = new LineList();
    const head = new BufferLine(TEST_STRING_CACHE, 5, NULL_CELL, false);
    lines.set(0, head);
    for (let i = 0; i < 5; i++) {
      head.setCellFromCodepoint(i, 'f'.charCodeAt(0) + i, 1, NULL_CELL);
    }
    attachWrappedRow(lines, 1, TEST_STRING_CACHE, 2, NULL_CELL);
    const overflow = lines.get(1)! as BufferOverflowLine;
    for (let i = 0; i < 2; i++) {
      overflow.setCellFromCodepoint(i, 'k'.charCodeAt(0) + i, 1, NULL_CELL);
    }
    assert.equal(head.getLogicalTrimmedLength(), 7);
    assert.equal(overflow.translateToString(true), 'kl');
  });
});
