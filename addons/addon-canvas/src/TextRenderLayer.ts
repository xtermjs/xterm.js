/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IRenderDimensions } from 'browser/renderer/shared/Types';
import { JoinedCellData } from 'browser/services/CharacterJoinerService';
import { ICharacterJoinerService, ICoreBrowserService, IThemeService } from 'browser/services/Services';
import { CharData, ICellData } from 'common/Types';
import { AttributeData } from 'common/buffer/AttributeData';
import { CellData } from 'common/buffer/CellData';
import { Content, NULL_CELL_CODE } from 'common/buffer/Constants';
import { IBufferService, IDecorationService, IOptionsService } from 'common/services/Services';
import { Terminal } from '@xterm/xterm';
import { BaseRenderLayer } from './BaseRenderLayer';
import { GridCache } from './GridCache';

/**
 * This CharData looks like a null character, which will forc a clear and render
 * when the character changes (a regular space ' ' character may not as it's
 * drawn state is a cleared cell).
 */
// const OVERLAP_OWNED_CHAR_DATA: CharData = [null, '', 0, -1];

export class TextRenderLayer extends BaseRenderLayer {
  private _state: GridCache<CharData>;
  private _characterWidth: number = 0;
  private _characterFont: string = '';
  private _characterOverlapCache: { [key: string]: boolean } = {};
  private _workCell = new CellData();

  constructor(
    terminal: Terminal,
    container: HTMLElement,
    zIndex: number,
    alpha: boolean,
    bufferService: IBufferService,
    optionsService: IOptionsService,
    private readonly _characterJoinerService: ICharacterJoinerService,
    decorationService: IDecorationService,
    coreBrowserService: ICoreBrowserService,
    themeService: IThemeService
  ) {
    super(terminal, container, 'text', zIndex, alpha, themeService, bufferService, optionsService, decorationService, coreBrowserService);
    this._state = new GridCache<CharData>();
    this.register(optionsService.onSpecificOptionChange('allowTransparency', value => this._setTransparency(value)));
  }

  public resize(dim: IRenderDimensions): void {
    super.resize(dim);

    // Clear the character width cache if the font or width has changed
    const terminalFont = this._getFont(false, false);
    if (this._characterWidth !== dim.device.char.width || this._characterFont !== terminalFont) {
      this._characterWidth = dim.device.char.width;
      this._characterFont = terminalFont;
      this._characterOverlapCache = {};
    }
    // Resizing the canvas discards the contents of the canvas so clear state
    this._state.clear();
    this._state.resize(this._bufferService.cols, this._bufferService.rows);
  }

  public reset(): void {
    this._state.clear();
    this._clearAll();
  }

  private _forEachCell(
    firstRow: number,
    lastRow: number,
    callback: (
      cell: ICellData,
      x: number,
      y: number
    ) => void
  ): void {
    for (let y = firstRow; y <= lastRow; y++) {
      const row = y + this._bufferService.buffer.ydisp;
      const line = this._bufferService.buffer.lines.get(row);
      const joinedRanges = this._characterJoinerService.getJoinedCharacters(row);
      for (let x = 0; x < this._bufferService.cols; x++) {
        line!.loadCell(x, this._workCell);
        let cell = this._workCell;

        // If true, indicates that the current character(s) to draw were joined.
        let isJoined = false;
        let lastCharX = x;

        // The character to the left is a wide character, drawing is owned by
        // the char at x-1
        if (cell.getWidth() === 0) {
          continue;
        }

        // exit early for NULL and SP
        // NOTE: commented out due to #4120 (needs a more clever patch to keep things performant)
        // const code = cell.getCode();
        // if (code === 0 || code === 32) {
        //  continue;
        // }

        // Process any joined character ranges as needed. Because of how the
        // ranges are produced, we know that they are valid for the characters
        // and attributes of our input.
        if (joinedRanges.length > 0 && x === joinedRanges[0][0]) {
          isJoined = true;
          const range = joinedRanges.shift()!;

          // We already know the exact start and end column of the joined range,
          // so we get the string and width representing it directly
          cell = new JoinedCellData(
            this._workCell,
            line!.translateToString(true, range[0], range[1]),
            range[1] - range[0]
          );

          // Skip over the cells occupied by this range in the loop
          lastCharX = range[1] - 1;
        }

        // If the character is an overlapping char and the character to the
        // right is a space, take ownership of the cell to the right. We skip
        // this check for joined characters because their rendering likely won't
        // yield the same result as rendering the last character individually.
        if (!isJoined && this._isOverlapping(cell)) {
          // If the character is overlapping, we want to force a re-render on every
          // frame. This is specifically to work around the case where two
          // overlaping chars `a` and `b` are adjacent, the cursor is moved to b and a
          // space is added. Without this, the first half of `b` would never
          // get removed, and `a` would not re-render because it thinks it's
          // already in the correct state.
          // this._state.cache[x][y] = OVERLAP_OWNED_CHAR_DATA;
          if (lastCharX < line!.length - 1 && line!.getCodePoint(lastCharX + 1) === NULL_CELL_CODE) {
            // patch width to 2
            cell.content &= ~Content.WIDTH_MASK;
            cell.content |= 2 << Content.WIDTH_SHIFT;
            // this._clearChar(x + 1, y);
            // The overlapping char's char data will force a clear and render when the
            // overlapping char is no longer to the left of the character and also when
            // the space changes to another character.
            // this._state.cache[x + 1][y] = OVERLAP_OWNED_CHAR_DATA;
          }
        }

        callback(
          cell,
          x,
          y
        );

        x = lastCharX;
      }
    }
  }

  /**
   * Draws the background for a specified range of columns. Tries to batch adjacent cells of the
   * same color together to reduce draw calls.
   */
  private _drawBackground(firstRow: number, lastRow: number): void {
    const ctx = this._ctx;
    const cols = this._bufferService.cols;
    let startX: number = 0;
    let startY: number = 0;
    let prevFillStyle: string | null = null;

    ctx.save();

    this._forEachCell(firstRow, lastRow, (cell, x, y) => {
      // libvte and xterm both draw the background (but not foreground) of invisible characters,
      // so we should too.
      let nextFillStyle = null; // null represents default background color

      if (cell.isInverse()) {
        if (cell.isFgDefault()) {
          nextFillStyle = this._themeService.colors.foreground.css;
        } else if (cell.isFgRGB()) {
          nextFillStyle = `rgb(${AttributeData.toColorRGB(cell.getFgColor()).join(',')})`;
        } else {
          nextFillStyle = this._themeService.colors.ansi[cell.getFgColor()].css;
        }
      } else if (cell.isBgRGB()) {
        nextFillStyle = `rgb(${AttributeData.toColorRGB(cell.getBgColor()).join(',')})`;
      } else if (cell.isBgPalette()) {
        nextFillStyle = this._themeService.colors.ansi[cell.getBgColor()].css;
      }

      // Get any decoration foreground/background overrides, this must be fetched before the early
      // exist but applied after inverse
      let isTop = false;
      this._decorationService.forEachDecorationAtCell(x, this._bufferService.buffer.ydisp + y, undefined, d => {
        if (d.options.layer !== 'top' && isTop) {
          return;
        }
        if (d.backgroundColorRGB) {
          nextFillStyle = d.backgroundColorRGB.css;
        }
        isTop = d.options.layer === 'top';
      });

      if (prevFillStyle === null) {
        // This is either the first iteration, or the default background was set. Either way, we
        // don't need to draw anything.
        startX = x;
        startY = y;
      }

      if (y !== startY) {
        // our row changed, draw the previous row
        ctx.fillStyle = prevFillStyle || '';
        this._fillCells(startX, startY, cols - startX, 1);
        startX = x;
        startY = y;
      } else if (prevFillStyle !== nextFillStyle) {
        // our color changed, draw the previous characters in this row
        ctx.fillStyle = prevFillStyle || '';
        this._fillCells(startX, startY, x - startX, 1);
        startX = x;
        startY = y;
      }

      prevFillStyle = nextFillStyle;
    });

    // flush the last color we encountered
    if (prevFillStyle !== null) {
      ctx.fillStyle = prevFillStyle;
      this._fillCells(startX, startY, cols - startX, 1);
    }

    ctx.restore();
  }

  private _drawForeground(firstRow: number, lastRow: number): void {
    this._forEachCell(firstRow, lastRow, (cell, x, y) => this._drawChars(cell, x, y));
  }

  public handleGridChanged(firstRow: number, lastRow: number): void {
    // Resize has not been called yet
    if (this._state.cache.length === 0) {
      return;
    }

    if (this._charAtlas) {
      this._charAtlas.beginFrame();
    }

    this._clearCells(0, firstRow, this._bufferService.cols, lastRow - firstRow + 1);
    this._drawBackground(firstRow, lastRow);
    this._drawForeground(firstRow, lastRow);
  }

  /**
   * Whether a character is overlapping to the next cell.
   */
  private _isOverlapping(cell: ICellData): boolean {
    // Only single cell characters can be overlapping, rendering issues can
    // occur without this check
    if (cell.getWidth() !== 1) {
      return false;
    }

    // We assume that any ascii character will not overlap
    if (cell.getCode() < 256) {
      return false;
    }

    const chars = cell.getChars();

    // Deliver from cache if available
    if (this._characterOverlapCache.hasOwnProperty(chars)) {
      return this._characterOverlapCache[chars];
    }

    // Setup the font
    this._ctx.save();
    this._ctx.font = this._characterFont;

    // Measure the width of the character, but Math.floor it
    // because that is what the renderer does when it calculates
    // the character dimensions we are comparing against
    const overlaps = Math.floor(this._ctx.measureText(chars).width) > this._characterWidth;

    // Restore the original context
    this._ctx.restore();

    // Cache and return
    this._characterOverlapCache[chars] = overlaps;
    return overlaps;
  }
}
