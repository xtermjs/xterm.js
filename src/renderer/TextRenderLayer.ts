/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { CHAR_DATA_ATTR_INDEX, CHAR_DATA_CODE_INDEX, CHAR_DATA_CHAR_INDEX, CHAR_DATA_WIDTH_INDEX } from '../Buffer';
import { FLAGS, IColorSet, IRenderDimensions, ICharacterJoiner } from './Types';
import { CharData, ITerminal } from '../Types';
import { INVERTED_DEFAULT_COLOR } from './atlas/Types';
import { GridCache } from './GridCache';
import { BaseRenderLayer } from './BaseRenderLayer';
import { merge } from '../utils/MergeRanges';

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
  private _joiners: ICharacterJoiner[] = [];

  constructor(container: HTMLElement, zIndex: number, colors: IColorSet, alpha: boolean) {
    super(container, 'text', zIndex, alpha, colors);
    this._state = new GridCache<CharData>();
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
    foreground: boolean,
    callback: (
      code: number,
      char: string,
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
      let index = 0;
      const joinedRanges = foreground ? this._getJoinedCharacters(terminal, row) : [];
      for (let x = 0; x < terminal.cols; x++) {
        let charData = line[x];
        const code: number = <number>charData[CHAR_DATA_CODE_INDEX];
        let char: string = charData[CHAR_DATA_CHAR_INDEX];
        const attr: number = charData[CHAR_DATA_ATTR_INDEX];
        let width: number = charData[CHAR_DATA_WIDTH_INDEX];

        // The character to the left is a wide character, drawing is owned by
        // the char at x-1
        if (width === 0) {
          continue;
        }

        // Just in case we ended up in the middle of a range, lop off any
        // ranges that have already passed
        while (joinedRanges.length > 0 && joinedRanges[0][0] < x) {
          joinedRanges.shift();
        }

        // Process any joined character ranges as needed. Because of how the
        // ranges are produced, we know that they are valid for the characters
        // and attributes of our input.
        let lastCharX = x;
        if (joinedRanges.length > 0 && x === joinedRanges[0][0]) {
          const range = joinedRanges.shift();

          // We need to start the searching at the next character
          lastCharX++;
          index++;

          // Build up the string
          for (; lastCharX < terminal.cols && index < range[1]; lastCharX++) {
            charData = line[lastCharX];
            if (charData[CHAR_DATA_WIDTH_INDEX] !== 0) {
              char += charData[CHAR_DATA_CHAR_INDEX];
              index++;
            }
          }

          // Update our data accordingly. We use the width of the last character
          // for the rest of the checks and decrement our column/index so that
          // they align with the last character matched rather than the next
          // character in the sequence.
          width = charData[CHAR_DATA_WIDTH_INDEX];
          lastCharX--;
          index--;
        }

        // If the character is an overlapping char and the character to the right is a
        // space, take ownership of the cell to the right.
        if (this._isOverlapping(charData)) {
          // If the character is overlapping, we want to force a re-render on every
          // frame. This is specifically to work around the case where two
          // overlaping chars `a` and `b` are adjacent, the cursor is moved to b and a
          // space is added. Without this, the first half of `b` would never
          // get removed, and `a` would not re-render because it thinks it's
          // already in the correct state.
          // this._state.cache[x][y] = OVERLAP_OWNED_CHAR_DATA;
          if (lastCharX < line.length - 1 && line[lastCharX + 1][CHAR_DATA_CODE_INDEX] === 32 /*' '*/) {
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
          if (fg === 256) {
            fg = INVERTED_DEFAULT_COLOR;
          }
          if (bg === 257) {
            bg = INVERTED_DEFAULT_COLOR;
          }
        }

        callback(
          char.length === 1 ? code : Infinity,
          char,
          char.length + width - 1,
          x,
          y,
          fg,
          bg,
          flags
        );

        x = lastCharX;
        index++;
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

    this._forEachCell(terminal, firstRow, lastRow, false, (code, char, width, x, y, fg, bg, flags) => {
      // libvte and xterm both draw the background (but not foreground) of invisible characters,
      // so we should too.
      let nextFillStyle = null; // null represents default background color
      if (bg === INVERTED_DEFAULT_COLOR) {
        nextFillStyle = this._colors.foreground.css;
      } else if (bg < 256) {
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
    this._forEachCell(terminal, firstRow, lastRow, true, (code, char, width, x, y, fg, bg, flags) => {
      if (flags & FLAGS.INVISIBLE) {
        return;
      }
      if (flags & FLAGS.UNDERLINE) {
        this._ctx.save();
        if (fg === INVERTED_DEFAULT_COLOR) {
          this._ctx.fillStyle = this._colors.background.css;
        } else if (fg < 256) {
          // 256 color support
          this._ctx.fillStyle = this._colors.ansi[fg].css;
        } else {
          this._ctx.fillStyle = this._colors.foreground.css;
        }
        this.fillBottomLineAtCells(x, y, width);
        this._ctx.restore();
      }
      this.drawChar(
        terminal, char, code,
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

    this._charAtlas.beginFrame();

    this.clearCells(0, firstRow, terminal.cols, lastRow - firstRow + 1);
    this._drawBackground(terminal, firstRow, lastRow);
    this._drawForeground(terminal, firstRow, lastRow);
  }

  public onOptionsChanged(terminal: ITerminal): void {
    this.setTransparency(terminal, terminal.options.allowTransparency);
  }

  public registerCharacterJoiner(joiner: ICharacterJoiner): void {
    this._joiners.push(joiner);
  }

  public deregisterCharacterJoiner(joinerId: number): void {
    for (let i = 0; i < this._joiners.length; i++) {
      if (this._joiners[i].id === joinerId) {
        this._joiners.splice(i, 1);
        return;
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

  private _getJoinedCharacters(terminal: ITerminal, row: number): [number, number][] {
    if (this._joiners.length === 0) {
      return [];
    }

    const line = terminal.buffer.lines.get(row);
    if (line.length === 0) {
      return [];
    }

    const ranges: [number, number][] = [];
    const lineStr = terminal.buffer.translateBufferLineToString(row, true);

    let currentIndex = 0;
    let rangeStartIndex = 0;
    let rangeAttr = line[0][CHAR_DATA_ATTR_INDEX] >> 9;
    for (let x = 0; x < terminal.cols; x++) {
      const charData = line[x];
      const width = charData[CHAR_DATA_WIDTH_INDEX];
      const attr = charData[CHAR_DATA_ATTR_INDEX] >> 9;

      if (width === 0) {
        // If this character is of width 0, skip it
        continue;
      }

      // End of range
      if (attr !== rangeAttr) {
        // If we ended up with a sequence of more than one character, look for
        // ranges to join
        if (currentIndex - rangeStartIndex > 1) {
          const subRanges = this._getSubRanges(lineStr, rangeStartIndex, currentIndex);
          for (let i = 0; i < subRanges.length; i++) {
            ranges.push(subRanges[i]);
          }
        }

        // Reset our markers for a new range
        rangeStartIndex = x;
        rangeAttr = attr;
      }

      currentIndex++;
    }

    // Process any trailing ranges
    if (currentIndex - rangeStartIndex > 1) {
      const subRanges = this._getSubRanges(lineStr, rangeStartIndex, currentIndex);
      for (let i = 0; i < subRanges.length; i++) {
        ranges.push(subRanges[i]);
      }
    }

    return ranges;
  }

  private _getSubRanges(line: string, startIndex: number, endIndex: number): [number, number][] {
    const text = line.substring(startIndex, endIndex);
    // At this point we already know that there is at least one joiner so
    // we can just pull its value and assign it directly rather than
    // merging it into an empty array, which incurs unnecessary writes.
    const subRanges: [number, number][] = this._joiners[0].handler(text);
    for (let i = 1; i < this._joiners.length; i++) {
      // We merge any overlapping ranges across the different joiners
      const joinerSubRanges = this._joiners[i].handler(text);
      for (let j = 0; j < joinerSubRanges.length; j++) {
        merge(subRanges, joinerSubRanges[j]);
      }
    }
    return subRanges.map<[number, number]>(range => [range[0] + startIndex, range[1] + endIndex]);
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
