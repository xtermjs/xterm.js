/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ReadonlyColorSet } from 'browser/Types';
import { acquireTextureAtlas } from 'browser/renderer/shared/CharAtlasCache';
import { TEXT_BASELINE } from 'browser/renderer/shared/Constants';
import { throwIfFalsy } from 'browser/renderer/shared/RendererUtils';
import { IRenderDimensions, ITextureAtlas } from 'browser/renderer/shared/Types';
import { ICoreBrowserService, IThemeService } from 'browser/services/Services';
import { Disposable, toDisposable } from 'common/Lifecycle';
import { CellData } from 'common/buffer/CellData';
import { IOptionsService } from 'common/services/Services';
import { Terminal } from '@xterm/xterm';
import { IRenderLayer } from './Types';

export abstract class BaseRenderLayer extends Disposable implements IRenderLayer {
  private _canvas: HTMLCanvasElement;
  protected _ctx!: CanvasRenderingContext2D;
  private _deviceCharWidth: number = 0;
  private _deviceCharHeight: number = 0;
  private _deviceCellWidth: number = 0;
  private _deviceCellHeight: number = 0;
  private _deviceCharLeft: number = 0;
  private _deviceCharTop: number = 0;

  protected _charAtlas: ITextureAtlas | undefined;

  constructor(
    terminal: Terminal,
    private _container: HTMLElement,
    id: string,
    zIndex: number,
    private _alpha: boolean,
    protected readonly _coreBrowserService: ICoreBrowserService,
    protected readonly _optionsService: IOptionsService,
    protected readonly _themeService: IThemeService
  ) {
    super();
    this._canvas = this._coreBrowserService.mainDocument.createElement('canvas');
    this._canvas.classList.add(`xterm-${id}-layer`);
    this._canvas.style.zIndex = zIndex.toString();
    this._initCanvas();
    this._container.appendChild(this._canvas);
    this.register(this._themeService.onChangeColors(e => {
      this._refreshCharAtlas(terminal, e);
      this.reset(terminal);
    }));
    this.register(toDisposable(() => {
      this._canvas.remove();
    }));
  }

  private _initCanvas(): void {
    this._ctx = throwIfFalsy(this._canvas.getContext('2d', { alpha: this._alpha }));
    // Draw the background if this is an opaque layer
    if (!this._alpha) {
      this._clearAll();
    }
  }

  public handleBlur(terminal: Terminal): void {}
  public handleFocus(terminal: Terminal): void {}
  public handleCursorMove(terminal: Terminal): void {}
  public handleGridChanged(terminal: Terminal, startRow: number, endRow: number): void {}
  public handleSelectionChanged(terminal: Terminal, start: [number, number] | undefined, end: [number, number] | undefined, columnSelectMode: boolean = false): void {}

  protected _setTransparency(terminal: Terminal, alpha: boolean): void {
    // Do nothing when alpha doesn't change
    if (alpha === this._alpha) {
      return;
    }

    // Create new canvas and replace old one
    const oldCanvas = this._canvas;
    this._alpha = alpha;
    // Cloning preserves properties
    this._canvas = this._canvas.cloneNode() as HTMLCanvasElement;
    this._initCanvas();
    this._container.replaceChild(this._canvas, oldCanvas);

    // Regenerate char atlas and force a full redraw
    this._refreshCharAtlas(terminal, this._themeService.colors);
    this.handleGridChanged(terminal, 0, terminal.rows - 1);
  }

  /**
   * Refreshes the char atlas, aquiring a new one if necessary.
   * @param terminal The terminal.
   * @param colorSet The color set to use for the char atlas.
   */
  private _refreshCharAtlas(terminal: Terminal, colorSet: ReadonlyColorSet): void {
    if (this._deviceCharWidth <= 0 && this._deviceCharHeight <= 0) {
      return;
    }
    this._charAtlas = acquireTextureAtlas(terminal, this._optionsService.rawOptions, colorSet, this._deviceCellWidth, this._deviceCellHeight, this._deviceCharWidth, this._deviceCharHeight, this._coreBrowserService.dpr);
    this._charAtlas.warmUp();
  }

  public resize(terminal: Terminal, dim: IRenderDimensions): void {
    this._deviceCellWidth = dim.device.cell.width;
    this._deviceCellHeight = dim.device.cell.height;
    this._deviceCharWidth = dim.device.char.width;
    this._deviceCharHeight = dim.device.char.height;
    this._deviceCharLeft = dim.device.char.left;
    this._deviceCharTop = dim.device.char.top;
    this._canvas.width = dim.device.canvas.width;
    this._canvas.height = dim.device.canvas.height;
    this._canvas.style.width = `${dim.css.canvas.width}px`;
    this._canvas.style.height = `${dim.css.canvas.height}px`;

    // Draw the background if this is an opaque layer
    if (!this._alpha) {
      this._clearAll();
    }

    this._refreshCharAtlas(terminal, this._themeService.colors);
  }

  public abstract reset(terminal: Terminal): void;

  /**
   * Fills a 1px line (2px on HDPI) at the bottom of the cell. This uses the
   * existing fillStyle on the context.
   * @param x The column to fill.
   * @param y The row to fill.
   */
  protected _fillBottomLineAtCells(x: number, y: number, width: number = 1): void {
    this._ctx.fillRect(
      x * this._deviceCellWidth,
      (y + 1) * this._deviceCellHeight - this._coreBrowserService.dpr - 1 /* Ensure it's drawn within the cell */,
      width * this._deviceCellWidth,
      this._coreBrowserService.dpr);
  }

  /**
   * Clears the entire canvas.
   */
  protected _clearAll(): void {
    if (this._alpha) {
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    } else {
      this._ctx.fillStyle = this._themeService.colors.background.css;
      this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
    }
  }

  /**
   * Clears 1+ cells completely.
   * @param x The column to start at.
   * @param y The row to start at.
   * @param width The number of columns to clear.
   * @param height The number of rows to clear.
   */
  protected _clearCells(x: number, y: number, width: number, height: number): void {
    if (this._alpha) {
      this._ctx.clearRect(
        x * this._deviceCellWidth,
        y * this._deviceCellHeight,
        width * this._deviceCellWidth,
        height * this._deviceCellHeight);
    } else {
      this._ctx.fillStyle = this._themeService.colors.background.css;
      this._ctx.fillRect(
        x * this._deviceCellWidth,
        y * this._deviceCellHeight,
        width * this._deviceCellWidth,
        height * this._deviceCellHeight);
    }
  }

  /**
   * Draws a truecolor character at the cell. The character will be clipped to
   * ensure that it fits with the cell, including the cell to the right if it's
   * a wide character. This uses the existing fillStyle on the context.
   * @param terminal The terminal.
   * @param cell The cell data for the character to draw.
   * @param x The column to draw at.
   * @param y The row to draw at.
   */
  protected _fillCharTrueColor(terminal: Terminal, cell: CellData, x: number, y: number): void {
    this._ctx.font = this._getFont(terminal, false, false);
    this._ctx.textBaseline = TEXT_BASELINE;
    this._clipCell(x, y, cell.getWidth());
    this._ctx.fillText(
      cell.getChars(),
      x * this._deviceCellWidth + this._deviceCharLeft,
      y * this._deviceCellHeight + this._deviceCharTop + this._deviceCharHeight);
  }

  /**
   * Clips a cell to ensure no pixels will be drawn outside of it.
   * @param x The column to clip.
   * @param y The row to clip.
   * @param width The number of columns to clip.
   */
  private _clipCell(x: number, y: number, width: number): void {
    this._ctx.beginPath();
    this._ctx.rect(
      x * this._deviceCellWidth,
      y * this._deviceCellHeight,
      width * this._deviceCellWidth,
      this._deviceCellHeight);
    this._ctx.clip();
  }

  /**
   * Gets the current font.
   * @param terminal The terminal.
   * @param isBold If we should use the bold fontWeight.
   */
  protected _getFont(terminal: Terminal, isBold: boolean, isItalic: boolean): string {
    const fontWeight = isBold ? terminal.options.fontWeightBold : terminal.options.fontWeight;
    const fontStyle = isItalic ? 'italic' : '';

    return `${fontStyle} ${fontWeight} ${terminal.options.fontSize! * this._coreBrowserService.dpr}px ${terminal.options.fontFamily}`;
  }
}

