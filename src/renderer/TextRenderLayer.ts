/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IColorSet, IRenderDimensions } from './Interfaces';
import { IBuffer, ICharMeasure, ITerminal } from '../Interfaces';
import { CHAR_DATA_ATTR_INDEX, CHAR_DATA_CODE_INDEX, CHAR_DATA_CHAR_INDEX, CHAR_DATA_WIDTH_INDEX } from '../Buffer';
import { FLAGS } from './Types';
import { GridCache } from './GridCache';
import { CharData } from '../Types';
import { BaseRenderLayer, INVERTED_DEFAULT_COLOR } from './BaseRenderLayer';

/**
 * This CharData looks like a null character, which will forc a clear and render
 * when the character changes (a regular space ' ' character may not as it's
 * drawn state is a cleared cell).
 */
const OVERLAP_OWNED_CHAR_DATA: CharData = [null, '', 0, -1];

export class TextRenderLayer extends BaseRenderLayer {
  private _state: GridCache<CharData>;
  private _characterWidth: number;
  private _characterFont: string;
  private _characterOverlapCache: { [key: string]: boolean } = {};

  constructor(container: HTMLElement, zIndex: number, colors: IColorSet) {
    super(container, 'text', zIndex, false, colors);
    this._state = new GridCache<CharData>();
  }

  public resize(terminal: ITerminal, dim: IRenderDimensions, charSizeChanged: boolean): void {
    super.resize(terminal, dim, charSizeChanged);

    // Clear the character width cache if the font or width has changed
    const terminalFont = `${terminal.options.fontSize * window.devicePixelRatio}px ${terminal.options.fontFamily}`;
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

  public onGridChanged(terminal: ITerminal, startRow: number, endRow: number): void {
    // Resize has not been called yet
    if (this._state.cache.length === 0) {
      return;
    }

    for (let y = startRow; y <= endRow; y++) {
      const row = y + terminal.buffer.ydisp;
      const line = terminal.buffer.lines.get(row);

      this.clearCells(0, y, terminal.cols, 1);
      // for (let x = 0; x < terminal.cols; x++) {
      //   this._state.cache[x][y] = null;
      // }

      for (let x = 0; x < terminal.cols; x++) {
        const charData = line[x];
        const code: number = <number>charData[CHAR_DATA_CODE_INDEX];
        const char: string = charData[CHAR_DATA_CHAR_INDEX];
        const attr: number = charData[CHAR_DATA_ATTR_INDEX];
        let width: number = charData[CHAR_DATA_WIDTH_INDEX];

        // The character to the left is a wide character, drawing is owned by
        // the char at x-1
        if (width === 0) {
          // this._state.cache[x][y] = null;
          continue;
        }

        // If the character is a space and the character to the left is an
        // overlapping character, skip the character and allow the overlapping
        // char to take full control over this character's cell.
        if (code === 32 /*' '*/) {
          if (x > 0) {
            const previousChar: CharData = line[x - 1];
            if (this._isOverlapping(previousChar)) {
              continue;
            }
          }
        }

        // Skip rendering if the character is identical
        // const state = this._state.cache[x][y];
        // if (state && state[CHAR_DATA_CHAR_INDEX] === char && state[CHAR_DATA_ATTR_INDEX] === attr) {
        //   // Skip render, contents are identical
        //   this._state.cache[x][y] = charData;
        //   continue;
        // }

        // Clear the old character was not a space with the default background
        // const wasInverted = !!(state && state[CHAR_DATA_ATTR_INDEX] && state[CHAR_DATA_ATTR_INDEX] >> 18 & FLAGS.INVERSE);
        // if (state && !(state[CHAR_DATA_CODE_INDEX] === 32 /*' '*/ && (state[CHAR_DATA_ATTR_INDEX] & 0x1ff) >= 256 && !wasInverted)) {
        //   this._clearChar(x, y);
        // }
        // this._state.cache[x][y] = charData;

        const flags = attr >> 18;
        let bg = attr & 0x1ff;

        // Skip rendering if the character is invisible
        const isDefaultBackground = bg >= 256;
        const isInvisible = flags & FLAGS.INVISIBLE;
        const isInverted = flags & FLAGS.INVERSE;
        if (!code || (code === 32 /*' '*/ && isDefaultBackground && !isInverted) || isInvisible) {
          continue;
        }

        // If the character is an overlapping char and the character to the right is a
        // space, take ownership of the cell to the right.
        if (width !== 0 && this._isOverlapping(charData)) {
          // If the character is overlapping, we want to force a re-render on every
          // frame. This is specifically to work around the case where two
          // overlaping chars `a` and `b` are adjacent, the cursor is moved to b and a
          // space is added. Without this, the first half of `b` would never
          // get removed, and `a` would not re-render because it thinks it's
          // already in the correct state.
          // this._state.cache[x][y] = OVERLAP_OWNED_CHAR_DATA;
          if (x < line.length - 1 && line[x + 1][CHAR_DATA_CODE_INDEX] === 32 /*' '*/) {
            width = 2;
            // this._clearChar(x + 1, y);
            // The overlapping char's char data will force a clear and render when the
            // overlapping char is no longer to the left of the character and also when
            // the space changes to another character.
            // this._state.cache[x + 1][y] = OVERLAP_OWNED_CHAR_DATA;
          }
        }

        let fg = (attr >> 9) & 0x1ff;

        // If inverse flag is on, the foreground should become the background.
        if (isInverted) {
          const temp = bg;
          bg = fg;
          fg = temp;
          if (fg === 256) {
            fg = INVERTED_DEFAULT_COLOR;
          }
          if (bg === 257) {
            bg = INVERTED_DEFAULT_COLOR;
          }
        }

        // Clear the cell next to this character if it's wide
        if (width === 2) {
          // this.clearCells(x + 1, y, 1, 1);
        }

        // Draw background
        if (bg < 256) {
          this._ctx.save();
          this._ctx.fillStyle = (bg === INVERTED_DEFAULT_COLOR ? this._colors.foreground : this._colors.ansi[bg]);
          this.fillCells(x, y, width, 1);
          this._ctx.restore();
        }

        this._ctx.save();
        if (flags & FLAGS.BOLD) {
          this._ctx.font = `bold ${this._ctx.font}`;
          // Convert the FG color to the bold variant
          if (fg < 8) {
            fg += 8;
          }
        }

        if (flags & FLAGS.UNDERLINE) {
          if (fg === INVERTED_DEFAULT_COLOR) {
            this._ctx.fillStyle = this._colors.background;
          } else if (fg < 256) {
            // 256 color support
            this._ctx.fillStyle = this._colors.ansi[fg];
          } else {
            this._ctx.fillStyle = this._colors.foreground;
          }
          this.fillBottomLineAtCells(x, y);
        }

        this.drawChar(terminal, char, code, width, x, y, fg, bg, !!(flags & FLAGS.BOLD), !!(flags & FLAGS.DIM));

        this._ctx.restore();
      }
    }
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
  private _clearChar(x: number, y: number): void {
    let colsToClear = 1;
    // Clear the adjacent character if it was wide
    const state = this._state.cache[x][y];
    if (state && state[CHAR_DATA_WIDTH_INDEX] === 2) {
      colsToClear = 2;
    }
    this.clearCells(x, y, colsToClear, 1);
  }
}
