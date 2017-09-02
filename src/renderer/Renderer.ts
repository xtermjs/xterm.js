/**
 * @license MIT
 */

import { ITerminal, ITheme } from '../Interfaces';
import { CHAR_DATA_WIDTH_INDEX, CHAR_DATA_CHAR_INDEX } from '../Buffer';
import { createBackgroundFillData } from './Canvas';
import { BackgroundRenderLayer } from './BackgroundRenderLayer';
import { ForegroundRenderLayer } from './ForegroundRenderLayer';
import { SelectionRenderLayer } from './SelectionRenderLayer';
import { CursorRenderLayer } from './CursorRenderLayer';
import { ColorManager } from './ColorManager';
import { BaseRenderLayer } from './BaseRenderLayer';
import { IRenderLayer } from './Interfaces';

export class Renderer {
  /** A queue of the rows to be refreshed */
  private _refreshRowsQueue: {start: number, end: number}[] = [];
  private _refreshAnimationFrame = null;

  private _renderLayers: IRenderLayer[];

  private _colorManager: ColorManager;

  constructor(private _terminal: ITerminal) {
    this._colorManager = new ColorManager();
    this._renderLayers = [
      new BackgroundRenderLayer(this._terminal.element, 0, this._colorManager.colors),
      new SelectionRenderLayer(this._terminal.element, 1, this._colorManager.colors),
      new ForegroundRenderLayer(this._terminal.element, 2, this._colorManager.colors),
      new CursorRenderLayer(this._terminal.element, 3, this._colorManager.colors)
    ];
  }

  public setTheme(theme: ITheme): void {
    console.log('setTheme');
    this._colorManager.setTheme(theme);
    // Clear layers and force a full render
    this._renderLayers.forEach(l => {
      l.onThemeChanged(this._terminal, this._colorManager.colors);
      l.reset(this._terminal);
    });

    // TODO: This is currently done for every single terminal, but it's static so it's wasting time
    this._terminal.refresh(0, this._terminal.rows - 1);
  }

  public onResize(cols: number, rows: number): void {
    const width = this._terminal.charMeasure.width * this._terminal.cols;
    const height = this._terminal.charMeasure.height * this._terminal.rows;
    this._renderLayers.forEach(l => l.resize(this._terminal, width, height, false));
  }

  public onCharSizeChanged(charWidth: number, charHeight: number): void {
    const width = charWidth * this._terminal.cols;
    const height = charHeight * this._terminal.rows;
    this._renderLayers.forEach(l => l.resize(this._terminal, width, height, true));
  }

  public onSelectionChanged(start: [number, number], end: [number, number]): void {
    this._renderLayers.forEach(l => l.onSelectionChanged(this._terminal, start, end));
  }

  public onCursorMove(): void {
    this._renderLayers.forEach(l => l.onCursorMove(this._terminal));
  }

  public onOptionsChanged(): void {
    this._renderLayers.forEach(l => l.onOptionsChanged(this._terminal));
  }

  public clear(): void {
    this._renderLayers.forEach(l => l.reset(this._terminal));
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
    this._renderLayers.forEach(l => l.onGridChanged(this._terminal, start, end));
    this._terminal.emit('refresh', {start, end});
  }
}
