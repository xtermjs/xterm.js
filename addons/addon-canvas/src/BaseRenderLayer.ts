/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ReadonlyColorSet } from 'browser/Types';
import { CellColorResolver } from 'browser/renderer/shared/CellColorResolver';
import { acquireTextureAtlas } from 'browser/renderer/shared/CharAtlasCache';
import { TEXT_BASELINE } from 'browser/renderer/shared/Constants';
import { tryDrawCustomChar } from 'browser/renderer/shared/CustomGlyphs';
import { allowRescaling, throwIfFalsy } from 'browser/renderer/shared/RendererUtils';
import { createSelectionRenderModel } from 'browser/renderer/shared/SelectionRenderModel';
import { IRasterizedGlyph, IRenderDimensions, ISelectionRenderModel, ITextureAtlas } from 'browser/renderer/shared/Types';
import { ICoreBrowserService, IThemeService } from 'browser/services/Services';
import { EventEmitter, forwardEvent } from 'common/EventEmitter';
import { Disposable, MutableDisposable, toDisposable } from 'common/Lifecycle';
import { isSafari } from 'common/Platform';
import { ICellData } from 'common/Types';
import { CellData } from 'common/buffer/CellData';
import { WHITESPACE_CELL_CODE } from 'common/buffer/Constants';
import { IBufferService, IDecorationService, IOptionsService } from 'common/services/Services';
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

  protected _selectionModel: ISelectionRenderModel = createSelectionRenderModel();
  private _cellColorResolver: CellColorResolver;
  private _bitmapGenerator: (BitmapGenerator | undefined)[] = [];

  protected _charAtlas!: ITextureAtlas;
  protected _charAtlasDisposable = this.register(new MutableDisposable());

  public get canvas(): HTMLCanvasElement { return this._canvas; }
  public get cacheCanvas(): HTMLCanvasElement { return this._charAtlas?.pages[0].canvas!; }

  private readonly _onAddTextureAtlasCanvas = this.register(new EventEmitter<HTMLCanvasElement>());
  public readonly onAddTextureAtlasCanvas = this._onAddTextureAtlasCanvas.event;

  constructor(
    private readonly _terminal: Terminal,
    private _container: HTMLElement,
    id: string,
    zIndex: number,
    private _alpha: boolean,
    protected readonly _themeService: IThemeService,
    protected readonly _bufferService: IBufferService,
    protected readonly _optionsService: IOptionsService,
    protected readonly _decorationService: IDecorationService,
    protected readonly _coreBrowserService: ICoreBrowserService
  ) {
    super();
    this._cellColorResolver = new CellColorResolver(this._terminal, this._optionsService, this._selectionModel, this._decorationService, this._coreBrowserService, this._themeService);
    this._canvas = this._coreBrowserService.mainDocument.createElement('canvas');
    this._canvas.classList.add(`xterm-${id}-layer`);
    this._canvas.style.zIndex = zIndex.toString();
    this._initCanvas();
    this._container.appendChild(this._canvas);
    this._refreshCharAtlas(this._themeService.colors);
    this.register(this._themeService.onChangeColors(e => {
      this._refreshCharAtlas(e);
      this.reset();
      // Trigger selection changed as it's handled separately to regular rendering
      this.handleSelectionChanged(this._selectionModel.selectionStart, this._selectionModel.selectionEnd, this._selectionModel.columnSelectMode);
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

  public handleBlur(): void {}
  public handleFocus(): void {}
  public handleCursorMove(): void {}
  public handleGridChanged(startRow: number, endRow: number): void {}

  public handleSelectionChanged(start: [number, number] | undefined, end: [number, number] | undefined, columnSelectMode: boolean = false): void {
    this._selectionModel.update((this._terminal as any)._core, start, end, columnSelectMode);
  }

  protected _setTransparency(alpha: boolean): void {
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
    this._refreshCharAtlas(this._themeService.colors);
    this.handleGridChanged(0, this._bufferService.rows - 1);
  }

  /**
   * Refreshes the char atlas, aquiring a new one if necessary.
   * @param colorSet The color set to use for the char atlas.
   */
  private _refreshCharAtlas(colorSet: ReadonlyColorSet): void {
    if (this._deviceCharWidth <= 0 && this._deviceCharHeight <= 0) {
      return;
    }
    this._charAtlas = acquireTextureAtlas(this._terminal, this._optionsService.rawOptions, colorSet, this._deviceCellWidth, this._deviceCellHeight, this._deviceCharWidth, this._deviceCharHeight, this._coreBrowserService.dpr);
    this._charAtlasDisposable.value = forwardEvent(this._charAtlas.onAddTextureAtlasCanvas, this._onAddTextureAtlasCanvas);
    this._charAtlas.warmUp();
    for (let i = 0; i < this._charAtlas.pages.length; i++) {
      this._bitmapGenerator[i] = new BitmapGenerator(this._charAtlas.pages[i].canvas);
    }
  }

  public resize(dim: IRenderDimensions): void {
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

    this._refreshCharAtlas(this._themeService.colors);
  }

  public abstract reset(): void;

  public clearTextureAtlas(): void {
    this._charAtlas?.clearTexture();
  }

  /**
   * Fills 1+ cells completely. This uses the existing fillStyle on the context.
   * @param x The column to start at.
   * @param y The row to start at
   * @param width The number of columns to fill.
   * @param height The number of rows to fill.
   */
  protected _fillCells(x: number, y: number, width: number, height: number): void {
    this._ctx.fillRect(
      x * this._deviceCellWidth,
      y * this._deviceCellHeight,
      width * this._deviceCellWidth,
      height * this._deviceCellHeight);
  }

  /**
   * Fills a 1px line (2px on HDPI) at the middle of the cell. This uses the
   * existing fillStyle on the context.
   * @param x The column to fill.
   * @param y The row to fill.
   */
  protected _fillMiddleLineAtCells(x: number, y: number, width: number = 1): void {
    const cellOffset = Math.ceil(this._deviceCellHeight * 0.5);
    this._ctx.fillRect(
      x * this._deviceCellWidth,
      (y + 1) * this._deviceCellHeight - cellOffset - this._coreBrowserService.dpr,
      width * this._deviceCellWidth,
      this._coreBrowserService.dpr);
  }

  /**
   * Fills a 1px line (2px on HDPI) at the bottom of the cell. This uses the
   * existing fillStyle on the context.
   * @param x The column to fill.
   * @param y The row to fill.
   */
  protected _fillBottomLineAtCells(x: number, y: number, width: number = 1, pixelOffset: number = 0): void {
    this._ctx.fillRect(
      x * this._deviceCellWidth,
      (y + 1) * this._deviceCellHeight + pixelOffset - this._coreBrowserService.dpr - 1 /* Ensure it's drawn within the cell */,
      width * this._deviceCellWidth,
      this._coreBrowserService.dpr);
  }

  protected _curlyUnderlineAtCell(x: number, y: number, width: number = 1): void {
    this._ctx.save();
    this._ctx.beginPath();
    this._ctx.strokeStyle = this._ctx.fillStyle;
    const lineWidth = this._coreBrowserService.dpr;
    this._ctx.lineWidth = lineWidth;
    for (let xOffset = 0; xOffset < width; xOffset++) {
      const xLeft = (x + xOffset) * this._deviceCellWidth;
      const xMid = (x + xOffset + 0.5) * this._deviceCellWidth;
      const xRight = (x + xOffset + 1) * this._deviceCellWidth;
      const yMid = (y + 1) * this._deviceCellHeight - lineWidth - 1;
      const yMidBot = yMid - lineWidth;
      const yMidTop = yMid + lineWidth;
      this._ctx.moveTo(xLeft, yMid);
      this._ctx.bezierCurveTo(
        xLeft, yMidBot,
        xMid, yMidBot,
        xMid, yMid
      );
      this._ctx.bezierCurveTo(
        xMid, yMidTop,
        xRight, yMidTop,
        xRight, yMid
      );
    }
    this._ctx.stroke();
    this._ctx.restore();
  }

  protected _dottedUnderlineAtCell(x: number, y: number, width: number = 1): void {
    this._ctx.save();
    this._ctx.beginPath();
    this._ctx.strokeStyle = this._ctx.fillStyle;
    const lineWidth = this._coreBrowserService.dpr;
    this._ctx.lineWidth = lineWidth;
    this._ctx.setLineDash([lineWidth * 2, lineWidth]);
    const xLeft = x * this._deviceCellWidth;
    const yMid = (y + 1) * this._deviceCellHeight - lineWidth - 1;
    this._ctx.moveTo(xLeft, yMid);
    for (let xOffset = 0; xOffset < width; xOffset++) {
      // const xLeft = x * this._deviceCellWidth;
      const xRight = (x + width + xOffset) * this._deviceCellWidth;
      this._ctx.lineTo(xRight, yMid);
    }
    this._ctx.stroke();
    this._ctx.closePath();
    this._ctx.restore();
  }

  protected _dashedUnderlineAtCell(x: number, y: number, width: number = 1): void {
    this._ctx.save();
    this._ctx.beginPath();
    this._ctx.strokeStyle = this._ctx.fillStyle;
    const lineWidth = this._coreBrowserService.dpr;
    this._ctx.lineWidth = lineWidth;
    this._ctx.setLineDash([lineWidth * 4, lineWidth * 3]);
    const xLeft = x * this._deviceCellWidth;
    const xRight = (x + width) * this._deviceCellWidth;
    const yMid = (y + 1) * this._deviceCellHeight - lineWidth - 1;
    this._ctx.moveTo(xLeft, yMid);
    this._ctx.lineTo(xRight, yMid);
    this._ctx.stroke();
    this._ctx.closePath();
    this._ctx.restore();
  }

  /**
   * Fills a 1px line (2px on HDPI) at the left of the cell. This uses the
   * existing fillStyle on the context.
   * @param x The column to fill.
   * @param y The row to fill.
   */
  protected _fillLeftLineAtCell(x: number, y: number, width: number): void {
    this._ctx.fillRect(
      x * this._deviceCellWidth,
      y * this._deviceCellHeight,
      this._coreBrowserService.dpr * width,
      this._deviceCellHeight);
  }

  /**
   * Strokes a 1px rectangle (2px on HDPI) around a cell. This uses the existing
   * strokeStyle on the context.
   * @param x The column to fill.
   * @param y The row to fill.
   */
  protected _strokeRectAtCell(x: number, y: number, width: number, height: number): void {
    const lineWidth = this._coreBrowserService.dpr;
    this._ctx.lineWidth = lineWidth;
    this._ctx.strokeRect(
      x * this._deviceCellWidth + lineWidth / 2,
      y * this._deviceCellHeight + (lineWidth / 2),
      width * this._deviceCellWidth - lineWidth,
      (height * this._deviceCellHeight) - lineWidth);
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
   * @param cell The cell data for the character to draw.
   * @param x The column to draw at.
   * @param y The row to draw at.
   */
  protected _fillCharTrueColor(cell: CellData, x: number, y: number): void {
    this._ctx.font = this._getFont(false, false);
    this._ctx.textBaseline = TEXT_BASELINE;
    this._clipRow(y);

    // Draw custom characters if applicable
    let drawSuccess = false;
    if (this._optionsService.rawOptions.customGlyphs !== false) {
      drawSuccess = tryDrawCustomChar(this._ctx, cell.getChars(), x * this._deviceCellWidth, y * this._deviceCellHeight, this._deviceCellWidth, this._deviceCellHeight, this._optionsService.rawOptions.fontSize, this._coreBrowserService.dpr);
    }

    // Draw the character
    if (!drawSuccess) {
      this._ctx.fillText(
        cell.getChars(),
        x * this._deviceCellWidth + this._deviceCharLeft,
        y * this._deviceCellHeight + this._deviceCharTop + this._deviceCharHeight);
    }
  }

  /**
   * Draws one or more characters at a cell. If possible this will draw using
   * the character atlas to reduce draw time.
   */
  protected _drawChars(cell: ICellData, x: number, y: number): void {
    const chars = cell.getChars();
    const code = cell.getCode();
    const width = cell.getWidth();
    this._cellColorResolver.resolve(cell, x, this._bufferService.buffer.ydisp + y, this._deviceCellWidth);

    if (!this._charAtlas) {
      return;
    }

    let glyph: IRasterizedGlyph;
    if (chars && chars.length > 1) {
      glyph = this._charAtlas.getRasterizedGlyphCombinedChar(chars, this._cellColorResolver.result.bg, this._cellColorResolver.result.fg, this._cellColorResolver.result.ext, true);
    } else {
      glyph = this._charAtlas.getRasterizedGlyph(cell.getCode() || WHITESPACE_CELL_CODE, this._cellColorResolver.result.bg, this._cellColorResolver.result.fg, this._cellColorResolver.result.ext, true);
    }
    if (!glyph.size.x || !glyph.size.y) {
      return;
    }
    this._ctx.save();
    this._clipRow(y);

    // Draw the image, use the bitmap if it's available

    // HACK: If the canvas doesn't match, delete the generator. It's not clear how this happens but
    // something is wrong with either the lifecycle of _bitmapGenerator or the page canvases are
    // swapped out unexpectedly
    if (this._bitmapGenerator[glyph.texturePage] && this._charAtlas.pages[glyph.texturePage].canvas !== this._bitmapGenerator[glyph.texturePage]!.canvas) {
      this._bitmapGenerator[glyph.texturePage]?.bitmap?.close();
      delete this._bitmapGenerator[glyph.texturePage];
    }

    if (this._charAtlas.pages[glyph.texturePage].version !== this._bitmapGenerator[glyph.texturePage]?.version) {
      if (!this._bitmapGenerator[glyph.texturePage]) {
        this._bitmapGenerator[glyph.texturePage] = new BitmapGenerator(this._charAtlas.pages[glyph.texturePage].canvas);
      }
      this._bitmapGenerator[glyph.texturePage]!.refresh();
      this._bitmapGenerator[glyph.texturePage]!.version = this._charAtlas.pages[glyph.texturePage].version;
    }

    // Reduce scale horizontally for wide glyphs printed in cells that would overlap with the
    // following cell (ie. the width is not 2).
    let renderWidth = glyph.size.x;
    if (this._optionsService.rawOptions.rescaleOverlappingGlyphs) {
      if (allowRescaling(code, width, glyph.size.x, this._deviceCellWidth)) {
        renderWidth = this._deviceCellWidth - 1; // - 1 to improve readability
      }
    }

    this._ctx.drawImage(
      this._bitmapGenerator[glyph.texturePage]?.bitmap || this._charAtlas!.pages[glyph.texturePage].canvas,
      glyph.texturePosition.x,
      glyph.texturePosition.y,
      glyph.size.x,
      glyph.size.y,
      x * this._deviceCellWidth + this._deviceCharLeft - glyph.offset.x,
      y * this._deviceCellHeight + this._deviceCharTop - glyph.offset.y,
      renderWidth,
      glyph.size.y
    );
    this._ctx.restore();
  }

  /**
   * Clips a row to ensure no pixels will be drawn outside the cells in the row.
   * @param y The row to clip.
   */
  private _clipRow(y: number): void {
    this._ctx.beginPath();
    this._ctx.rect(
      0,
      y * this._deviceCellHeight,
      this._bufferService.cols * this._deviceCellWidth,
      this._deviceCellHeight);
    this._ctx.clip();
  }

  /**
   * Gets the current font.
   * @param isBold If we should use the bold fontWeight.
   */
  protected _getFont(isBold: boolean, isItalic: boolean): string {
    const fontWeight = isBold ? this._optionsService.rawOptions.fontWeightBold : this._optionsService.rawOptions.fontWeight;
    const fontStyle = isItalic ? 'italic' : '';

    return `${fontStyle} ${fontWeight} ${this._optionsService.rawOptions.fontSize * this._coreBrowserService.dpr}px ${this._optionsService.rawOptions.fontFamily}`;
  }
}

/**
 * The number of milliseconds to wait before generating the ImageBitmap, this is to debounce/batch
 * the operation as window.createImageBitmap is asynchronous.
 */
const GLYPH_BITMAP_COMMIT_DELAY = 100;

const enum BitmapGeneratorState {
  IDLE = 0,
  GENERATING = 1,
  GENERATING_INVALID = 2
}

class BitmapGenerator {
  private _state: BitmapGeneratorState = BitmapGeneratorState.IDLE;
  private _commitTimeout: number | undefined = undefined;
  private _bitmap: ImageBitmap | undefined = undefined;
  public get bitmap(): ImageBitmap | undefined { return this._bitmap; }
  public version: number = -1;

  constructor(public readonly canvas: HTMLCanvasElement) {
  }

  public refresh(): void {
    // Clear the bitmap immediately as it's stale
    this._bitmap?.close();
    this._bitmap = undefined;
    // Disable ImageBitmaps on Safari because of https://bugs.webkit.org/show_bug.cgi?id=149990
    if (isSafari) {
      return;
    }
    if (this._commitTimeout === undefined) {
      this._commitTimeout = window.setTimeout(() => this._generate(), GLYPH_BITMAP_COMMIT_DELAY);
    }
    if (this._state === BitmapGeneratorState.GENERATING) {
      this._state = BitmapGeneratorState.GENERATING_INVALID;
    }
  }

  private _generate(): void {
    if (this._state === BitmapGeneratorState.IDLE) {
      this._bitmap?.close();
      this._bitmap = undefined;
      this._state = BitmapGeneratorState.GENERATING;
      window.createImageBitmap(this.canvas).then(bitmap => {
        if (this._state === BitmapGeneratorState.GENERATING_INVALID) {
          this.refresh();
        } else {
          this._bitmap = bitmap;
        }
        this._state = BitmapGeneratorState.IDLE;
      });
      if (this._commitTimeout) {
        this._commitTimeout = undefined;
      }
    }
  }
}
