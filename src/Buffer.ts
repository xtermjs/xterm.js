/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ITerminal, IBuffer } from './Interfaces';
import { CircularList } from './utils/CircularList';
import { LineData, CharData } from './Types';

export const CHAR_DATA_ATTR_INDEX = 0;
export const CHAR_DATA_CHAR_INDEX = 1;
export const CHAR_DATA_WIDTH_INDEX = 2;
export const CHAR_DATA_CODE_INDEX = 3;
export const MAX_BUFFER_SIZE = 4294967295; // 2^32 - 1

/**
 * This class represents a terminal buffer (an internal state of the terminal), where the
 * following information is stored (in high-level):
 *   - text content of this particular buffer
 *   - cursor position
 *   - scroll position
 */
export class Buffer implements IBuffer {
  private _lines: CircularList<LineData>;

  public ydisp: number;
  public ybase: number;
  public y: number;
  public x: number;
  public scrollBottom: number;
  public scrollTop: number;
  public tabs: any;
  public savedY: number;
  public savedX: number;

  /**
   * Create a new Buffer.
   * @param _terminal The terminal the Buffer will belong to.
   * @param _hasScrollback Whether the buffer should respect the scrollback of
   * the terminal.
   */
  constructor(
    private _terminal: ITerminal,
    private _hasScrollback: boolean
  ) {
    this.clear();
  }

  public get lines(): CircularList<LineData> {
    return this._lines;
  }

  public get hasScrollback(): boolean {
    return this._hasScrollback && this.lines.maxLength > this._terminal.rows;
  }

  public get isCursorInViewport(): boolean {
    const absoluteY = this.ybase + this.y;
    const relativeY = absoluteY - this.ydisp;
    return (relativeY >= 0 && relativeY < this._terminal.rows);
  }

  /**
   * Gets the correct buffer length based on the rows provided, the terminal's
   * scrollback and whether this buffer is flagged to have scrollback or not.
   * @param rows The terminal rows to use in the calculation.
   */
  private _getCorrectBufferLength(rows: number): number {
    if (!this._hasScrollback) {
      return rows;
    }

    const correctBufferLength = rows + this._terminal.options.scrollback;

    return correctBufferLength > MAX_BUFFER_SIZE ? MAX_BUFFER_SIZE : correctBufferLength;
  }

  /**
   * Fills the buffer's viewport with blank lines.
   */
  public fillViewportRows(): void {
    if (this._lines.length === 0) {
      let i = this._terminal.rows;
      while (i--) {
        this.lines.push(this._terminal.blankLine());
      }
    }
  }

  /**
   * Clears the buffer to it's initial state, discarding all previous data.
   */
  public clear(): void {
    this.ydisp = 0;
    this.ybase = 0;
    this.y = 0;
    this.x = 0;
    this._lines = new CircularList<LineData>(this._getCorrectBufferLength(this._terminal.rows));
    this.scrollTop = 0;
    this.scrollBottom = this._terminal.rows - 1;
    this.setupTabStops();
  }

  /**
   * Resizes the buffer, adjusting its data accordingly.
   * @param newCols The new number of columns.
   * @param newRows The new number of rows.
   */
  public resize(newCols: number, newRows: number): void {
    // Increase max length if needed before adjustments to allow space to fill
    // as required.
    const newMaxLength = this._getCorrectBufferLength(newRows);
    if (newMaxLength > this._lines.maxLength) {
      this._lines.maxLength = newMaxLength;
    }

    // The following adjustments should only happen if the buffer has been
    // initialized/filled.
    if (this._lines.length > 0) {
      // Deal with columns increasing (we don't do anything when columns reduce)
      if (this._terminal.cols < newCols) {
        const ch: CharData = [this._terminal.defAttr, ' ', 1, 32]; // does xterm use the default attr?
        for (let i = 0; i < this._lines.length; i++) {
          // TODO: This should be removed, with tests setup for the case that was
          // causing the underlying bug, see https://github.com/sourcelair/xterm.js/issues/824
          if (this._lines.get(i) === undefined) {
            this._lines.set(i, this._terminal.blankLine(undefined, undefined, newCols));
          }
          while (this._lines.get(i).length < newCols) {
            this._lines.get(i).push(ch);
          }
        }
      }

      // Resize rows in both directions as needed
      let addToY = 0;
      if (this._terminal.rows < newRows) {
        for (let y = this._terminal.rows; y < newRows; y++) {
          if (this._lines.length < newRows + this.ybase) {
            if (this.ybase > 0 && this._lines.length <= this.ybase + this.y + addToY + 1) {
              // There is room above the buffer and there are no empty elements below the line,
              // scroll up
              this.ybase--;
              addToY++;
              if (this.ydisp > 0) {
                // Viewport is at the top of the buffer, must increase downwards
                this.ydisp--;
              }
            } else {
              // Add a blank line if there is no buffer left at the top to scroll to, or if there
              // are blank lines after the cursor
              this._lines.push(this._terminal.blankLine(undefined, undefined, newCols));
            }
          }
        }
      } else { // (this._terminal.rows >= newRows)
        for (let y = this._terminal.rows; y > newRows; y--) {
          if (this._lines.length > newRows + this.ybase) {
            if (this._lines.length > this.ybase + this.y + 1) {
              // The line is a blank line below the cursor, remove it
              this._lines.pop();
            } else {
              // The line is the cursor, scroll down
              this.ybase++;
              this.ydisp++;
            }
          }
        }
      }

      // Reduce max length if needed after adjustments, this is done after as it
      // would otherwise cut data from the bottom of the buffer.
      if (newMaxLength < this._lines.maxLength) {
        // Trim from the top of the buffer and adjust ybase and ydisp.
        const amountToTrim = this._lines.length - newMaxLength;
        if (amountToTrim > 0) {
          this._lines.trimStart(amountToTrim);
          this.ybase = Math.max(this.ybase - amountToTrim, 0);
          this.ydisp = Math.max(this.ydisp - amountToTrim, 0);
        }
        this._lines.maxLength = newMaxLength;
      }

      // Make sure that the cursor stays on screen
      if (this.y >= newRows) {
        this.y = newRows - 1;
      }
      if (addToY) {
        this.y += addToY;
      }

      if (this.x >= newCols) {
        this.x = newCols - 1;
      }

      this.scrollTop = 0;
    }

    this.scrollBottom = newRows - 1;
  }

  /**
   * Translates a buffer line to a string, with optional start and end columns.
   * Wide characters will count as two columns in the resulting string. This
   * function is useful for getting the actual text underneath the raw selection
   * position.
   * @param line The line being translated.
   * @param trimRight Whether to trim whitespace to the right.
   * @param startCol The column to start at.
   * @param endCol The column to end at.
   */
  public translateBufferLineToString(lineIndex: number, trimRight: boolean, startCol: number = 0, endCol: number = null): string {
    // Get full line
    let lineString = '';
    const line = this.lines.get(lineIndex);
    if (!line) {
      return '';
    }

    // Initialize column and index values. Column values represent the actual
    // cell column, indexes represent the index in the string. Indexes are
    // needed here because some chars are 0 characters long (eg. after wide
    // chars) and some chars are longer than 1 characters long (eg. emojis).
    let startIndex = startCol;
    endCol = endCol || line.length;
    let endIndex = endCol;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      lineString += char[CHAR_DATA_CHAR_INDEX];
      // Adjust start and end cols for wide characters if they affect their
      // column indexes
      if (char[CHAR_DATA_WIDTH_INDEX] === 0) {
        if (startCol >= i) {
          startIndex--;
        }
        if (endCol >= i) {
          endIndex--;
        }
      } else {
        // Adjust the columns to take glyphs that are represented by multiple
        // code points into account.
        if (char[CHAR_DATA_CHAR_INDEX].length > 1) {
          if (startCol > i) {
            startIndex += char[CHAR_DATA_CHAR_INDEX].length - 1;
          }
          if (endCol > i) {
            endIndex += char[CHAR_DATA_CHAR_INDEX].length - 1;
          }
        }
      }
    }

    // Calculate the final end col by trimming whitespace on the right of the
    // line if needed.
    if (trimRight) {
      const rightWhitespaceIndex = lineString.search(/\s+$/);
      if (rightWhitespaceIndex !== -1) {
        endIndex = Math.min(endIndex, rightWhitespaceIndex);
      }
      // Return the empty string if only trimmed whitespace is selected
      if (endIndex <= startIndex) {
        return '';
      }
    }

    return lineString.substring(startIndex, endIndex);
  }

  /**
   * Setup the tab stops.
   * @param i The index to start setting up tab stops from.
   */
  public setupTabStops(i?: number): void {
    if (i != null) {
      if (!this.tabs[i]) {
        i = this.prevStop(i);
      }
    } else {
      this.tabs = {};
      i = 0;
    }

    for (; i < this._terminal.cols; i += this._terminal.options.tabStopWidth) {
      this.tabs[i] = true;
    }
  }

  /**
   * Move the cursor to the previous tab stop from the given position (default is current).
   * @param x The position to move the cursor to the previous tab stop.
   */
  public prevStop(x?: number): number {
    if (x == null) {
      x = this.x;
    }
    while (!this.tabs[--x] && x > 0);
    return x >= this._terminal.cols ? this._terminal.cols - 1 : x < 0 ? 0 : x;
  }

  /**
   * Move the cursor one tab stop forward from the given position (default is current).
   * @param x The position to move the cursor one tab stop forward.
   */
  public nextStop(x?: number): number {
    if (x == null) {
      x = this.x;
    }
    while (!this.tabs[++x] && x < this._terminal.cols);
    return x >= this._terminal.cols ? this._terminal.cols - 1 : x < 0 ? 0 : x;
  }
}
