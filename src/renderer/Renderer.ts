/**
 * @license MIT
 */

import { ITerminal } from '../Interfaces';
import { DomElementObjectPool } from '../utils/DomElementObjectPool';
import { CHAR_DATA_WIDTH_INDEX, CHAR_DATA_CHAR_INDEX } from '../Buffer';
import { createBackgroundFillData } from './Canvas';
import { IDataRenderLayer, ISelectionRenderLayer } from './Interfaces';
import { BackgroundRenderLayer } from './BackgroundRenderLayer';
import { ForegroundRenderLayer } from './ForegroundRenderLayer';
import { SelectionRenderLayer } from './SelectionRenderLayer';
import { CursorRenderLayer } from './CursorRenderLayer';

export class Renderer {
  /** A queue of the rows to be refreshed */
  private _refreshRowsQueue: {start: number, end: number}[] = [];
  private _refreshAnimationFrame = null;

  private _dataRenderLayers: IDataRenderLayer[];
  private _selectionRenderLayers: ISelectionRenderLayer[];

  constructor(private _terminal: ITerminal) {
    this._dataRenderLayers = [
      new BackgroundRenderLayer(this._terminal.element, 0),
      new ForegroundRenderLayer(this._terminal.element, 2),
      new CursorRenderLayer(this._terminal.element, 3)
    ];
    this._selectionRenderLayers = [
      new SelectionRenderLayer(this._terminal.element, 1)
    ];
  }

  public onResize(cols: number, rows: number): void {
    const width = Math.ceil(this._terminal.charMeasure.width) * this._terminal.cols;
    const height = Math.ceil(this._terminal.charMeasure.height) * this._terminal.rows;
    for (let i = 0; i < this._dataRenderLayers.length; i++) {
      this._dataRenderLayers[i].resize(this._terminal, width, height, false);
    }
  }

  public onCharSizeChanged(charWidth: number, charHeight: number): void {
    console.log('Renderer.onCharSizeChanged', charWidth, charHeight);
    const width = Math.ceil(charWidth) * this._terminal.cols;
    const height = Math.ceil(charHeight) * this._terminal.rows;
    for (let i = 0; i < this._dataRenderLayers.length; i++) {
      this._dataRenderLayers[i].resize(this._terminal, width, height, true);
    }
    for (let i = 0; i < this._selectionRenderLayers.length; i++) {
      this._selectionRenderLayers[i].resize(this._terminal, width, height, true);
    }
  }

  public onSelectionChanged(start: [number, number], end: [number, number]): void {
    for (let i = 0; i < this._selectionRenderLayers.length; i++) {
      this._selectionRenderLayers[i].render(this._terminal, start, end);
    }
  }

  public clear(): void {
    for (let i = 0; i < this._dataRenderLayers.length; i++) {
      this._dataRenderLayers[i].reset(this._terminal);
    }
    for (let i = 0; i < this._selectionRenderLayers.length; i++) {
      this._selectionRenderLayers[i].reset(this._terminal);
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
    for (let i = 0; i < this._dataRenderLayers.length; i++) {
      this._dataRenderLayers[i].render(this._terminal, start, end);
    }
    this._terminal.emit('refresh', {start, end});
  }
}
