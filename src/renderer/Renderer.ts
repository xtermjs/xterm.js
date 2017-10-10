/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ITerminal, ITheme } from '../Interfaces';
import { CHAR_DATA_WIDTH_INDEX, CHAR_DATA_CHAR_INDEX } from '../Buffer';
import { TextRenderLayer } from './TextRenderLayer';
import { SelectionRenderLayer } from './SelectionRenderLayer';
import { CursorRenderLayer } from './CursorRenderLayer';
import { ColorManager } from './ColorManager';
import { BaseRenderLayer } from './BaseRenderLayer';
import { IRenderLayer, IColorSet, IRenderer, IRenderDimensions } from './Interfaces';
import { LinkRenderLayer } from './LinkRenderLayer';
import { EventEmitter } from '../EventEmitter';

export class Renderer extends EventEmitter implements IRenderer {
  /** A queue of the rows to be refreshed */
  private _refreshRowsQueue: {start: number, end: number}[] = [];
  private _refreshAnimationFrame = null;

  private _renderLayers: IRenderLayer[];
  private _devicePixelRatio: number;

  public colorManager: ColorManager;
  public dimensions: IRenderDimensions;

  constructor(private _terminal: ITerminal, theme: ITheme) {
    super();
    this.colorManager = new ColorManager();
    if (theme) {
      this.colorManager.setTheme(theme);
    }
    this._renderLayers = [
      new TextRenderLayer(this._terminal.element, 0, this.colorManager.colors),
      new SelectionRenderLayer(this._terminal.element, 1, this.colorManager.colors),
      new LinkRenderLayer(this._terminal.element, 2, this.colorManager.colors, this._terminal),
      new CursorRenderLayer(this._terminal.element, 3, this.colorManager.colors)
    ];
    this.dimensions = {
      scaledCharWidth: null,
      scaledCharHeight: null,
      scaledCellWidth: null,
      scaledCellHeight: null,
      scaledCharLeft: null,
      scaledCharTop: null,
      scaledCanvasWidth: null,
      scaledCanvasHeight: null,
      canvasWidth: null,
      canvasHeight: null,
      actualCellWidth: null,
      actualCellHeight: null
    };
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
    this.colorManager.setTheme(theme);

    // Clear layers and force a full render
    this._renderLayers.forEach(l => {
      l.onThemeChanged(this._terminal, this.colorManager.colors);
      l.reset(this._terminal);
    });

    this._terminal.refresh(0, this._terminal.rows - 1);

    return this.colorManager.colors;
  }

  public onResize(cols: number, rows: number, didCharSizeChange: boolean): void {
    if (!this._terminal.charMeasure.width || !this._terminal.charMeasure.height) {
      return;
    }

    // Calculate the scaled character width. Width is floored as it must be
    // drawn to an integer grid in order for the CharAtlas "stamps" to not be
    // blurry. When text is drawn to the grid not using the CharAtlas, it is
    // clipped to ensure there is no overlap with the next cell.
    this.dimensions.scaledCharWidth = Math.floor(this._terminal.charMeasure.width * window.devicePixelRatio);

    // Calculate the scaled character height. Height is ceiled in case
    // devicePixelRatio is a floating point number in order to ensure there is
    // enough space to draw the character to the cell.
    this.dimensions.scaledCharHeight = Math.ceil(this._terminal.charMeasure.height * window.devicePixelRatio);

    // Calculate the scaled cell height, if lineHeight is not 1 then the value
    // will be floored because since lineHeight can never be lower then 1, there
    // is a guarentee that the scaled line height will always be larger than
    // scaled char height.
    this.dimensions.scaledCellHeight = Math.floor(this.dimensions.scaledCharHeight * this._terminal.options.lineHeight);

    // Calculate the y coordinate within a cell that text should draw from in
    // order to draw in the center of a cell.
    this.dimensions.scaledCharTop = this._terminal.options.lineHeight === 1 ? 0 : Math.round((this.dimensions.scaledCellHeight - this.dimensions.scaledCharHeight) / 2);

    // Calculate the scaled cell width, taking the letterSpacing into account.
    this.dimensions.scaledCellWidth = this.dimensions.scaledCharWidth + Math.round(this._terminal.options.letterSpacing);

    // Calculate the x coordinate with a cell that text should draw from in
    // order to draw in the center of a cell.
    this.dimensions.scaledCharLeft = Math.floor(this._terminal.options.letterSpacing / 2);

    // Recalculate the canvas dimensions; scaled* define the actual number of
    // pixel in the canvas
    this.dimensions.scaledCanvasHeight = this._terminal.rows * this.dimensions.scaledCellHeight;
    this.dimensions.scaledCanvasWidth = this._terminal.cols * this.dimensions.scaledCellWidth;

    // The the size of the canvas on the page. It's very important that this
    // rounds to nearest integer and not ceils as browsers often set
    // window.devicePixelRatio as something like 1.100000023841858, when it's
    // actually 1.1. Ceiling causes blurriness as the backing canvas image is 1
    // pixel too large for the canvas element size.
    this.dimensions.canvasHeight = Math.round(this.dimensions.scaledCanvasHeight / window.devicePixelRatio);
    this.dimensions.canvasWidth = Math.round(this.dimensions.scaledCanvasWidth / window.devicePixelRatio);

    // Get the _actual_ dimensions of an individual cell. This needs to be
    // derived from the canvasWidth/Height calculated above which takes into
    // account window.devicePixelRatio. CharMeasure.width/height by itself is
    // insufficient when the page is not at 100% zoom level as CharMeasure is
    // measured in CSS pixels, but the actual char size on the canvas can
    // differ.
    this.dimensions.actualCellHeight = this.dimensions.canvasHeight / this._terminal.rows;
    this.dimensions.actualCellWidth = this.dimensions.canvasWidth / this._terminal.cols;

    // Resize all render layers
    this._renderLayers.forEach(l => l.resize(this._terminal, this.dimensions, didCharSizeChange));

    // Force a refresh
    this._terminal.refresh(0, this._terminal.rows - 1);

    this.emit('resize', {
      width: this.dimensions.canvasWidth,
      height: this.dimensions.canvasHeight
    });
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
