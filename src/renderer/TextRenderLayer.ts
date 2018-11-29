/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { CHAR_DATA_ATTR_INDEX, CHAR_DATA_CODE_INDEX, CHAR_DATA_CHAR_INDEX, CHAR_DATA_WIDTH_INDEX, NULL_CELL_CODE } from '../Buffer';
import { FLAGS, IColorSet, IRenderDimensions, ICharacterJoinerRegistry } from './Types';
import { CharData, ITerminal } from '../Types';
import { INVERTED_DEFAULT_COLOR, DEFAULT_COLOR } from './atlas/Types';
import { GridCache } from './GridCache';
import { BaseRenderLayer } from './BaseRenderLayer';
import { is256Color } from './atlas/CharAtlasUtils';

/**
 * This CharData looks like a null character, which will forc a clear and render
 * when the character changes (a regular space ' ' character may not as it's
 * drawn state is a cleared cell).
 */
// const OVERLAP_OWNED_CHAR_DATA: CharData = [null, '', 0, -1];

export class TextRenderLayer extends BaseRenderLayer {
  private _state: GridCache<CharData>;
  private _characterWidth: number;
  private _characterFont: string;
  private _characterOverlapCache: { [key: string]: boolean } = {};
  private _characterJoinerRegistry: ICharacterJoinerRegistry;

  constructor(container: HTMLElement, zIndex: number, colors: IColorSet, characterJoinerRegistry: ICharacterJoinerRegistry, alpha: boolean) {
    super(container, 'text', zIndex, alpha, colors);
    this._state = new GridCache<CharData>();
    this._characterJoinerRegistry = characterJoinerRegistry;
  }

  public resize(terminal: ITerminal, dim: IRenderDimensions): void {
    super.resize(terminal, dim);

    // Clear the character width cache if the font or width has changed
    const terminalFont = this._getFont(terminal, false, false);
    if (this._characterWidth !== dim.scaledCharWidth || this._characterFont !== terminalFont) {
      this._characterWidth = dim.scaledCharWidth;
      this._characterFont = terminalFont;
      this._characterOverlapCache = {};
    }
    // Resizing the canvas discards the contents of the canvas so clear state
    this._state.clear();
    this._state.resize(terminal.cols, terminal.rows);
  }

  public reset(terminal: ITerminal): void {
    this._state.clear();
    this.clearAll();
  }

  private _forEachCell(
    terminal: ITerminal,
    firstRow: number,
    lastRow: number,
    joinerRegistry: ICharacterJoinerRegistry | null,
    callback: (
      code: number,
      chars: string,
      width: number,
      x: number,
      y: number,
      fg: number,
      bg: number,
      flags: number
    ) => void
  ): void {
    for (let y = firstRow; y <= lastRow; y++) {
      const row = y + terminal.buffer.ydisp;
      const line = terminal.buffer.lines.get(row);
      const joinedRanges = joinerRegistry ? joinerRegistry.getJoinedCharacters(row) : [];
      for (let x = 0; x < terminal.cols; x++) {
        const charData = line.get(x);
        let code: number = <number>charData[CHAR_DATA_CODE_INDEX];

        // Can either represent character(s) for a single cell or multiple cells
        // if indicated by a character joiner.
        let chars: string = charData[CHAR_DATA_CHAR_INDEX];
        const attr: number = charData[CHAR_DATA_ATTR_INDEX];
        let width: number = charData[CHAR_DATA_WIDTH_INDEX];

        // If true, indicates that the current character(s) to draw were joined.
        let isJoined = false;
        let lastCharX = x;

        // The character to the left is a wide character, drawing is owned by
        // the char at x-1
        if (width === 0) {
          continue;
        }

        // Process any joined character ranges as needed. Because of how the
        // ranges are produced, we know that they are valid for the characters
        // and attributes of our input.
        if (joinedRanges.length > 0 && x === joinedRanges[0][0]) {
          isJoined = true;
          const range = joinedRanges.shift();

          // We already know the exact start and end column of the joined range,
          // so we get the string and width representing it directly
          chars = terminal.buffer.translateBufferLineToString(
            row,
            true,
            range[0],
            range[1]
          );
          width = range[1] - range[0];
          code = Infinity;

          // Skip over the cells occupied by this range in the loop
          lastCharX = range[1] - 1;
        }

        // If the character is an overlapping char and the character to the
        // right is a space, take ownership of the cell to the right. We skip
        // this check for joined characters because their rendering likely won't
        // yield the same result as rendering the last character individually.
        if (!isJoined && this._isOverlapping(charData)) {
          // If the character is overlapping, we want to force a re-render on every
          // frame. This is specifically to work around the case where two
          // overlaping chars `a` and `b` are adjacent, the cursor is moved to b and a
          // space is added. Without this, the first half of `b` would never
          // get removed, and `a` would not re-render because it thinks it's
          // already in the correct state.
          // this._state.cache[x][y] = OVERLAP_OWNED_CHAR_DATA;
          if (lastCharX < line.length - 1 && line.get(lastCharX + 1)[CHAR_DATA_CODE_INDEX] === NULL_CELL_CODE) {
            width = 2;
            // this._clearChar(x + 1, y);
            // The overlapping char's char data will force a clear and render when the
            // overlapping char is no longer to the left of the character and also when
            // the space changes to another character.
            // this._state.cache[x + 1][y] = OVERLAP_OWNED_CHAR_DATA;
          }
        }

        const flags = attr >> 18;
        let bg = attr & 0x1ff;
        let fg = (attr >> 9) & 0x1ff;

        // If inverse flag is on, the foreground should become the background.
        if (flags & FLAGS.INVERSE) {
          const temp = bg;
          bg = fg;
          fg = temp;
          if (fg === DEFAULT_COLOR) {
            fg = INVERTED_DEFAULT_COLOR;
          }
          if (bg === DEFAULT_COLOR) {
            bg = INVERTED_DEFAULT_COLOR;
          }
        }

        callback(
          code,
          chars,
          width,
          x,
          y,
          fg,
          bg,
          flags
        );

        x = lastCharX;
      }
    }
  }

  /**
   * Draws the background for a specified range of columns. Tries to batch adjacent cells of the
   * same color together to reduce draw calls.
   */
  private _drawBackground(terminal: ITerminal, firstRow: number, lastRow: number): void {
    const ctx = this._ctx;
    const cols = terminal.cols;
    let startX: number = 0;
    let startY: number = 0;
    let prevFillStyle: string | null = null;

    ctx.save();

    this._forEachCell(terminal, firstRow, lastRow, null, (code, chars, width, x, y, fg, bg, flags) => {
      // libvte and xterm both draw the background (but not foreground) of invisible characters,
      // so we should too.
      let nextFillStyle = null; // null represents default background color
      if (bg === INVERTED_DEFAULT_COLOR) {
        nextFillStyle = this._colors.foreground.css;
      } else if (is256Color(bg)) {
        nextFillStyle = this._colors.ansi[bg].css;
      }

      if (prevFillStyle === null) {
        // This is either the first iteration, or the default background was set. Either way, we
        // don't need to draw anything.
        startX = x;
        startY = y;
      } if (y !== startY) {
        // our row changed, draw the previous row
        ctx.fillStyle = prevFillStyle;
        this.fillCells(startX, startY, cols - startX, 1);
        startX = x;
        startY = y;
      } else if (prevFillStyle !== nextFillStyle) {
        // our color changed, draw the previous characters in this row
        ctx.fillStyle = prevFillStyle;
        this.fillCells(startX, startY, x - startX, 1);
        startX = x;
        startY = y;
      }

      prevFillStyle = nextFillStyle;
    });

    // flush the last color we encountered
    if (prevFillStyle !== null) {
      ctx.fillStyle = prevFillStyle;
      this.fillCells(startX, startY, cols - startX, 1);
    }

    ctx.restore();
  }

  private _drawForeground(terminal: ITerminal, firstRow: number, lastRow: number): void {
    this._forEachCell(terminal, firstRow, lastRow, this._characterJoinerRegistry, (code, chars, width, x, y, fg, bg, flags) => {
      if (flags & FLAGS.INVISIBLE) {
        return;
      }
      if (flags & FLAGS.UNDERLINE) {
        this._ctx.save();
        if (fg === INVERTED_DEFAULT_COLOR) {
          this._ctx.fillStyle = this._colors.background.css;
        } else if (is256Color(fg)) {
          // 256 color support
          this._ctx.fillStyle = this._colors.ansi[fg].css;
        } else {
          this._ctx.fillStyle = this._colors.foreground.css;
        }
        this.fillBottomLineAtCells(x, y, width);
        this._ctx.restore();
      }
      this.drawChars(
        terminal, chars, code,
        width, x, y,
        fg, bg,
        !!(flags & FLAGS.BOLD), !!(flags & FLAGS.DIM), !!(flags & FLAGS.ITALIC)
      );
    });
  }

  public onGridChanged(terminal: ITerminal, firstRow: number, lastRow: number): void {
    // Resize has not been called yet
    if (this._state.cache.length === 0) {
      return;
    }

    if (this._charAtlas) {
      this._charAtlas.beginFrame();
    }

    this.clearCells(0, firstRow, terminal.cols, lastRow - firstRow + 1);
    this._drawBackground(terminal, firstRow, lastRow);
    this._drawForeground(terminal, firstRow, lastRow);
  }

  public onOptionsChanged(terminal: ITerminal): void {
    this.setTransparency(terminal, terminal.options.allowTransparency);
  }

  /**
   * Whether a character is overlapping to the next cell.
   */
  private _isOverlapping(charData: CharData): boolean {
    // Only single cell characters can be overlapping, rendering issues can
    // occur without this check
    if (charData[CHAR_DATA_WIDTH_INDEX] !== 1) {
      return false;
    }

    // We assume that any ascii character will not overlap
    const code = charData[CHAR_DATA_CODE_INDEX];
    if (code < 256) {
      return false;
    }

    // Deliver from cache if available
    const char = charData[CHAR_DATA_CHAR_INDEX];
    if (this._characterOverlapCache.hasOwnProperty(char)) {
      return this._characterOverlapCache[char];
    }

    // Setup the font
    this._ctx.save();
    this._ctx.font = this._characterFont;

    // Measure the width of the character, but Math.floor it
    // because that is what the renderer does when it calculates
    // the character dimensions we are comparing against
    const overlaps = Math.floor(this._ctx.measureText(char).width) > this._characterWidth;

    // Restore the original context
    this._ctx.restore();

    // Cache and return
    this._characterOverlapCache[char] = overlaps;
    return overlaps;
  }

  /**
   * Clear the charcater at the cell specified.
   * @param x The column of the char.
   * @param y The row of the char.
   */
  // private _clearChar(x: number, y: number): void {
  //   let colsToClear = 1;
  //   // Clear the adjacent character if it was wide
  //   const state = this._state.cache[x][y];
  //   if (state && state[CHAR_DATA_WIDTH_INDEX] === 2) {
  //     colsToClear = 2;
  //   }
  //   this.clearCells(x, y, colsToClear, 1);
  // }
}
