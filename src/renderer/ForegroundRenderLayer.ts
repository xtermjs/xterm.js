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
const EMOJI_OWNED_CHAR_DATA: CharData = [null, '', 0, -1];

export class ForegroundRenderLayer extends BaseRenderLayer {
  private _state: GridCache<CharData>;

  constructor(container: HTMLElement, zIndex: number, colors: IColorSet) {
    super(container, 'fg', zIndex, colors);
    this._state = new GridCache<CharData>();
  }

  public resize(terminal: ITerminal, dim: IRenderDimensions, charSizeChanged: boolean): void {
    super.resize(terminal, dim, charSizeChanged);
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

      for (let x = 0; x < terminal.cols; x++) {
        const charData = line[x];
        const code: number = <number>charData[CHAR_DATA_CODE_INDEX];
        const char: string = charData[CHAR_DATA_CHAR_INDEX];
        const attr: number = charData[CHAR_DATA_ATTR_INDEX];
        let width: number = charData[CHAR_DATA_WIDTH_INDEX];

        // The character to the left is a wide character, drawing is owned by
        // the char at x-1
        if (width === 0) {
          this._state.cache[x][y] = null;
          continue;
        }

        // If the character is a space and the character to the left is an
        // emoji, skip the character and allow the emoji char to take full
        // control over this character's cell.
        if (code === 32 /*' '*/) {
          if (x > 0) {
            const previousChar: CharData = line[x - 1];
            if (this._isEmoji(previousChar[CHAR_DATA_CHAR_INDEX])) {
              continue;
            }
          }
        }

        // Skip rendering if the character is identical
        const state = this._state.cache[x][y];
        if (state && state[CHAR_DATA_CHAR_INDEX] === char && state[CHAR_DATA_ATTR_INDEX] === attr) {
          // Skip render, contents are identical
          this._state.cache[x][y] = charData;
          continue;
        }

        // Clear the old character if present
        if (state && state[CHAR_DATA_CODE_INDEX] !== 32 /*' '*/) {
          this._clearChar(x, y);
        }
        this._state.cache[x][y] = charData;

        const flags = attr >> 18;

        // Skip rendering if the character is invisible
        if (!code || code === 32 /*' '*/ || (flags & FLAGS.INVISIBLE)) {
          continue;
        }

        // If the character is an emoji and the character to the right is a
        // space, take ownership of the cell to the right.
        if (this._isEmoji(char)) {
          // If the character is an emoji, we want to force a re-render on every
          // frame. This is specifically to work around the case where two
          // emoji's `a` and `b` are adjacent, the cursor is moved to b and a
          // space is added. Without this, the first half of `b` would never
          // get removed, and `a` would not re-render because it thinks it's
          // already in the correct state.
          this._state.cache[x][y] = EMOJI_OWNED_CHAR_DATA;
          if (x < line.length && line[x + 1][CHAR_DATA_CODE_INDEX] === 32 /*' '*/) {
            width = 2;
            this._clearChar(x + 1, y);
            // The emoji owned char data will force a clear and render when the
            // emoji is no longer to the left of the character and also when the
            // space changes to another character.
            this._state.cache[x + 1][y] = EMOJI_OWNED_CHAR_DATA;
          }
        }

        let fg = (attr >> 9) & 0x1ff;

        // If inverse flag is on, the foreground should become the background.
        if (flags & FLAGS.INVERSE) {
          fg = attr & 0x1ff;
          // TODO: Is this case still needed
          if (fg === 256) {
            fg = INVERTED_DEFAULT_COLOR;
          }
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
            this._ctx.fillStyle = this.colors.background;
          } else if (fg < 256) {
            // 256 color support
            this._ctx.fillStyle = this.colors.ansi[fg];
          } else {
            this._ctx.fillStyle = this.colors.foreground;
          }
          this.fillBottomLineAtCells(x, y);
        }

        this.drawChar(terminal, char, code, width, x, y, fg, !!(flags & FLAGS.BOLD));

        this._ctx.restore();
      }
    }
  }

  /**
   * Whether the character is an emoji.
   * @param char The character to search.
   */
  private _isEmoji(char: string): boolean {
    // Check special ambiguous width characters
    if (char === '➜') {
      return true;
    }
    // Check emoji unicode range
    return char.search(/([\uD800-\uDBFF][\uDC00-\uDFFF])/g) >= 0;
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
