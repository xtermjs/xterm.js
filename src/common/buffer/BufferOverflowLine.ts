/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICellData } from 'common/Types';
import { BufferLine, IBufferLineStringCache } from 'common/buffer/BufferLine';

/**
 * A viewport row that is a view into a slice of a parent {@link BufferLine}'s logical storage.
 */
export class BufferOverflowLine extends BufferLine {
  public readonly head: BufferLine;
  public readonly segmentStart: number;

  constructor(
    head: BufferLine,
    segmentStart: number,
    stringCache: IBufferLineStringCache,
    cols: number,
    fillCellData: ICellData
  ) {
    super(stringCache, cols, fillCellData, true, head, segmentStart);
    this.head = head;
    this.segmentStart = segmentStart;
  }

  /**
   * Copies this row's segment into a standalone {@link BufferLine}.
   */
  public materializeToStandalone(fillCellData: ICellData): BufferLine {
    return this.materializeFromLogicalHead(fillCellData);
  }
}
