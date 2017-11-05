/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IColorSet, IRenderDimensions } from './Interfaces';
import { IBuffer, ICharMeasure, ITerminal } from '../Interfaces';
import { CHAR_DATA_ATTR_INDEX } from '../Buffer';
import { GridCache } from './GridCache';
import { FLAGS } from './Types';
import { BaseRenderLayer } from './BaseRenderLayer';

export class SelectionRenderLayer extends BaseRenderLayer {
  private _state: {start: [number, number], end: [number, number]};

  constructor(container: HTMLElement, zIndex: number, colors: IColorSet) {
    super(container, 'selection', zIndex, true, colors);
    this._state = {
      start: null,
      end: null
    };
  }

  public resize(terminal: ITerminal, dim: IRenderDimensions, charSizeChanged: boolean): void {
    super.resize(terminal, dim, charSizeChanged);
    // Resizing the canvas discards the contents of the canvas so clear state
    this._state = {
      start: null,
      end: null
    };
  }

  public reset(terminal: ITerminal): void {
    if (this._state.start && this._state.end) {
      this._state = {
        start: null,
        end: null
      };
      this.clearAll();
    }
  }

  public onSelectionChanged(terminal: ITerminal, start: [number, number], end: [number, number]): void {
    // Selection has not changed
    if (this._state.start === start || this._state.end === end) {
      return;
    }

    // Remove all selections
    this.clearAll();

    // Selection does not exist
    if (!start || !end) {
      return;
    }

    // Translate from buffer position to viewport position
    const viewportStartRow = start[1] - terminal.buffer.ydisp;
    const viewportEndRow = end[1] - terminal.buffer.ydisp;
    const viewportCappedStartRow = Math.max(viewportStartRow, 0);
    const viewportCappedEndRow = Math.min(viewportEndRow, terminal.rows - 1);

    // No need to draw the selection
    if (viewportCappedStartRow >= terminal.rows || viewportCappedEndRow < 0) {
      return;
    }

    // Draw first row
    const startCol = viewportStartRow === viewportCappedStartRow ? start[0] : 0;
    const startRowEndCol = viewportCappedStartRow === viewportCappedEndRow ? end[0] : terminal.cols;
    this._ctx.fillStyle = this._colors.selection;
    this.fillCells(startCol, viewportCappedStartRow, startRowEndCol - startCol, 1);

    // Draw middle rows
    const middleRowsCount = Math.max(viewportCappedEndRow - viewportCappedStartRow - 1, 0);
    this.fillCells(0, viewportCappedStartRow + 1, terminal.cols, middleRowsCount);

    // Draw final row
    if (viewportCappedStartRow !== viewportCappedEndRow) {
      // Only draw viewportEndRow if it's not the same as viewportStartRow
      const endCol = viewportEndRow === viewportCappedEndRow ? end[0] : terminal.cols;
      this.fillCells(0, viewportCappedEndRow, endCol, 1);
    }

    // Save state for next render
    this._state.start = [start[0], start[1]];
    this._state.end = [end[0], end[1]];
  }
}
