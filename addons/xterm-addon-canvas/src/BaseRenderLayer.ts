/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { removeElementFromParent } from 'browser/Dom';
import { acquireTextureAtlas } from 'browser/renderer/shared/CharAtlasCache';
import { TEXT_BASELINE } from 'browser/renderer/shared/Constants';
import { tryDrawCustomChar } from 'browser/renderer/shared/CustomGlyphs';
import { throwIfFalsy } from 'browser/renderer/shared/RendererUtils';
import { IRasterizedGlyph, IRenderDimensions, ISelectionRenderModel, ITextureAtlas } from 'browser/renderer/shared/Types';
import { createSelectionRenderModel } from 'browser/renderer/shared/SelectionRenderModel';
import { ICoreBrowserService } from 'browser/services/Services';
import { IColorSet } from 'browser/Types';
import { CellData } from 'common/buffer/CellData';
import { Attributes, BgFlags, FgFlags, WHITESPACE_CELL_CODE } from 'common/buffer/Constants';
import { IBufferService, IDecorationService, IOptionsService } from 'common/services/Services';
import { ICellData } from 'common/Types';
import { Terminal } from 'xterm';
import { IRenderLayer } from './Types';

// Work variables to avoid garbage collection
let $fg = 0;
let $bg = 0;
let $hasFg = false;
let $hasBg = false;
let $isSelected = false;

export abstract class BaseRenderLayer implements IRenderLayer {
  private _canvas: HTMLCanvasElement;
  protected _ctx!: CanvasRenderingContext2D;
  private _scaledCharWidth: number = 0;
  private _scaledCharHeight: number = 0;
  private _scaledCellWidth: number = 0;
  private _scaledCellHeight: number = 0;
  private _scaledCharLeft: number = 0;
  private _scaledCharTop: number = 0;

  protected _selectionStart: [number, number] | undefined;
  protected _selectionEnd: [number, number] | undefined;
  protected _columnSelectMode: boolean = false;
  protected _selectionModel: ISelectionRenderModel = createSelectionRenderModel();

  protected _charAtlas!: ITextureAtlas;

  public get canvas(): HTMLCanvasElement { return this._canvas; }
  public get cacheCanvas(): HTMLCanvasElement { return this._charAtlas?.cacheCanvas!; }

  constructor(
    private readonly _terminal: Terminal,
    private _container: HTMLElement,
    id: string,
    zIndex: number,
    private _alpha: boolean,
    protected _colors: IColorSet,
    protected readonly _bufferService: IBufferService,
    protected readonly _optionsService: IOptionsService,
    protected readonly _decorationService: IDecorationService,
    protected readonly _coreBrowserService: ICoreBrowserService
  ) {
    this._canvas = document.createElement('canvas');
    this._canvas.classList.add(`xterm-${id}-layer`);
    this._canvas.style.zIndex = zIndex.toString();
    this._initCanvas();
    this._container.appendChild(this._canvas);
    this._refreshCharAtlas(this._colors);
  }

  public dispose(): void {
    removeElementFromParent(this._canvas);
    this._charAtlas?.dispose();
  }

  private _initCanvas(): void {
    this._ctx = throwIfFalsy(this._canvas.getContext('2d', { alpha: this._alpha }));
    // Draw the background if this is an opaque layer
    if (!this._alpha) {
      this._clearAll();
    }
  }

  public onOptionsChanged(): void {}
  public onBlur(): void {}
  public onFocus(): void {}
  public onCursorMove(): void {}
  public onGridChanged(startRow: number, endRow: number): void {}

  public onSelectionChanged(start: [number, number] | undefined, end: [number, number] | undefined, columnSelectMode: boolean = false): void {
    // TODO: Remove these other variables in favor of the selection model
    this._selectionStart = start;
    this._selectionEnd = end;
    this._columnSelectMode = columnSelectMode;
    this._selectionModel.update(this._terminal, start, end, columnSelectMode);
  }

  public setColors(colorSet: IColorSet): void {
    this._refreshCharAtlas(colorSet);
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
    this._refreshCharAtlas(this._colors);
    this.onGridChanged(0, this._bufferService.rows - 1);
  }

  /**
   * Refreshes the char atlas, aquiring a new one if necessary.
   * @param colorSet The color set to use for the char atlas.
   */
  private _refreshCharAtlas(colorSet: IColorSet): void {
    if (this._scaledCharWidth <= 0 && this._scaledCharHeight <= 0) {
      return;
    }
    this._charAtlas = acquireTextureAtlas(this._terminal, colorSet, this._scaledCellWidth, this._scaledCellHeight, this._scaledCharWidth, this._scaledCharHeight, this._coreBrowserService.dpr);
    this._charAtlas.warmUp();
  }

  public resize(dim: IRenderDimensions): void {
    this._scaledCellWidth = dim.scaledCellWidth;
    this._scaledCellHeight = dim.scaledCellHeight;
    this._scaledCharWidth = dim.scaledCharWidth;
    this._scaledCharHeight = dim.scaledCharHeight;
    this._scaledCharLeft = dim.scaledCharLeft;
    this._scaledCharTop = dim.scaledCharTop;
    this._canvas.width = dim.scaledCanvasWidth;
    this._canvas.height = dim.scaledCanvasHeight;
    this._canvas.style.width = `${dim.canvasWidth}px`;
    this._canvas.style.height = `${dim.canvasHeight}px`;

    // Draw the background if this is an opaque layer
    if (!this._alpha) {
      this._clearAll();
    }

    this._refreshCharAtlas(this._colors);
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
      x * this._scaledCellWidth,
      y * this._scaledCellHeight,
      width * this._scaledCellWidth,
      height * this._scaledCellHeight);
  }

  /**
     * Fills a 1px line (2px on HDPI) at the middle of the cell. This uses the
     * existing fillStyle on the context.
     * @param x The column to fill.
     * @param y The row to fill.
     */
  protected _fillMiddleLineAtCells(x: number, y: number, width: number = 1): void {
    const cellOffset = Math.ceil(this._scaledCellHeight * 0.5);
    this._ctx.fillRect(
      x * this._scaledCellWidth,
      (y + 1) * this._scaledCellHeight - cellOffset - this._coreBrowserService.dpr,
      width * this._scaledCellWidth,
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
      x * this._scaledCellWidth,
      (y + 1) * this._scaledCellHeight + pixelOffset - this._coreBrowserService.dpr - 1 /* Ensure it's drawn within the cell */,
      width * this._scaledCellWidth,
      this._coreBrowserService.dpr);
  }

  protected _curlyUnderlineAtCell(x: number, y: number, width: number = 1): void {
    this._ctx.save();
    this._ctx.beginPath();
    this._ctx.strokeStyle = this._ctx.fillStyle;
    const lineWidth = this._coreBrowserService.dpr;
    this._ctx.lineWidth = lineWidth;
    for (let xOffset = 0; xOffset < width; xOffset++) {
      const xLeft = (x + xOffset) * this._scaledCellWidth;
      const xMid = (x + xOffset + 0.5) * this._scaledCellWidth;
      const xRight = (x + xOffset + 1) * this._scaledCellWidth;
      const yMid = (y + 1) * this._scaledCellHeight - lineWidth - 1;
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
    const xLeft = x * this._scaledCellWidth;
    const yMid = (y + 1) * this._scaledCellHeight - lineWidth - 1;
    this._ctx.moveTo(xLeft, yMid);
    for (let xOffset = 0; xOffset < width; xOffset++) {
      // const xLeft = x * this._scaledCellWidth;
      const xRight = (x + width + xOffset) * this._scaledCellWidth;
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
    const xLeft = x * this._scaledCellWidth;
    const xRight = (x + width) * this._scaledCellWidth;
    const yMid = (y + 1) * this._scaledCellHeight - lineWidth - 1;
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
      x * this._scaledCellWidth,
      y * this._scaledCellHeight,
      this._coreBrowserService.dpr * width,
      this._scaledCellHeight);
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
      x * this._scaledCellWidth + lineWidth / 2,
      y * this._scaledCellHeight + (lineWidth / 2),
      width * this._scaledCellWidth - lineWidth,
      (height * this._scaledCellHeight) - lineWidth);
  }

  /**
   * Clears the entire canvas.
   */
  protected _clearAll(): void {
    if (this._alpha) {
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    } else {
      this._ctx.fillStyle = this._colors.background.css;
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
        x * this._scaledCellWidth,
        y * this._scaledCellHeight,
        width * this._scaledCellWidth,
        height * this._scaledCellHeight);
    } else {
      this._ctx.fillStyle = this._colors.background.css;
      this._ctx.fillRect(
        x * this._scaledCellWidth,
        y * this._scaledCellHeight,
        width * this._scaledCellWidth,
        height * this._scaledCellHeight);
    }
  }

  /**
   * Draws a truecolor character at the cell. The character will be clipped to
   * ensure that it fits with the cell, including the cell to the right if it's
   * a wide character. This uses the existing fillStyle on the context.
   * @param cell The cell data for the character to draw.
   * @param x The column to draw at.
   * @param y The row to draw at.
   * @param color The color of the character.
   */
  protected _fillCharTrueColor(cell: CellData, x: number, y: number): void {
    this._ctx.font = this._getFont(false, false);
    this._ctx.textBaseline = TEXT_BASELINE;
    this._clipRow(y);

    // Draw custom characters if applicable
    let drawSuccess = false;
    if (this._optionsService.rawOptions.customGlyphs !== false) {
      drawSuccess = tryDrawCustomChar(this._ctx, cell.getChars(), x * this._scaledCellWidth, y * this._scaledCellHeight, this._scaledCellWidth, this._scaledCellHeight, this._optionsService.rawOptions.fontSize, this._coreBrowserService.dpr);
    }

    // Draw the character
    if (!drawSuccess) {
      this._ctx.fillText(
        cell.getChars(),
        x * this._scaledCellWidth + this._scaledCharLeft,
        y * this._scaledCellHeight + this._scaledCharTop + this._scaledCharHeight);
    }
  }

  private _workColors: { fg: number, bg: number, ext: number } = { fg: 0, bg: 0, ext: 0 };

  /**
   * Draws one or more characters at a cell. If possible this will draw using
   * the character atlas to reduce draw time.
   */
  protected _drawChars(cell: ICellData, x: number, y: number): void {
    const chars = cell.getChars();
    this._loadColorsForCell(x, y, cell, this._workColors);
    let glyph: IRasterizedGlyph;
    if (chars && chars.length > 1) {
      glyph = this._charAtlas.getRasterizedGlyphCombinedChar(chars, this._workColors.bg, this._workColors.fg, this._workColors.ext);
    } else {
      glyph = this._charAtlas.getRasterizedGlyph(cell.getCode() || WHITESPACE_CELL_CODE, this._workColors.bg, this._workColors.fg, this._workColors.ext);
    }
    this._ctx.save();
    this._clipRow(y);
    this._ctx.drawImage(
      this._charAtlas!.cacheCanvas,
      glyph.texturePosition.x,
      glyph.texturePosition.y,
      glyph.size.x,
      glyph.size.y,
      x * this._scaledCellWidth - glyph.offset.x,
      y * this._scaledCellHeight - glyph.offset.y,
      glyph.size.x,
      glyph.size.y
    );
    this._ctx.restore();
    // TODO: Move both renderers to use shared load color code
  }

  /**
   * Loads colors for the cell into the work colors object. This resolves overrides/inverse if
   * necessary which is why the work cell object is not used.
   */
  private _loadColorsForCell(x: number, y: number, cell: ICellData, workColors: { fg: number, bg: number, ext: number }): void {
    workColors.bg = cell.bg;
    workColors.fg = cell.fg;
    workColors.ext = cell.bg & BgFlags.HAS_EXTENDED ? cell.extended.ext : 0;
    // Get any foreground/background overrides, this happens on the model to avoid spreading
    // override logic throughout the different sub-renderers

    // Reset overrides work variables
    $bg = 0;
    $fg = 0;
    $hasBg = false;
    $hasFg = false;
    $isSelected = false;

    // Apply decorations on the bottom layer
    this._decorationService.forEachDecorationAtCell(x, y, 'bottom', d => {
      if (d.backgroundColorRGB) {
        $bg = d.backgroundColorRGB.rgba >> 8 & 0xFFFFFF;
        $hasBg = true;
      }
      if (d.foregroundColorRGB) {
        $fg = d.foregroundColorRGB.rgba >> 8 & 0xFFFFFF;
        $hasFg = true;
      }
    });

    // Apply the selection color if needed
    $isSelected = this._selectionModel.isCellSelected(this._terminal, x, y);
    if ($isSelected) {
      $bg = (this._coreBrowserService.isFocused ? this._colors.selectionBackgroundOpaque : this._colors.selectionInactiveBackgroundOpaque).rgba >> 8 & 0xFFFFFF;
      $hasBg = true;
      if (this._colors.selectionForeground) {
        $fg = this._colors.selectionForeground.rgba >> 8 & 0xFFFFFF;
        $hasFg = true;
      }
    }

    // Apply decorations on the top layer
    this._decorationService.forEachDecorationAtCell(x, y, 'top', d => {
      if (d.backgroundColorRGB) {
        $bg = d.backgroundColorRGB.rgba >> 8 & 0xFFFFFF;
        $hasBg = true;
      }
      if (d.foregroundColorRGB) {
        $fg = d.foregroundColorRGB.rgba >> 8 & 0xFFFFFF;
        $hasFg = true;
      }
    });

    // Convert any overrides from rgba to the fg/bg packed format. This resolves the inverse flag
    // ahead of time in order to use the correct cache key
    if ($hasBg) {
      if ($isSelected) {
        // Non-RGB attributes from model + force non-dim + override + force RGB color mode
        $bg = (cell.bg & ~Attributes.RGB_MASK & ~BgFlags.DIM) | $bg | Attributes.CM_RGB;
      } else {
        // Non-RGB attributes from model + override + force RGB color mode
        $bg = (cell.bg & ~Attributes.RGB_MASK) | $bg | Attributes.CM_RGB;
      }
    }
    if ($hasFg) {
      // Non-RGB attributes from model + force disable inverse + override + force RGB color mode
      $fg = (cell.fg & ~Attributes.RGB_MASK & ~FgFlags.INVERSE) | $fg | Attributes.CM_RGB;
    }

    // Handle case where inverse was specified by only one of bg override or fg override was set,
    // resolving the other inverse color and setting the inverse flag if needed.
    if (workColors.fg & FgFlags.INVERSE) {
      if ($hasBg && !$hasFg) {
        // Resolve bg color type (default color has a different meaning in fg vs bg)
        if ((workColors.bg & Attributes.CM_MASK) === Attributes.CM_DEFAULT) {
          $fg = (workColors.fg & ~(Attributes.RGB_MASK | FgFlags.INVERSE | Attributes.CM_MASK)) | ((this._colors.background.rgba >> 8 & 0xFFFFFF) & Attributes.RGB_MASK) | Attributes.CM_RGB;
        } else {
          $fg = (workColors.fg & ~(Attributes.RGB_MASK | FgFlags.INVERSE | Attributes.CM_MASK)) | workColors.bg & (Attributes.RGB_MASK | Attributes.CM_MASK);
        }
        $hasFg = true;
      }
      if (!$hasBg && $hasFg) {
        // Resolve bg color type (default color has a different meaning in fg vs bg)
        if ((workColors.fg & Attributes.CM_MASK) === Attributes.CM_DEFAULT) {
          $bg = (workColors.bg & ~(Attributes.RGB_MASK | Attributes.CM_MASK)) | ((this._colors.foreground.rgba >> 8 & 0xFFFFFF) & Attributes.RGB_MASK) | Attributes.CM_RGB;
        } else {
          $bg = (workColors.bg & ~(Attributes.RGB_MASK | Attributes.CM_MASK)) | workColors.fg & (Attributes.RGB_MASK | Attributes.CM_MASK);
        }
        $hasBg = true;
      }
    }

    // Use the override if it exists
    workColors.bg = $hasBg ? $bg : workColors.bg;
    workColors.fg = $hasFg ? $fg : workColors.fg;
  }

  /**
   * Clips a row to ensure no pixels will be drawn outside the cells in the row.
   * @param y The row to clip.
   */
  private _clipRow(y: number): void {
    this._ctx.beginPath();
    this._ctx.rect(
      0,
      y * this._scaledCellHeight,
      this._bufferService.cols * this._scaledCellWidth,
      this._scaledCellHeight);
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

