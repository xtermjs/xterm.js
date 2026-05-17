/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { CircularList } from 'common/CircularList';
import { Disposable } from 'common/Lifecycle';
import { IAttributeData, IBufferLine, ICellData, ICharset } from 'common/Types';
import { ExtendedAttrs } from 'common/buffer/AttributeData';
import { BufferLine, LogicalLine, DEFAULT_ATTR_DATA } from 'common/buffer/BufferLine';
import { BufferLineStringCache } from 'common/buffer/BufferLineStringCache';
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
export class Buffer extends Disposable implements IBuffer {
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
  /** Reflow may be needed for line indexes less than lastReflowNeeded.
   * I.e. if i >= lastReflowNeeded then lines.get(i).reflowNeeded is false.
   * Lines later in the buffer are more likly to be visible and hence
   * have been updated. */
  public lastReflowNeeded: number = 0;
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
  private readonly _stringCache: BufferLineStringCache;

  constructor(
    private _hasScrollback: boolean,
    private _optionsService: IOptionsService,
    private _bufferService: IBufferService,
    private readonly _logService: ILogService
  ) {
    super();
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
      const first = this.lines.length && this.lines.get(amount);
      if (first instanceof BufferLine && first.isWrapped) {
        const prev = first.getPreviousLine();
        prev && first.asUnwrapped(prev);
      }});
    this.lines.onDelete(event => {
      for (let i = event.amount; --i >= 0; ) {
        this.clearMarkers(event.index + i);
      }
    });
    this._stringCache = this._register(new BufferLineStringCache());
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
  public getBlankLine(
    attr: IAttributeData,
    logicalLine: LogicalLine = new LogicalLine()
  ): IBufferLine {
    logicalLine.backgroundColor = attr.bg & ~0xFC000000;
    return new BufferLine(this._stringCache, this._cols, logicalLine);
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
    this._stringCache.clear();
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
    this._stringCache.clear();

    // Increase max length if needed before adjustments to allow space to fill
    // as required.
    const newMaxLength = this._getCorrectBufferLength(newRows);
    if (newMaxLength > this.lines.maxLength) {
      this.lines.maxLength = newMaxLength;
    }
    const ybaseOld = this.ybase;
    const ydispOld = this.ydisp;
    if (newRows < this._rows || newCols < this._cols) {
      const minHeight = Math.max(this.savedY, this.ybase + this.y) + 1;
      while (this.lines.length > minHeight && this.lines.get(this.lines.length - 1)?.logicalLine.isEmpty()) {
        this.lines.pop();
      }
    }

    if (this._cols !== newCols) {
      const nlines = this.lines.length;
      for (let i = 0; i < nlines; i++) {
        const line = this.lines.get(i) as BufferLine;
        line.length = newCols;
        const logical = line.logicalLine;
        if (! line.isWrapped) {
          if (line.nextBufferLine || logical.length > newCols) {
            logical.reflowNeeded = true;
            this.lastReflowNeeded = Math.max(i, this.lastReflowNeeded);
          }
        }
      }
    }

    // The following adjustments should only happen if the buffer has been
    // initialized/filled.
    if (this.lines.length > 0) {
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
      this.savedX = Math.min(this.savedX, newCols - 1);

      this.scrollTop = 0;
    }

    this.scrollBottom = newRows - 1;

    const lazyReflow = false; // FUTURE - change to true?
    const reflowNow = this._isReflowEnabled && this._cols !== newCols && ! lazyReflow;
    this._cols = newCols;
    this._rows = newRows;
    this.reflowRegion(reflowNow ? 0 : this.ydisp, this.lines.length,
      reflowNow? -1 : newRows);
    this._cols = newCols;
    this._rows = newRows;
    let ypos = Math.max(this.savedY, this.ybase + this.y) + 1;
    if (this._optionsService.rawOptions.windowsPty.backend !== undefined
      || this._optionsService.rawOptions.windowsPty.buildNumber !== undefined) {
      // Just add the new missing rows on Windows as conpty reprints
      // the screen with its view of the world.
      // Once a line enters scrollback for conpty it remains there
      ypos = Math.max(newRows + this.ybase, ypos);
    } else {
      ypos = Math.max(newRows, ypos);
    }
    while (ypos > this.lines.length
      && this.lines.length < this.lines.maxLength) {
      // Add an extra row at the bottom of the viewport
      this.lines.push(new BufferLine(this._stringCache, newCols));
    }

    // Ensure the cursor position invariant: ybase + y must be within buffer bounds
    // This can be violated during reflow or when shrinking rows
    if (this.y < 0) { this.y = 0; } // sanity check shouldn't happen
    if (this.ybase >= this.lines.length) {
      this.ybase = this.lines.length - 1; this.y = 0;
    }
    const newHome = Math.max(0, this.lines.length - newRows);
    this.y += this.ybase - newHome;
    this.ybase = newHome;
    if (this.savedY < 0 || this.savedY >= this.lines.length) {
      this.savedY = 0;
    }

    // Not sure this is the correct approach: It seems we should adjust ydisp
    // depending on reflow/trimming of previous lines, like with do for ybase.
    // (The logic in _reflowRegion does handle the necessary updates.)
    // However, the following is what the testsuite currently expects. --PB
    this.ydisp = ybaseOld === ydispOld ? this.ybase : ydispOld;
  }

  private get _isReflowEnabled(): boolean {
    const windowsPty = this._optionsService.rawOptions.windowsPty;
    if (windowsPty && windowsPty.buildNumber) {
      return this._hasScrollback && windowsPty.backend === 'conpty' && windowsPty.buildNumber >= 21376;
    }
    return this._hasScrollback;
  }

  public reflowRegion(startRow: number, endRow: number, maxRows: number): void {
    if (startRow > this.lastReflowNeeded) {
      return;
    }
    if (endRow >= this.lastReflowNeeded) {
      this.lastReflowNeeded = startRow;
    }
    const reflowCursorLine = this._optionsService.rawOptions.reflowCursorLine;
    const newCols = this._cols;
    while (startRow > 0 && this.lines.get(startRow)?.isWrapped) {
      startRow--;
      if (maxRows >= 0) { maxRows++; }
    }
    const newLines: BufferLine[] = [];
    const yDispOld = this.ydisp;
    const yBaseOld = this.ybase;
    const yAbsOld = yBaseOld + this.y;
    let yAbs = yAbsOld;
    const ySavedOld = this.savedY;
    let ySaved = ySavedOld;
    if (! reflowCursorLine && yAbs >= 0 && yAbs < this.lines.length) {
      const cursorLine = this.lines.get(yAbsOld) as BufferLine;
      cursorLine.logicalLine.reflowNeeded = false;
    }
    let deltaSoFar = 0;
    for (let row = startRow; row < endRow;) {
      if (maxRows >= 0 && newLines.length > maxRows) {
        endRow = row;
        break;
      }
      const line = this.lines.get(row) as BufferLine;
      newLines.push(line);
      const logical = line.logicalLine;
      if (line === logical.firstBufferLine && logical.reflowNeeded) {
        let curLine: BufferLine = line;

        let logicalX;
        let logicalSavedX = this.savedX;
        let oldWrapCount = 0; // number of following wrapped lines
        let nextLine = curLine;
        for (; ; oldWrapCount++) {
          if (yAbsOld === row + oldWrapCount) {
            logicalX = nextLine.startColumn + this.x;
          }
          if (ySavedOld === row + oldWrapCount) {
            logicalSavedX = nextLine.startColumn + this.savedX;
          }
          if (! nextLine.nextBufferLine || row + oldWrapCount + 1 >= endRow) {
            break;
          }
          nextLine = nextLine.nextBufferLine;
        }
        const lineRow = row;
        row++;
        const newWrapStart = newLines.length;
        logical.reflowNeeded = false;
        let startCol = 0;
        for (;;) {
          const endCol = logical.charStart(startCol + newCols);
          if (endCol >= logical.length) {
            curLine.nextBufferLine = undefined;
            curLine.startColumn = startCol;
            break;
          }
          const nextLine = row < endRow && this.lines.get(row);
          let newLine;
          if (nextLine && nextLine.isWrapped) {
            newLine = nextLine as BufferLine;
            newLine.length = newCols;
            row++;
          } else {
            newLine = new BufferLine(this._stringCache, newCols, logical);
          }
          newLines.push(newLine);
          newLine.startColumn = endCol;
          startCol = endCol;
          curLine.nextBufferLine = newLine;
          curLine = newLine;
        }
        while (row < endRow && this.lines.get(row)!.isWrapped) {
          row++;
        }
        const newWrapCount = newLines.length - newWrapStart;
        if (yBaseOld >= lineRow && yBaseOld <= lineRow + oldWrapCount) {
          this.ybase = lineRow + deltaSoFar
            + Math.min(yBaseOld - lineRow, newWrapCount);
        }
        if (yDispOld >= lineRow && yDispOld <= lineRow + oldWrapCount) {
          this.ydisp = lineRow + deltaSoFar
            + Math.min(yDispOld - lineRow, newWrapCount);
        }
        if (logicalX !== undefined) { // update cursor x and y
          let i = newWrapStart;
          while (i < newLines.length && newLines[i].startColumn <= logicalX) { i++; }
          yAbs = startRow + i - 1 + deltaSoFar;
          this.x = logicalX - newLines[i-1].startColumn;
        }
        if (logicalSavedX !== undefined) { // update cursor savedX and savedY
          let i = newWrapStart;
          while (i < newLines.length && newLines[i].startColumn <= logicalSavedX) { i++; }
          ySaved = startRow + i - 1 + deltaSoFar;
          this.savedX = logicalSavedX - newLines[i-1].startColumn;
        }
        deltaSoFar += newWrapCount - oldWrapCount;
      } else {
        if (row === yBaseOld) { this.ybase = yBaseOld + deltaSoFar; }
        if (row === yDispOld) { this.ydisp = yDispOld + deltaSoFar; }
        if (row === yAbsOld) {
          yAbs += deltaSoFar;
        }
        if (row === ySavedOld) {
          ySaved += deltaSoFar;
        }
        row++;
      }
    }
    if (deltaSoFar !== 0) {
      if (yAbsOld >= endRow) { yAbs += deltaSoFar; }
      if (ySavedOld >= endRow) { ySaved += deltaSoFar; }
      if (deltaSoFar > 0) {
        if (yBaseOld >= endRow) { this.ybase = yBaseOld + deltaSoFar; }
        if (yDispOld >= endRow) { this.ydisp = yDispOld + deltaSoFar; }
      }
    }
    const untrimmedLength = this.lines.length + deltaSoFar;
    this.lines.spliceItems(startRow, endRow - startRow, newLines, true);
    const trimmedLength = this.lines.length;
    const trimmedCount = untrimmedLength - trimmedLength;
    yAbs = Math.max(0, yAbs - trimmedCount);
    ySaved = Math.max(0, ySaved - trimmedCount);
    this.ybase = Math.max(0, this.ybase - trimmedCount);
    this.ydisp = Math.max(0, this.ydisp - trimmedCount);
    this.y = yAbs - this.ybase;
    this.savedY = ySaved;
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
