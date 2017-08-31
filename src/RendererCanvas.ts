/**
 * @license MIT
 */

import { ITerminal } from './Interfaces';
import { DomElementObjectPool } from './utils/DomElementObjectPool';
import { CHAR_DATA_WIDTH_INDEX, CHAR_DATA_CHAR_INDEX } from './Buffer';
import { createBackgroundFillData } from './renderer/Canvas';
import { IRenderLayer } from './renderer/Interfaces';
import { BackgroundRenderLayer } from './renderer/BackgroundRenderLayer';
import { ForegroundRenderLayer } from './renderer/ForegroundRenderLayer';

/**
 * The maximum number of refresh frames to skip when the write buffer is non-
 * empty. Note that these frames may be intermingled with frames that are
 * skipped via requestAnimationFrame's mechanism.
 */
const MAX_REFRESH_FRAME_SKIP = 5;

export class Renderer {
  /** A queue of the rows to be refreshed */
  private _refreshRowsQueue: {start: number, end: number}[] = [];
  private _refreshFramesSkipped = 0;
  private _refreshAnimationFrame = null;

  private _renderLayers: IRenderLayer[];

  constructor(private _terminal: ITerminal) {
    this._renderLayers = [
      new BackgroundRenderLayer(this._terminal.element),
      new ForegroundRenderLayer(this._terminal.element)
    ];
  }

  public onResize(cols: number, rows: number): void {
    const width = Math.ceil(this._terminal.charMeasure.width) * this._terminal.cols;
    const height = Math.ceil(this._terminal.charMeasure.height) * this._terminal.rows;
    for (let i = 0; i < this._renderLayers.length; i++) {
      this._renderLayers[i].resize(this._terminal, width, height, false);
    }
  }

  public onCharSizeChanged(charWidth: number, charHeight: number): void {
    const width = Math.ceil(charWidth) * this._terminal.cols;
    const height = Math.ceil(charHeight) * this._terminal.rows;
    for (let i = 0; i < this._renderLayers.length; i++) {
      this._renderLayers[i].resize(this._terminal, width, height, true);
    }
  }

  /**
   * Queues a refresh between two rows (inclusive), to be done on next animation
   * frame.
   * @param {number} start The start row.
   * @param {number} end The end row.
   */
  public queueRefresh(start: number, end: number): void {
    this._refreshRowsQueue.push({ start: start, end: end });
    if (!this._refreshAnimationFrame) {
      this._refreshAnimationFrame = window.requestAnimationFrame(this._refreshLoop.bind(this));
    }
  }

  /**
   * Performs the refresh loop callback, calling refresh only if a refresh is
   * necessary before queueing up the next one.
   */
  private _refreshLoop(): void {
    // Skip MAX_REFRESH_FRAME_SKIP frames if the writeBuffer is non-empty as it
    // will need to be immediately refreshed anyway. This saves a lot of
    // rendering time as the viewport DOM does not need to be refreshed, no
    // scroll events, no layouts, etc.
    const skipFrame = this._terminal.writeBuffer.length > 0 && this._refreshFramesSkipped++ <= MAX_REFRESH_FRAME_SKIP;
    if (skipFrame) {
      this._refreshAnimationFrame = window.requestAnimationFrame(this._refreshLoop.bind(this));
      return;
    }

    this._refreshFramesSkipped = 0;
    let start;
    let end;
    if (this._refreshRowsQueue.length > 4) {
      // Just do a full refresh when 5+ refreshes are queued
      start = 0;
      end = this._terminal.rows - 1;
    } else {
      // Get start and end rows that need refreshing
      start = this._refreshRowsQueue[0].start;
      end = this._refreshRowsQueue[0].end;
      for (let i = 1; i < this._refreshRowsQueue.length; i++) {
        if (this._refreshRowsQueue[i].start < start) {
          start = this._refreshRowsQueue[i].start;
        }
        if (this._refreshRowsQueue[i].end > end) {
          end = this._refreshRowsQueue[i].end;
        }
      }
    }
    this._refreshRowsQueue = [];
    this._refreshAnimationFrame = null;

    // Render
    for (let i = 0; i < this._renderLayers.length; i++) {
      this._renderLayers[i].render(this._terminal, start, end);
    }
    this._terminal.emit('refresh', {start, end});
  }

  /**
   * Refreshes the selection in the DOM.
   * @param start The selection start.
   * @param end The selection end.
   */
  public refreshSelection(start: [number, number], end: [number, number]): void {
    // Remove all selections
    while (this._terminal.selectionContainer.children.length) {
      this._terminal.selectionContainer.removeChild(this._terminal.selectionContainer.children[0]);
    }

    // Selection does not exist
    if (!start || !end) {
      return;
    }

    // Translate from buffer position to viewport position
    const viewportStartRow = start[1] - this._terminal.buffer.ydisp;
    const viewportEndRow = end[1] - this._terminal.buffer.ydisp;
    const viewportCappedStartRow = Math.max(viewportStartRow, 0);
    const viewportCappedEndRow = Math.min(viewportEndRow, this._terminal.rows - 1);

    // No need to draw the selection
    if (viewportCappedStartRow >= this._terminal.rows || viewportCappedEndRow < 0) {
      return;
    }

    // Create the selections
    const documentFragment = document.createDocumentFragment();
    // Draw first row
    const startCol = viewportStartRow === viewportCappedStartRow ? start[0] : 0;
    const endCol = viewportCappedStartRow === viewportCappedEndRow ? end[0] : this._terminal.cols;
    documentFragment.appendChild(this._createSelectionElement(viewportCappedStartRow, startCol, endCol));
    // Draw middle rows
    const middleRowsCount = viewportCappedEndRow - viewportCappedStartRow - 1;
    documentFragment.appendChild(this._createSelectionElement(viewportCappedStartRow + 1, 0, this._terminal.cols, middleRowsCount));
    // Draw final row
    if (viewportCappedStartRow !== viewportCappedEndRow) {
      // Only draw viewportEndRow if it's not the same as viewporttartRow
      const endCol = viewportEndRow === viewportCappedEndRow ? end[0] : this._terminal.cols;
      documentFragment.appendChild(this._createSelectionElement(viewportCappedEndRow, 0, endCol));
    }
    this._terminal.selectionContainer.appendChild(documentFragment);
  }

  /**
   * Creates a selection element at the specified position.
   * @param row The row of the selection.
   * @param colStart The start column.
   * @param colEnd The end columns.
   */
  private _createSelectionElement(row: number, colStart: number, colEnd: number, rowCount: number = 1): HTMLElement {
    const element = document.createElement('div');
    element.style.height = `${rowCount * this._terminal.charMeasure.height}px`;
    element.style.top = `${row * this._terminal.charMeasure.height}px`;
    element.style.left = `${colStart * this._terminal.charMeasure.width}px`;
    element.style.width = `${this._terminal.charMeasure.width * (colEnd - colStart)}px`;
    return element;
  }
}
