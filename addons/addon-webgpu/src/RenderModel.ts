/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICursorRenderModel, IRenderModel } from './Types';
import { ISelectionRenderModel } from 'browser/renderer/shared/Types';
import { createSelectionRenderModel } from 'browser/renderer/shared/SelectionRenderModel';

export const enum RenderModelConstants {
  INDICIES_PER_CELL = 4,
  BG_OFFSET = 1,
  FG_OFFSET = 2,
  EXT_OFFSET = 3
}

export const COMBINED_CHAR_BIT_MASK = 0x80000000;

export class RenderModel implements IRenderModel {
  public cells: Uint32Array;
  public lineLengths: Uint32Array;
  public combinedChars: (string | undefined)[];
  public widths: Uint8Array;
  public lastBg: Uint32Array;
  private _rowOrigin = 0;
  public selection: ISelectionRenderModel;
  public cursor?: ICursorRenderModel;

  constructor() {
    this.cells = new Uint32Array(0);
    this.lineLengths = new Uint32Array(0);
    this.combinedChars = [];
    this.widths = new Uint8Array(0);
    this.lastBg = new Uint32Array(0);
    this.selection = createSelectionRenderModel();
  }

  public resize(cols: number, rows: number): void {
    this._rowOrigin = 0;
    const indexCount = cols * rows * RenderModelConstants.INDICIES_PER_CELL;
    if (indexCount !== this.cells.length) {
      this.cells = new Uint32Array(indexCount);
      this.lineLengths = new Uint32Array(rows);
      this.combinedChars = new Array(cols * rows);
      this.widths = new Uint8Array(cols * rows);
      this.lastBg = new Uint32Array(cols * rows);
    }
  }

  public clear(): void {
    this._rowOrigin = 0;
    this.cells.fill(0, 0);
    this.lineLengths.fill(0, 0);
    this.combinedChars.fill(undefined);
    this.widths.fill(0);
    this.lastBg.fill(0);
  }

  public getRowOffset(y: number, cols: number, rows: number): number {
    return ((y + this._rowOrigin) % rows) * cols;
  }

  /**
   * Keep CPU cells aligned with the GPU ring. Exposed rows retain their previous
   * physical contents until every cell is validated by _updateModel. This avoids
   * both copying retained rows and uploading unchanged blank cells in exposed rows.
   * lineLengths remains in logical order and is recomputed by that full update.
   */
  public scrollRows(offset: number, rows: number): void {
    this._rowOrigin = (this._rowOrigin + offset + rows) % rows;
  }
}
