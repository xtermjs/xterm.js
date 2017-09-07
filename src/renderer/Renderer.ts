/**
 * @license MIT
 */

import { ITerminal, ITheme } from '../Interfaces';
import { CHAR_DATA_WIDTH_INDEX, CHAR_DATA_CHAR_INDEX } from '../Buffer';
import { BackgroundRenderLayer } from './BackgroundRenderLayer';
import { ForegroundRenderLayer } from './ForegroundRenderLayer';
import { SelectionRenderLayer } from './SelectionRenderLayer';
import { CursorRenderLayer } from './CursorRenderLayer';
import { ColorManager } from './ColorManager';
import { BaseRenderLayer } from './BaseRenderLayer';
import { IRenderLayer, IColorSet, IRenderer } from './Interfaces';
import { LinkRenderLayer } from './LinkRenderLayer';

export class Renderer implements IRenderer {
  /** A queue of the rows to be refreshed */
  private _refreshRowsQueue: {start: number, end: number}[] = [];
  private _refreshAnimationFrame = null;

  private _renderLayers: IRenderLayer[];
  private _devicePixelRatio: number;

  private _colorManager: ColorManager;

  constructor(private _terminal: ITerminal) {
    this._colorManager = new ColorManager();
    this._renderLayers = [
      new BackgroundRenderLayer(this._terminal.element, 0, this._colorManager.colors),
      new SelectionRenderLayer(this._terminal.element, 1, this._colorManager.colors),
      new ForegroundRenderLayer(this._terminal.element, 2, this._colorManager.colors),
      new LinkRenderLayer(this._terminal.element, 3, this._colorManager.colors, this._terminal),
      new CursorRenderLayer(this._terminal.element, 4, this._colorManager.colors)
    ];
    this._devicePixelRatio = window.devicePixelRatio;
  }

  public onWindowResize(devicePixelRatio: number): void {
    // If the device pixel ratio changed, the char atlas needs to be regenerated
    // and the terminal needs to refreshed
    if (this._devicePixelRatio !== devicePixelRatio) {
      this._devicePixelRatio = devicePixelRatio;
      this.onResize(this._terminal.cols, this._terminal.rows, true);
    }
  }

  public setTheme(theme: ITheme): IColorSet {
    this._colorManager.setTheme(theme);

    // Clear layers and force a full render
    this._renderLayers.forEach(l => {
      l.onThemeChanged(this._terminal, this._colorManager.colors);
      l.reset(this._terminal);
    });

    this._terminal.refresh(0, this._terminal.rows - 1);

    return this._colorManager.colors;
  }

  public onResize(cols: number, rows: number, didCharSizeChange: boolean): void {
    if (!this._terminal.charMeasure.width || !this._terminal.charMeasure.height) {
      return;
    }
    const width = this._terminal.charMeasure.width * cols;
    const height = Math.floor(this._terminal.charMeasure.height * this._terminal.options.lineHeight) * rows;
    // Resize all render layers
    this._renderLayers.forEach(l => l.resize(this._terminal, width, height, didCharSizeChange));
    // Force a refresh
    this._terminal.refresh(0, this._terminal.rows - 1);
  }

  public onCharSizeChanged(): void {
    this.onResize(this._terminal.cols, this._terminal.rows, true);
  }

  public onBlur(): void {
    this._renderLayers.forEach(l => l.onBlur(this._terminal));
  }

  public onFocus(): void {
    this._renderLayers.forEach(l => l.onFocus(this._terminal));
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
    start = Math.max(start, 0);
    end = Math.min(end, this._terminal.rows - 1);
    this._renderLayers.forEach(l => l.onGridChanged(this._terminal, start, end));
    this._terminal.emit('refresh', {start, end});
  }
}
