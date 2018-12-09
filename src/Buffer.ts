/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { CircularList } from './common/CircularList';
import { CharData, ITerminal, IBuffer, IBufferLine, BufferIndex, IBufferStringIterator, IBufferStringIteratorResult, IBufferLineConstructor } from './Types';
import { EventEmitter } from './common/EventEmitter';
import { IMarker } from 'xterm';
import { BufferLine, BufferLineJSArray } from './BufferLine';
import { DEFAULT_COLOR } from './renderer/atlas/Types';

export const DEFAULT_ATTR = (0 << 18) | (DEFAULT_COLOR << 9) | (256 << 0);
export const CHAR_DATA_ATTR_INDEX = 0;
export const CHAR_DATA_CHAR_INDEX = 1;
export const CHAR_DATA_WIDTH_INDEX = 2;
export const CHAR_DATA_CODE_INDEX = 3;
export const MAX_BUFFER_SIZE = 4294967295; // 2^32 - 1

export const NULL_CELL_CHAR = ' ';
export const NULL_CELL_WIDTH = 1;
export const NULL_CELL_CODE = 32;

/**
 * This class represents a terminal buffer (an internal state of the terminal), where the
 * following information is stored (in high-level):
 *   - text content of this particular buffer
 *   - cursor position
 *   - scroll position
 */
export class Buffer implements IBuffer {
  public lines: CircularList<IBufferLine>;
  public ydisp: number;
  public ybase: number;
  public y: number;
  public x: number;
  public scrollBottom: number;
  public scrollTop: number;
  public tabs: any;
  public savedY: number;
  public savedX: number;
  public savedCurAttr: number;
  public markers: Marker[] = [];
  private _bufferLineConstructor: IBufferLineConstructor;

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

  public setBufferLineFactory(type: string): void {
    if (type === 'JsArray') {
      if (this._bufferLineConstructor !== BufferLineJSArray) {
        this._bufferLineConstructor = BufferLineJSArray;
        this._recreateLines();
      }
    } else {
      if (this._bufferLineConstructor !== BufferLine) {
        this._bufferLineConstructor = BufferLine;
        this._recreateLines();
      }
    }
  }

  private _recreateLines(): void {
    if (!this.lines) return;
    for (let i = 0; i < this.lines.length; ++i) {
      const oldLine = this.lines.get(i);
      const newLine = new this._bufferLineConstructor(oldLine.length);
      for (let j = 0; j < oldLine.length; ++j) {
        newLine.set(j, oldLine.get(j));
      }
      this.lines.set(i, newLine);
    }
  }

  public getBlankLine(attr: number, isWrapped?: boolean): IBufferLine {
    const fillCharData: CharData = [attr, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE];
    return new this._bufferLineConstructor(this._terminal.cols, fillCharData, isWrapped);
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
  public fillViewportRows(fillAttr?: number): void {
    if (this.lines.length === 0) {
      if (fillAttr === undefined) {
        fillAttr = DEFAULT_ATTR;
      }
      let i = this._terminal.rows;
      while (i--) {
        this.lines.push(this.getBlankLine(fillAttr));
      }
    }
  }

  /**
   * Clears the buffer to it's initial state, discarding all previous data.
   */
  public clear(): void {
    this.setBufferLineFactory(this._terminal.options.experimentalBufferLineImpl);
    this.ydisp = 0;
    this.ybase = 0;
    this.y = 0;
    this.x = 0;
    this.lines = new CircularList<IBufferLine>(this._getCorrectBufferLength(this._terminal.rows));
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
    if (newMaxLength > this.lines.maxLength) {
      this.lines.maxLength = newMaxLength;
    }

    // The following adjustments should only happen if the buffer has been
    // initialized/filled.
    if (this.lines.length > 0) {
      // Deal with columns increasing (we don't do anything when columns reduce)
      if (this._terminal.cols < newCols) {
        const ch: CharData = [DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]; // does xterm use the default attr?
        for (let i = 0; i < this.lines.length; i++) {
          this.lines.get(i).resize(newCols, ch);
        }
      }

      // Resize rows in both directions as needed
      let addToY = 0;
      if (this._terminal.rows < newRows) {
        for (let y = this._terminal.rows; y < newRows; y++) {
          if (this.lines.length < newRows + this.ybase) {
            if (this.ybase > 0 && this.lines.length <= this.ybase + this.y + addToY + 1) {
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
              const fillCharData: CharData = [DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE];
              this.lines.push(new this._bufferLineConstructor(newCols, fillCharData));
            }
          }
        }
      } else { // (this._terminal.rows >= newRows)
        for (let y = this._terminal.rows; y > newRows; y--) {
          if (this.lines.length > newRows + this.ybase) {
            if (this.lines.length > this.ybase + this.y + 1) {
              // The line is a blank line below the cursor, remove it
              this.lines.pop();
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
      if (newMaxLength < this.lines.maxLength) {
        // Trim from the top of the buffer and adjust ybase and ydisp.
        const amountToTrim = this.lines.length - newMaxLength;
        if (amountToTrim > 0) {
          this.lines.trimStart(amountToTrim);
          this.ybase = Math.max(this.ybase - amountToTrim, 0);
          this.ydisp = Math.max(this.ydisp - amountToTrim, 0);
        }
        this.lines.maxLength = newMaxLength;
      }

      // Make sure that the cursor stays on screen
      this.x = Math.min(this.x, newCols - 1);
      this.y = Math.min(this.y, newRows - 1);
      if (addToY) {
        this.y += addToY;
      }
      this.savedY = Math.min(this.savedY, newRows - 1);
      this.savedX = Math.min(this.savedX, newCols - 1);

      this.scrollTop = 0;
    }

    this.scrollBottom = newRows - 1;
  }

  /**
   * Translates a string index back to a BufferIndex.
   * To get the correct buffer position the string must start at `startCol` 0
   * (default in translateBufferLineToString).
   * The method also works on wrapped line strings given rows were not trimmed.
   * The method operates on the CharData string length, there are no
   * additional content or boundary checks. Therefore the string and the buffer
   * should not be altered in between.
   * TODO: respect trim flag after fixing #1685
   * @param lineIndex line index the string was retrieved from
   * @param stringIndex index within the string
   * @param startCol column offset the string was retrieved from
   */
  public stringIndexToBufferIndex(lineIndex: number, stringIndex: number): BufferIndex {
    while (stringIndex) {
      const line = this.lines.get(lineIndex);
      if (!line) {
        [-1, -1];
      }
      for (let i = 0; i < line.length; ++i) {
        stringIndex -= line.get(i)[CHAR_DATA_CHAR_INDEX].length;
        if (stringIndex < 0) {
          return [lineIndex, i];
        }
      }
      lineIndex++;
    }
    return [lineIndex, 0];
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
    // Only set endCol to the line length when it is null. 0 is a valid column.
    if (endCol === null) {
      endCol = line.length;
    }
    let endIndex = endCol;

    for (let i = 0; i < line.length; i++) {
      const char = line.get(i);
      lineString += char[CHAR_DATA_CHAR_INDEX];
      // Adjust start and end cols for wide characters if they affect their
      // column indexes
      if (char[CHAR_DATA_WIDTH_INDEX] === 0) {
        if (startCol >= i) {
          startIndex--;
        }
        if (endCol > i) {
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

  public getWrappedRangeForLine(y: number): { first: number, last: number } {
    let first = y;
    let last = y;
    // Scan upwards for wrapped lines
    while (first > 0 && this.lines.get(first).isWrapped) {
      first--;
    }
    // Scan downwards for wrapped lines
    while (last + 1 < this.lines.length && this.lines.get(last + 1).isWrapped) {
      last++;
    }
    return { first, last };
  }

  /**
   * Setup the tab stops.
   * @param i The index to start setting up tab stops from.
   */
  public setupTabStops(i?: number): void {
    if (i !== null && i !== undefined) {
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
    if (x === null || x === undefined) {
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
    if (x === null || x === undefined) {
      x = this.x;
    }
    while (!this.tabs[++x] && x < this._terminal.cols);
    return x >= this._terminal.cols ? this._terminal.cols - 1 : x < 0 ? 0 : x;
  }

  public addMarker(y: number): Marker {
    const marker = new Marker(y);
    this.markers.push(marker);
    marker.register(this.lines.addDisposableListener('trim', amount => {
      marker.line -= amount;
      // The marker should be disposed when the line is trimmed from the buffer
      if (marker.line < 0) {
        marker.dispose();
      }
    }));
    marker.register(marker.addDisposableListener('dispose', () => this._removeMarker(marker)));
    return marker;
  }

  private _removeMarker(marker: Marker): void {
    // TODO: This could probably be optimized by relying on sort order and trimming the array using .length
    this.markers.splice(this.markers.indexOf(marker), 1);
  }

  public iterator(trimRight: boolean, startIndex?: number, endIndex?: number, startOverscan?: number, endOverscan?: number): IBufferStringIterator {
    return new BufferStringIterator(this, trimRight, startIndex, endIndex, startOverscan, endOverscan);
  }
}

export class Marker extends EventEmitter implements IMarker {
  private static _nextId = 1;

  private _id: number = Marker._nextId++;
  public isDisposed: boolean = false;

  public get id(): number { return this._id; }

  constructor(
    public line: number
  ) {
    super();
  }

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    // Emit before super.dispose such that dispose listeners get a change to react
    this.emit('dispose');
    super.dispose();
  }
}

/**
 * Iterator to get unwrapped content strings from the buffer.
 * The iterator returns at least the string data between the borders
 * `startIndex` and `endIndex` (exclusive) and will expand the lines
 * by `startOverscan` to the top and by `endOverscan` to the bottom,
 * if no new line was found in between.
 * It will never read/return string data beyond `startIndex - startOverscan`
 * or `endIndex + endOverscan`. Therefore the first and last line might be truncated.
 * It is possible to always get the full string for the first and last line as well
 * by setting the overscan values to the actual buffer length. This not recommended
 * since it might return the whole buffer within a single string in a worst case scenario.
 */
export class BufferStringIterator implements IBufferStringIterator {
  private _current: number;

  constructor (
    private _buffer: IBuffer,
    private _trimRight: boolean,
    private _startIndex: number = 0,
    private _endIndex: number = _buffer.lines.length,
    private _startOverscan: number = 0,
    private _endOverscan: number = 0
  ) {
    if (this._startIndex < 0) {
      this._startIndex = 0;
    }
    if (this._endIndex > this._buffer.lines.length) {
      this._endIndex = this._buffer.lines.length;
    }
    this._current = this._startIndex;
  }

  public hasNext(): boolean {
    return this._current < this._endIndex;
  }

  public next(): IBufferStringIteratorResult {
    const range = this._buffer.getWrappedRangeForLine(this._current);
    // limit search window to overscan value at both borders
    if (range.first < this._startIndex - this._startOverscan) {
      range.first = this._startIndex - this._startOverscan;
    }
    if (range.last > this._endIndex + this._endOverscan) {
      range.last = this._endIndex + this._endOverscan;
    }
    // limit to current buffer length
    range.first = Math.max(range.first, 0);
    range.last = Math.min(range.last, this._buffer.lines.length);
    let result = '';
    for (let i = range.first; i <= range.last; ++i) {
      // TODO: always apply trimRight after fixing #1685
      result += this._buffer.translateBufferLineToString(i, (this._trimRight) ? i === range.last : false);
    }
    this._current = range.last + 1;
    return {range: range, content: result};
  }
}
