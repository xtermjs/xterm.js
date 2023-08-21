/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICursorRenderModel, IRenderModel } from './Types';
import { ISelectionRenderModel } from 'browser/renderer/shared/Types';
import { createSelectionRenderModel } from 'browser/renderer/shared/SelectionRenderModel';

export const RENDER_MODEL_INDICIES_PER_CELL = 4;
export const RENDER_MODEL_BG_OFFSET = 1;
export const RENDER_MODEL_FG_OFFSET = 2;
export const RENDER_MODEL_EXT_OFFSET = 3;

export const COMBINED_CHAR_BIT_MASK = 0x80000000;

export class RenderModel implements IRenderModel {
  public cells: Uint32Array;
  public lineLengths: Uint32Array;
  public selection: ISelectionRenderModel;
  public cursor?: ICursorRenderModel;

  constructor() {
    this.cells = new Uint32Array(0);
    this.lineLengths = new Uint32Array(0);
    this.selection = createSelectionRenderModel();
  }

  public resize(cols: number, rows: number): void {
    const indexCount = cols * rows * RENDER_MODEL_INDICIES_PER_CELL;
    if (indexCount !== this.cells.length) {
      this.cells = new Uint32Array(indexCount);
      this.lineLengths = new Uint32Array(rows);
    }
  }

  public clear(): void {
    this.cells.fill(0, 0);
    this.lineLengths.fill(0, 0);
  }
}
