/**
 * Copyright (c) 2017 The xterm.js authors. All rsavedights reserved.
 * @license MIT
 */

import { CircularList, IInsertEvent } from 'common/CircularList';
import { IAttributeData, IBufferLine, ICellData, ICharset } from 'common/Types';
import { ExtendedAttrs } from 'common/buffer/AttributeData';
import { BufferLine, LogicalLine, DEFAULT_ATTR_DATA } from 'common/buffer/BufferLine';
import { reflowLargerApplyNewLayout, reflowLargerCreateNewLayout } from 'common/buffer/BufferReflow';
import { CellData } from 'common/buffer/CellData';
import { NULL_CELL_CHAR, NULL_CELL_CODE, NULL_CELL_WIDTH, WHITESPACE_CELL_CHAR, WHITESPACE_CELL_CODE, WHITESPACE_CELL_WIDTH } from 'common/buffer/Constants';
import { Marker } from 'common/buffer/Marker';
import { IBuffer } from 'common/buffer/Types';
import { DEFAULT_CHARSET } from 'common/data/Charsets';
import { IBufferService, ILogService, IOptionsService } from 'common/services/Services';

export const MAX_BUFFER_SIZE = 4294967295; // 2^32 - 1

/**
 * This class represents a terminal buffer (an internal state of the terminal), where the
 * following information is stored (in high-level):
 *   - text content of this particular buffer
 *   - cursor position
 *   - scroll position
 */
export class Buffer implements IBuffer {
  public lines: CircularList<IBufferLine>;
  public ydisp: number = 0;
  public ybase: number = 0;
  /** Row number, relative to ybase. */
  public y: number = 0;
  public x: number = 0;
  public scrollBottom: number;
  public scrollTop: number;
  public tabs: { [column: number]: boolean | undefined } = {};
  public savedY: number = 0;
  public savedX: number = 0;
  public savedCurAttrData = DEFAULT_ATTR_DATA.clone();
  public savedCharset: ICharset | undefined = DEFAULT_CHARSET;
  public savedCharsets: (ICharset | undefined)[] = [];
  public savedGlevel: number = 0;
  public savedOriginMode: boolean = false;
  public savedWraparoundMode: boolean = true;
  /**
   * This is an expensive operation.
   * @deprecated
   */
  public get markers(): Marker[] {
    const mm: Marker[] = [];
    const nlines = this.lines.length;
    for (let i = 0; i < nlines; i++) {
      const bline = this.lines.get(i) as BufferLine;
      const lline = bline.logicalLine;
      if (lline.firstBufferLine === bline) {
        for (let m = lline._firstMarker; m; m = m._nextMarker) {
          mm.push(m);
        }
      }
    }
    return mm;
  }
  private _nullCell: ICellData = CellData.fromCharData([0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]);
  private _whitespaceCell: ICellData = CellData.fromCharData([0, WHITESPACE_CELL_CHAR, WHITESPACE_CELL_WIDTH, WHITESPACE_CELL_CODE]);
  private _cols: number;
  private _rows: number;
  private _isClearing: boolean = false;

  constructor(
    private _hasScrollback: boolean,
    private _optionsService: IOptionsService,
    private _bufferService: IBufferService,
    private readonly _logService: ILogService
  ) {
    this._cols = this._bufferService.cols;
    this._rows = this._bufferService.rows;
    this.lines = new CircularList<IBufferLine>(this._getCorrectBufferLength(this._rows));
    this.scrollTop = 0;
    this.scrollBottom = this._rows - 1;
    this.setupTabStops();

    this.lines.onTrim(amount => {
      for (let i = 0; i < amount; i++) {
        this.clearMarkers(i);
      }
      const first = this.lines.length && this.lines.get(0);
      if (first instanceof BufferLine && first.isWrapped) {
        const prev = first.getPreviousLine();
        prev && first.asUnwrapped(prev);
      }});
    this.lines.onDelete(event => {
      for (let i = event.amount; --i >= 0; ) {
        this.clearMarkers(event.index + i);
      }
    });
  }

  public getNullCell(attr?: IAttributeData): ICellData {
    if (attr) {
      this._nullCell.fg = attr.fg;
      this._nullCell.bg = attr.bg;
      this._nullCell.extended = attr.extended;
    } else {
      this._nullCell.fg = 0;
      this._nullCell.bg = 0;
      this._nullCell.extended = new ExtendedAttrs();
    }
    return this._nullCell;
  }

  public getWhitespaceCell(attr?: IAttributeData): ICellData {
    if (attr) {
      this._whitespaceCell.fg = attr.fg;
      this._whitespaceCell.bg = attr.bg;
      this._whitespaceCell.extended = attr.extended;
    } else {
      this._whitespaceCell.fg = 0;
      this._whitespaceCell.bg = 0;
      this._whitespaceCell.extended = new ExtendedAttrs();
    }
    return this._whitespaceCell;
  }

  /**
   * Get an empty unwrapped line.
   * @param attr Only used for the background color.
   */
  public getBlankLine(attr: IAttributeData): IBufferLine {
    const lline = new LogicalLine(this._cols);
    lline.backgroundColor = attr.bg & ~0xFC000000;
    return new BufferLine(this._cols, lline);
  }

  public get hasScrollback(): boolean {
    return this._hasScrollback && this.lines.maxLength > this._rows;
  }

  public get isCursorInViewport(): boolean {
    const absoluteY = this.ybase + this.y;
    const relativeY = absoluteY - this.ydisp;
    return (relativeY >= 0 && relativeY < this._rows);
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

    const correctBufferLength = rows + this._optionsService.rawOptions.scrollback;

    return correctBufferLength > MAX_BUFFER_SIZE ? MAX_BUFFER_SIZE : correctBufferLength;
  }

  public setWrapped(absrow: number, value: boolean): void {
    const line = this.lines.get(absrow);
    if (! line || line.isWrapped === value)
    {return;}
    const prevRow = this.lines.get(absrow - 1) as BufferLine;
    if (value) {
      (line as BufferLine).setWrapped(prevRow);
    } else {
      (line as BufferLine).asUnwrapped(prevRow);
    }
  }

  /**
   * Fills the buffer's viewport with blank lines.
   */
  public fillViewportRows(fillAttr?: IAttributeData): void {
    if (this.lines.length === 0) {
      fillAttr ??= DEFAULT_ATTR_DATA;
      let i = this._rows;
      while (i--) {
        this.lines.push(this.getBlankLine(fillAttr));
      }
    }
  }

  /**
   * Clears the buffer to its initial state, discarding all previous data.
   */
  public clear(): void {
    this.ydisp = 0;
    this.ybase = 0;
    this.y = 0;
    this.x = 0;
    this.lines = new CircularList<IBufferLine>(this._getCorrectBufferLength(this._rows));
    this.scrollTop = 0;
    this.scrollBottom = this._rows - 1;
    this.setupTabStops();
  }

  /**
   * Resizes the buffer, adjusting its data accordingly.
   * @param newCols The new number of columns.
   * @param newRows The new number of rows.
   */
  public resize(newCols: number, newRows: number): void {
    // store reference to null cell with default attrs

    // Increase max length if needed before adjustments to allow space to fill
    // as required.
    const newMaxLength = this._getCorrectBufferLength(newRows);
    if (newMaxLength > this.lines.maxLength) {
      this.lines.maxLength = newMaxLength;
    }

    // if (this._cols > newCols) {
    //   console.log('increase!');
    // }

    // The following adjustments should only happen if the buffer has been
    // initialized/filled.
    if (this.lines.length > 0) {
      // Deal with columns increasing (reducing needs to happen after reflow)
      if (this._cols < newCols) {
        for (let i = 0; i < this.lines.length; i++) {
          this.lines.get(i)!.length = newCols;
        }
      }

      // Resize rows in both directions as needed
      let addToY = 0;
      if (this._rows < newRows) {
        for (let y = this._rows; y < newRows; y++) {
          if (this.lines.length < newRows + this.ybase) {
            if (this._optionsService.rawOptions.windowsPty.backend !== undefined || this._optionsService.rawOptions.windowsPty.buildNumber !== undefined) {
              // Just add the new missing rows on Windows as conpty reprints the screen with its
              // view of the world. Once a line enters scrollback for conpty it remains there
              this.lines.push(new BufferLine(newCols));
            } else {
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
                this.lines.push(new BufferLine(newCols));
              }
            }
          }
        }
      } else { // (this._rows >= newRows)
        for (let y = this._rows; y > newRows; y--) {
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
          this.savedY = Math.max(this.savedY - amountToTrim, 0);
        }
        this.lines.maxLength = newMaxLength;
      }

      // Make sure that the cursor stays on screen
      this.x = Math.min(this.x, newCols - 1);
      this.y = Math.min(this.y, newRows - 1);
      if (addToY) {
        this.y += addToY;
      }
      this.savedX = Math.min(this.savedX, newCols - 1);

      this.scrollTop = 0;
    }

    this.scrollBottom = newRows - 1;

    if (this._isReflowEnabled) {
      this._reflow(newCols, newRows);

      // Trim the end of the line off if cols shrunk
      if (this._cols > newCols) {
        for (let i = 0; i < this.lines.length; i++) {
          this.lines.get(i)!.length = newCols;
        }
      }
    }

    this._cols = newCols;
    this._rows = newRows;

    // Ensure the cursor position invariant: ybase + y must be within buffer bounds
    // This can be violated during reflow or when shrinking rows
    if (this.lines.length > 0) {
      const maxY = Math.max(0, this.lines.length - this.ybase - 1);
      this.y = Math.min(this.y, maxY);
    }
  }

  private get _isReflowEnabled(): boolean {
    const windowsPty = this._optionsService.rawOptions.windowsPty;
    if (windowsPty && windowsPty.buildNumber) {
      return this._hasScrollback && windowsPty.backend === 'conpty' && windowsPty.buildNumber >= 21376;
    }
    return this._hasScrollback;
  }

  private _reflow(newCols: number, newRows: number): void {
    if (this._cols === newCols) {
      return;
    }

    // Iterate through rows, ignore the last one as it cannot be wrapped
    if (newCols > this._cols) {
      this._reflowLarger(newCols, newRows);
    } else {
      this._reflowSmaller(newCols, newRows);
    }
  }

  /**
   * Evaluates and returns indexes to be removed after a reflow larger occurs. Lines will be removed
   * when a wrapped line unwraps.
   * @param lines The buffer lines.
   * @param oldCols The columns before resize
   * @param newCols The columns after resize.
   * @param bufferAbsoluteY The absolute y position of the cursor (baseY + cursorY).
   * @param nullCell The cell data to use when filling in empty cells.
   * @param reflowCursorLine Whether to reflow the line containing the cursor.
   */
  private _reflowLargerGetLinesToRemove(lines: CircularList<IBufferLine>, oldCols: number, newCols: number, bufferAbsoluteY: number, nullCell: ICellData, reflowCursorLine: boolean): number[] {
  // Gather all BufferLines that need to be removed from the Buffer here so that they can be
  // batched up and only committed once
    const toRemove: number[] = [];

    for (let y = 0; y < lines.length - 1; y++) {
      // Check if this row is wrapped
      let i = y;
      let nextLine = lines.get(++i) as BufferLine;
      if (!nextLine.isWrapped) {
        continue;
      }

      // Check how many lines it's wrapped for
      const wrappedLines: BufferLine[] = [lines.get(y) as BufferLine];
      while (i < lines.length && nextLine.isWrapped) {
        wrappedLines.push(nextLine);
        nextLine = lines.get(++i) as BufferLine;
      }

      if (!reflowCursorLine) {
        // If these lines contain the cursor don't touch them, the program will handle fixing up
        // wrapped lines with the cursor
        if (bufferAbsoluteY >= y && bufferAbsoluteY < i) {
          y += wrappedLines.length - 1;
          continue;
        }
      }
      const oldWrapped = wrappedLines.length;
      this._reflowLine(wrappedLines, newCols);

      // Work backwards and remove any rows at the end that only contain null cells
      const countToRemove = oldWrapped - wrappedLines.length;
      if (countToRemove > 0) {
        toRemove.push(y + oldWrapped - countToRemove); // index
        toRemove.push(countToRemove);
      }

      y += oldWrapped - 1;
    }
    return toRemove;
  }

  private _reflowLarger(newCols: number, newRows: number): void {
    const reflowCursorLine = this._optionsService.rawOptions.reflowCursorLine;
    const toRemove: number[] = this._reflowLargerGetLinesToRemove(this.lines, this._cols, newCols, this.ybase + this.y, this.getNullCell(DEFAULT_ATTR_DATA), reflowCursorLine);
    if (toRemove.length > 0) {
      const newLayoutResult = reflowLargerCreateNewLayout(this.lines, toRemove);
      reflowLargerApplyNewLayout(this.lines, newLayoutResult.layout);
      this._reflowLargerAdjustViewport(newCols, newRows, newLayoutResult.countRemoved);
    }
  }

  private _reflowLargerAdjustViewport(newCols: number, newRows: number, countRemoved: number): void {
    // Adjust viewport based on number of items removed
    let viewportAdjustments = countRemoved;
    while (viewportAdjustments-- > 0) {
      if (this.ybase === 0) {
        if (this.y > 0) {
          this.y--;
        }
        if (this.lines.length < newRows) {
          // Add an extra row at the bottom of the viewport
          this.lines.push(new BufferLine(newCols));
        }
      } else {
        if (this.ydisp === this.ybase) {
          this.ydisp--;
        }
        this.ybase--;
      }
    }
    this.savedY = Math.max(this.savedY - countRemoved, 0);
  }
  private _reflowLine(wrappedLines: BufferLine[], newCols: number): BufferLine[] {
    const newLines: BufferLine[] = [];
    let startCol = 0;
    let curRow = 1;
    let curLine = wrappedLines[0];
    const logical = curLine.logicalLine;
    for (;;) {
      const endCol = logical.charStart(startCol + newCols);
      if (endCol >= logical.length) {
        curLine.nextBufferLine = undefined;
        curLine.startColumn = startCol;
        break;
      }
      let newLine;
      if (curRow < wrappedLines.length) {
        newLine = wrappedLines[curRow];
        newLine.length = newCols;
      } else {
        newLine = new BufferLine(newCols, logical);
        newLines.push(newLine);
      }
      curRow++;
      newLine.startColumn = endCol;
      startCol = endCol;
      curLine.nextBufferLine = newLine;
      curLine = newLine;
    }
    if (curRow < wrappedLines.length) {
      wrappedLines.length = curRow;
    }
    return newLines;
  }

  private _reflowSmaller(newCols: number, newRows: number): void {
    const reflowCursorLine = this._optionsService.rawOptions.reflowCursorLine;
    // Gather all BufferLines that need to be inserted into the Buffer here so that they can be
    // batched up and only committed once
    const toInsert = [];
    let countToInsert = 0;
    // Go backwards as many lines may be trimmed and this will avoid considering them
    for (let y = this.lines.length - 1; y >= 0; y--) {
      // Check whether this line is a problem
      let nextLine = this.lines.get(y) as BufferLine;
      if (!nextLine || !nextLine.isWrapped && nextLine.getTrimmedLength() <= newCols) {
        continue;
      }
      // Gather wrapped lines and adjust y to be the starting line
      const wrappedLines: BufferLine[] = [nextLine];
      while (nextLine.isWrapped && y > 0) {
        nextLine = this.lines.get(--y) as BufferLine;
        wrappedLines.unshift(nextLine);
      }

      if (!reflowCursorLine) {
        // If these lines contain the cursor don't touch them, the program will handle fixing up
        // wrapped lines with the cursor
        const absoluteY = this.ybase + this.y;
        if (absoluteY >= y && absoluteY < y + wrappedLines.length) {
          continue;
        }
      }
      const newLines = this._reflowLine(wrappedLines, newCols);
      const linesToAdd = newLines.length;
      let trimmedLines: number;
      if (this.ybase === 0 && this.y !== this.lines.length - 1) {
        // If the top section of the buffer is not yet filled
        trimmedLines = Math.max(0, this.y - this.lines.maxLength + linesToAdd);
      } else {
        trimmedLines = Math.max(0, this.lines.length - this.lines.maxLength + linesToAdd);
      }

      if (newLines.length > 0) {
        toInsert.push({
          // countToInsert here gets the actual index, taking into account other inserted items.
          // using this we can iterate through the list forwards
          start: y + wrappedLines.length + countToInsert,
          newLines
        });
        countToInsert += newLines.length;
        wrappedLines.push(...newLines);
      }
      // Adjust viewport as needed
      let viewportAdjustments = linesToAdd - trimmedLines;
      while (viewportAdjustments-- > 0) {
        if (this.ybase === 0) {
          if (this.y < newRows - 1) {
            this.y++;
            this.lines.pop();
          } else {
            this.ybase++;
            this.ydisp++;
          }
        } else {
          // Ensure ybase does not exceed its maximum value
          if (this.ybase < Math.min(this.lines.maxLength, this.lines.length + countToInsert) - newRows) {
            if (this.ybase === this.ydisp) {
              this.ydisp++;
            }
            this.ybase++;
          }
        }
      }
      this.savedY = Math.min(this.savedY + linesToAdd, this.ybase + newRows - 1);
    }

    // Rearrange lines in the buffer if there are any insertions, this is done at the end rather
    // than earlier so that it's a single O(n) pass through the buffer, instead of O(n^2) from many
    // costly calls to CircularList.splice.
    if (toInsert.length > 0) {
      // Record buffer insert events and then play them back backwards so that the indexes are
      // correct
      const insertEvents: IInsertEvent[] = [];

      // Record original lines so they don't get overridden when we rearrange the list
      const originalLines: BufferLine[] = [];
      for (let i = 0; i < this.lines.length; i++) {
        originalLines.push(this.lines.get(i) as BufferLine);
      }
      const originalLinesLength = this.lines.length;

      let originalLineIndex = originalLinesLength - 1;
      let nextToInsertIndex = 0;
      let nextToInsert = toInsert[nextToInsertIndex];
      this.lines.length = Math.min(this.lines.maxLength, this.lines.length + countToInsert);
      let countInsertedSoFar = 0;
      for (let i = Math.min(this.lines.maxLength - 1, originalLinesLength + countToInsert - 1); i >= 0; i--) {
        if (nextToInsert && nextToInsert.start > originalLineIndex + countInsertedSoFar) {
          // Insert extra lines here, adjusting i as needed
          for (let nextI = nextToInsert.newLines.length - 1; nextI >= 0; nextI--) {
            this.lines.set(i--, nextToInsert.newLines[nextI]);
          }
          i++;

          // Create insert events for later
          insertEvents.push({
            index: originalLineIndex + 1,
            amount: nextToInsert.newLines.length
          });

          countInsertedSoFar += nextToInsert.newLines.length;
          nextToInsert = toInsert[++nextToInsertIndex];
        } else {
          this.lines.set(i, originalLines[originalLineIndex--]);
        }
      }

      const amountToTrim = Math.max(0, originalLinesLength + countToInsert - this.lines.maxLength);
      if (amountToTrim > 0) {
        for (let i = 0; i < amountToTrim; i++) {
          this.clearMarkers(i);
        }
      }
    }
  }

  /**
   * Translates a buffer line to a string, with optional start and end columns.
   * Wide characters will count as two columns in the resulting string. This
   * function is useful for getting the actual text underneath the raw selection
   * position.
   * @param lineIndex The absolute index of the line being translated.
   * @param trimRight Whether to trim whitespace to the right.
   * @param startCol The column to start at.
   * @param endCol The column to end at.
   */
  public translateBufferLineToString(lineIndex: number, trimRight: boolean, startCol: number = 0, endCol?: number): string {
    const line = this.lines.get(lineIndex);
    if (!line) {
      return '';
    }
    return line.translateToString(trimRight, startCol, endCol);
  }

  public getWrappedRangeForLine(y: number): { first: number, last: number } {
    let first = y;
    let last = y;
    // Scan upwards for wrapped lines
    while (first > 0 && this.lines.get(first)!.isWrapped) {
      first--;
    }
    // Scan downwards for wrapped lines
    while (last + 1 < this.lines.length && this.lines.get(last + 1)!.isWrapped) {
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

    for (; i < this._cols; i += this._optionsService.rawOptions.tabStopWidth) {
      this.tabs[i] = true;
    }
  }

  /**
   * Move the cursor to the previous tab stop from the given position (default is current).
   * @param x The position to move the cursor to the previous tab stop.
   */
  public prevStop(x?: number): number {
    x ??= this.x;
    while (!this.tabs[--x] && x > 0);
    return x >= this._cols ? this._cols - 1 : x < 0 ? 0 : x;
  }

  /**
   * Move the cursor one tab stop forward from the given position (default is current).
   * @param x The position to move the cursor one tab stop forward.
   */
  public nextStop(x?: number): number {
    x ??= this.x;
    while (!this.tabs[++x] && x < this._cols);
    return x >= this._cols ? this._cols - 1 : x < 0 ? 0 : x;
  }

  /**
   * Clears markers on single line.
   * @param y The line to clear.
   */
  public clearMarkers(y: number): void {
    this._isClearing = true;
    (this.lines.get(y) as BufferLine).clearMarkers();
    this._isClearing = false;
  }

  /**
   * Clears markers on all lines
   * Must be called before removing lines from Buffer.
   * Only used for the alt buffer, which should be small.
   */
  public clearAllMarkers(): void {
    this._isClearing = true;
    const nlines = this.lines.length;
    for (let i = 0; i < nlines; i++) {
      this.clearMarkers(i);
    }
    this._isClearing = false;
  }

  public addMarker(y: number, x?: number, marker?: Marker): Marker {
    const bline = this.lines.get(y) as BufferLine;
    const lline = bline.logicalLine;
    const m = marker ?? new Marker();
    m.addToLine(this, lline, x ?? bline.startColumn);
    return m;
  }
}
