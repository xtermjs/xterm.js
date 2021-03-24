/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IRenderDimensions } from 'browser/renderer/Types';
import { BaseRenderLayer } from 'browser/renderer/BaseRenderLayer';
import { IColorSet } from 'browser/Types';
import { IBufferService, IOptionsService } from 'common/services/Services';

interface ISelectionState {
  start?: [number, number];
  end?: [number, number];
  columnSelectMode?: boolean;
  ydisp?: number;
  selectionStyle?: string;
}

export class SelectionRenderLayer extends BaseRenderLayer {
  private _state!: ISelectionState;

  constructor(
    container: HTMLElement,
    zIndex: number,
    colors: IColorSet,
    rendererId: number,
    bufferService: IBufferService,
    optionsService: IOptionsService
  ) {
    super(container, 'selection', zIndex, true, colors, rendererId, bufferService, optionsService);
    this._clearState();
  }

  private _clearState(): void {
    this._state = {
      start: undefined,
      end: undefined,
      columnSelectMode: undefined,
      ydisp: undefined,
      selectionStyle: undefined
    };
  }

  public resize(dim: IRenderDimensions): void {
    super.resize(dim);
    // Resizing the canvas discards the contents of the canvas so clear state
    this._clearState();
  }

  public reset(): void {
    if (this._state.start && this._state.end) {
      this._clearState();
      this._clearAll();
    }
  }

  public onSelectionChanged(start: [number, number] | undefined, end: [number, number] | undefined, columnSelectMode: boolean): void {
    const selectionStyle: string = this._optionsService.getOption('selectionStyle') || 'plain';

    // Selection has not changed
    if (!this._didStateChange(start, end, columnSelectMode, this._bufferService.buffer.ydisp, selectionStyle)) {
      return;
    }

    // Remove all selections
    this._clearAll();

    // Selection does not exist
    if (!start || !end) {
      this._clearState();
      return;
    }

    // Translate from buffer position to viewport position
    const viewportStartRow = start[1] - this._bufferService.buffer.ydisp;
    const viewportEndRow = end[1] - this._bufferService.buffer.ydisp;
    const viewportCappedStartRow = Math.max(viewportStartRow, 0);
    const viewportCappedEndRow = Math.min(viewportEndRow, this._bufferService.rows - 1);

    // No need to draw the selection
    if (viewportCappedStartRow >= this._bufferService.rows || viewportCappedEndRow < 0) {
      this._state.ydisp = this._bufferService.buffer.ydisp;
      return;
    }

    this._ctx.fillStyle = this._colors.selectionTransparent.css;
    this._ctx.strokeStyle = this._colors.cursor.css;

    if (columnSelectMode) {
      const startCol = start[0];
      const width = end[0] - startCol;
      const height = viewportCappedEndRow - viewportCappedStartRow + 1;
      this._fillCells(startCol, viewportCappedStartRow, width, height);
    } else {
      // Draw first row
      let startCol = viewportStartRow === viewportCappedStartRow ? start[0] : 0;
      let startRowEndCol = viewportCappedStartRow === viewportEndRow ? end[0] : this._bufferService.cols;
      switch (selectionStyle) {
        case 'mark-start':
          this._strokeRectAtCell(startCol, viewportCappedStartRow, 1, 1);
          startCol += 1;
          break;
        case 'mark-end':
          if (viewportCappedStartRow === viewportCappedEndRow) {
            this._strokeRectAtCell(startRowEndCol - 1, viewportCappedStartRow, 1, 1);
            startRowEndCol -= 1;
          }
          break;
      }
      if (startRowEndCol - startCol > 0) {
        this._fillCells(startCol, viewportCappedStartRow, startRowEndCol - startCol, 1);
      }

      // Draw middle rows
      const middleRowsCount = Math.max(viewportCappedEndRow - viewportCappedStartRow - 1, 0);
      this._fillCells(0, viewportCappedStartRow + 1, this._bufferService.cols, middleRowsCount);

      // Draw final row
      if (viewportCappedStartRow !== viewportCappedEndRow) {
        // Only draw viewportEndRow if it's not the same as viewportStartRow
        let endCol = viewportEndRow === viewportCappedEndRow ? end[0] : this._bufferService.cols;
        if (selectionStyle === 'mark-end') {
          this._strokeRectAtCell(endCol - 1, viewportCappedEndRow, 1, 1);
          endCol -= 1;
        }
        if (endCol > 0) {
          this._fillCells(0, viewportCappedEndRow, endCol, 1);
        }
      }
    }

    // Save state for next render
    this._state.start = [start[0], start[1]];
    this._state.end = [end[0], end[1]];
    this._state.columnSelectMode = columnSelectMode;
    this._state.ydisp = this._bufferService.buffer.ydisp;
    this._state.selectionStyle = selectionStyle;
  }

  private _didStateChange(start: [number, number] | undefined, end: [number, number] | undefined, columnSelectMode: boolean, ydisp: number, selectionStyle: string): boolean {
    return !this._areCoordinatesEqual(start, this._state.start) ||
      !this._areCoordinatesEqual(end, this._state.end) ||
      columnSelectMode !== this._state.columnSelectMode ||
      ydisp !== this._state.ydisp ||
      selectionStyle !== this._state.selectionStyle;
  }

  private _areCoordinatesEqual(coord1: [number, number] | undefined, coord2: [number, number] | undefined): boolean {
    if (!coord1 || !coord2) {
      return false;
    }

    return coord1[0] === coord2[0] && coord1[1] === coord2[1];
  }
}
