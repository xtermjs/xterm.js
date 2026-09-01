/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { CharData, IAttributeData, IBufferLine, ILogicalLine, ICellData, IExtendedAttrs } from './Types';
import { AttributeData } from './AttributeData';
import { CellData } from './CellData';
import { Attributes, BgFlags, Content, NULL_CELL_CHAR, NULL_CELL_CODE, NULL_CELL_WIDTH, WHITESPACE_CELL_CHAR } from './Constants';
import { stringFromCodePoint } from '../input/TextDecoder';

// Buffer memory layout:
//
// [0]: content `uint32_t` - wcwidth(2) comb(1) codepoint(21)
// [1]: fg      `uint32_t` - flags(8) r(8) g(8) b(8)
// [2]: bg      `uint32_t` - flags(8) r(8) g(8) b(8)

const enum Constants {
  /** The number of 32 bit array indices taken by one cell. */
  CELL_INDICIES = 3,
  /** Factor when to cleanup underlying array buffer after shrinking. */
  CLEANUP_THRESHOLD = 2
}

/*
 * Column count within current visible BufferLine(row).
 * The left-most column is column 0.
 */
export type BufferColumn = number;

/*
 * Column count within current LogicalLine.
 * If the display is 80 columns wide, then LineColumn of the left-most
 * character of the first wrapped line would normally be 80.
 * (It might be 79 if the character at column 79 is double-width.)
 */
export type LogicalColumn = number;

/**
 * Cell member indices.
 *
 * Direct access:
 *    `content = data[column * Constants.CELL_INDICIES + Cell.CONTENT];`
 *    `fg = data[column * Constants.CELL_INDICIES + Cell.FG];`
 *    `bg = data[column * Constants.CELL_INDICIES + Cell.BG];`
 */
const enum Cell {
  CONTENT = 0,
  FG = 1, // currently simply holds all known attrs
  BG = 2  // currently unused
}


interface IExtendedAttrsExt extends IExtendedAttrs {
  _ext: number;
  _urlId: number;
}


export const DEFAULT_ATTR_DATA = Object.freeze(new AttributeData());

// Work variables to avoid garbage collection
const $workCell = new CellData();
const $extended = DEFAULT_ATTR_DATA.extended.clone() as IExtendedAttrsExt;


const EMPTY_DATA = new Uint32Array(0);

/*
 * The data "model" of a line ignoring line wrapping.
 */
export class LogicalLine implements ILogicalLine {
  /**
   * Available for this line is _data.subarray(_dstaStart, _dataStart + _dataLength)
   * @internal
   */
  public _data: Uint32Array;
  public _dataStart: number = 0;
  public _dataLength: number = 0;
  /** Sparse cache; only read when `IS_COMBINED_MASK` is set in `_data`. */
  public _combined: {[index: LogicalColumn]: string} = {};
  /**
   * @internal
   */
  public _extendedAttrs: {[index: LogicalColumn]: IExtendedAttrs | undefined} = {};

  public reflowNeeded: boolean = false;
  public firstBufferLine: BufferLine | undefined;
  public backgroundColor: number = 0;
  /**
   * Logical "trimmed" length of line.
   * Must be no more than this._dataLength / 3.
   */
  public length: number = 0;

  constructor(cols: number = 0, data: Uint32Array = cols === 0 ? EMPTY_DATA : new Uint32Array(cols * Constants.CELL_INDICIES), start: number = 0, dlength: number = data.length - start) {
    this._data = data;
    this._dataStart = start;
    this._dataLength = dlength;
  }
  public setData(data: Uint32Array, start: number, dlength: number): void {
    this._data = data;
    this._dataStart = start;
    this._dataLength = dlength;
    this.length = 0;
    this._combined = {};
    this._extendedAttrs = {};
  }

  /**
   * @internal
   */
  public resizeData(cols: number, allocateBigBlock: number = 0): void {
    const uint32Cells = cols * Constants.CELL_INDICIES;
    const oldLength = this._dataLength;
    if (uint32Cells >= oldLength) {
      // increase by at least 50%
      const newLength = Math.max(uint32Cells + 60,
        allocateBigBlock ? allocateBigBlock * 3 : (3 * oldLength) >> 1);
      const data = new Uint32Array(newLength);
      for (let i = 3 * this.length; --i >= 0; ) {
        data[i] = this._data[this._dataStart + i];
      }
      this._data = data;
      this._dataStart = 0;
      this._dataLength = newLength;
    }
  }

  public getWidth(index: LogicalColumn): number {
    return index >= this.length ? NULL_CELL_WIDTH
      : this._data[this._dataStart + index * Constants.CELL_INDICIES + Cell.CONTENT] >> Content.WIDTH_SHIFT;
  }

  /**
   * Usually same as argument, but adjust if wide or at end.
   * @internal
   */
  public charStart(column: LogicalColumn): number {
    return column > this.length ? this.length
      : column > 0 && this.getWidth(column - 1) > 1 ? column - 1
        : column;
  }

  /**
   * Load data at `index` into `cell`.
   */
  public loadCell(index: LogicalColumn, cell: ICellData): ICellData {
    if (index >= this.length) {
      cell.content = NULL_CELL_WIDTH << Content.WIDTH_SHIFT;
      cell.fg = 0;
      cell.bg = this.backgroundColor;
      return cell;
    }
    const startIndex = this._dataStart + index * Constants.CELL_INDICIES;
    cell.content = this._data[startIndex + Cell.CONTENT];
    cell.fg = this._data[startIndex + Cell.FG];
    cell.bg = this._data[startIndex + Cell.BG];
    if (cell.content & Content.IS_COMBINED_MASK) {
      cell.combinedData = this._combined[index];
    } else {
      cell.combinedData = '';
    }
    if (cell.bg & BgFlags.HAS_EXTENDED) {
      cell.extended = this._extendedAttrs[index]!;
    } else {
      // Do not mutate cell.extended in place: it may still reference this line's map entry from a
      // prior loadCell into a reused CellData (e.g. $workCell during insert/dele
      // We use $extended as blueprint and reset the internals
      // mimicking the ctor to avoid a new allocation.
      $extended._ext = 0;
      $extended._urlId = 0;
      $extended.payload = undefined;
      cell.extended = $extended;
    }

    return cell;
  }

  public getExtended(index: LogicalColumn, validEnd: LogicalColumn = this.length): IExtendedAttrs | undefined {
    return index < this.length
      && (this._data[this._dataStart + index * Constants.CELL_INDICIES + Cell.BG] & BgFlags.HAS_EXTENDED)
      ? this._extendedAttrs[index]
      : undefined;
  }

  /** Returns the string content of the cell. */
  public getString(index: number): string {
    const content = this._data[this._dataStart + index * Constants.CELL_INDICIES + Cell.CONTENT];
    if (content & Content.IS_COMBINED_MASK) {
      return this._combined[index];
    }
    if (content & Content.CODEPOINT_MASK) {
      return stringFromCodePoint(content & Content.CODEPOINT_MASK);
    }
    // return empty string for empty cells
    return '';
  }

  /** Get state of protected flag. */
  public isProtected(index: number): number {
    return this._data[this._dataStart + index * Constants.CELL_INDICIES + Cell.BG] & BgFlags.PROTECTED;
  }

  /**
   * Set cell data from input handler.
   * Since the input handler see the incoming chars as UTF32 codepoints,
   * it gets an optimized access method.
   * Warning - does not invalidatw the string cache - callers should do so.
   * @internal
   */
  public setCellFromCodepoint(index: LogicalColumn, codePoint: number, width: number, attrs: IAttributeData): void {
    if (codePoint === 0 && width === 1 && index >= this.length - 1 && attrs.fg === 0 && attrs.bg === this.backgroundColor) {
      if (index === this.length - 1) {
        // FIXME should also truncate extendedAttrs and composedData
        this.length = index; // this.length - 1;
        this.trimLength();
      }
      return;
    }
    if (index >= this.length) {
      this.resizeData(index + 1);
      let j = this._dataStart + this.length * Constants.CELL_INDICIES;
      for (let i = this.length; i < index; i++) {
        this._data[j + Cell.CONTENT] = NULL_CELL_WIDTH << Content.WIDTH_SHIFT;
        this._data[j + Cell.FG] = 0;
        this._data[j + Cell.BG] = this.backgroundColor;
        j += Constants.CELL_INDICIES;
      }
      this.length = index + 1;
    }
    if (attrs.bg & BgFlags.HAS_EXTENDED) {
      this._extendedAttrs[index] = attrs.extended;
    }
    const j = this._dataStart + index * Constants.CELL_INDICIES;
    this._data[j + Cell.CONTENT] = codePoint | (width << Content.WIDTH_SHIFT);
    this._data[j + Cell.FG] = attrs.fg;
    this._data[j + Cell.BG] = attrs.bg;
  }

  public setCellsFromCodepoints(index: LogicalColumn, cols: number, codePoints: Uint32Array, start: number, end: number, attrs: IAttributeData, allocateBigBlock: number = 0): void {
    if (index + cols >= this.length) {
      this.resizeData(index + cols, allocateBigBlock);
      for (let i = this.length; i < index; i++) {
        const j = this._dataStart + i * Constants.CELL_INDICIES;
        this._data[j + Cell.CONTENT] = NULL_CELL_WIDTH << Content.WIDTH_SHIFT;
        this._data[j + Cell.FG] = 0;
        this._data[j + Cell.BG] = this.backgroundColor;
      }
      this.length = index + cols;
    }
    const data = this._data;
    const fg = attrs.fg;
    const bg = attrs.bg;
    const ext = (attrs.bg & BgFlags.HAS_EXTENDED) ? attrs.extended : undefined;
    let j = this._dataStart + index * Constants.CELL_INDICIES;
    for (let i = start; i < end; i++) {
      const contents = codePoints[i];
      let width = (contents >>> Content.WIDTH_SHIFT);
      data[j + Cell.CONTENT] = contents;
      data[j + Cell.FG] = fg;
      data[j + Cell.BG] = bg;
      ext && (this._extendedAttrs[index] = ext);
      j += 3; index++;
      while (--width > 0) {
        data[j + Cell.CONTENT] = 0;
        data[j + Cell.FG] = fg;
        data[j + Cell.BG] = bg;
        ext && (this._extendedAttrs[index] = ext);
        j += 3; index++;
      }
    }
  }

  /**
   * @internal
   */
  public trimLength(): void {
    let index = this.length;
    while (index > 0) {
      index--;
      const j = this._dataStart + index * Constants.CELL_INDICIES;
      const content = this._data[j + Cell.CONTENT];
      if (content & Content.HAS_CONTENT_MASK) {
        index++;
        break;
      }
    }
    if (index < this.length) {
      this.length = index;
      for (let line = this.firstBufferLine; line; line = line.nextBufferLine) {
        if (line.startColumn > index) {
          line.startColumn = index;
        }
      }
      // FIXME - possible optimization - trim _data _combinedData _extendedAttrs
    }
  }

  /**
   * Warning - does not invalidate string cache.
   */
  public copyCellsFrom(src: LogicalLine, srcCol: number, dstCol: number, length: number, applyInReverse: boolean): void {
    let cell = applyInReverse ? length - 1 : 0;
    const cellIncrement = applyInReverse ? -1 : 1;
    for (let todo = length; --todo >= 0; cell += cellIncrement) {
      src.loadCell(srcCol + cell, $workCell);
      const dstIndex = dstCol + cell;
      const content = $workCell.content & (Content.CODEPOINT_MASK|Content.IS_COMBINED_MASK);
      this.setCellFromCodepoint(dstIndex, content, $workCell.getWidth(), $workCell);
      if (content & Content.IS_COMBINED_MASK) {
        this._combined[dstIndex] = $workCell.combinedData;
      }
    }
  }

  /**
   * Translates the buffer line to a string.
   *
   * @param startCol The column to start the string (0-based inclusive).
   * @param endCol The column to end the string (0-based exclusive).
   * @param dataLength ignore _data after dataLength
   * @param outColumns if specified, this array will be filled with column numbers such that
   * `returnedString[i]` is displayed at `outColumns[i]` column. `outColumns[returnedString.length]`
   * is where the character following `returnedString` will be displayed.
   *
   * When a single cell is translated to multiple UTF-16 code units (e.g. surrogate pair) in the
   * returned string, the corresponding entries in `outColumns` will have the same column number.
   */
  public translateToString(startCol?: number, endCol?: number, dataLength: number = this.length, outColumns?: number[]): string {
    startCol = startCol ?? 0;
    endCol = endCol ?? this.length;
    if (outColumns) {
      outColumns.length = 0;
    }
    const cellContents: string[] = [];
    while (startCol < endCol) {
      const content = startCol >= dataLength ? 0
        : this._data[this._dataStart + startCol * Constants.CELL_INDICIES + Cell.CONTENT];
      const cp = content & Content.CODEPOINT_MASK;
      const chars = (content & Content.IS_COMBINED_MASK) ? this._combined[startCol] : (cp) ? stringFromCodePoint(cp) : WHITESPACE_CELL_CHAR;
      cellContents.push(chars);
      if (outColumns) {
        for (let i = 0; i < chars.length; ++i) {
          outColumns.push(startCol);
        }
      }
      startCol += (content >> Content.WIDTH_SHIFT) || 1; // always advance by at least 1
    }
    if (outColumns) {
      outColumns.push(startCol);
    }
    const result = cellContents.join('');
    return result;
  }
}

/**
 * Typed array based bufferline implementation.
 *
 * There are 2 ways to insert data into the cell buffer:
 * - `setCellFromCodepoint` + `addCodepointToCell`
 *   Use these for data that is already UTF32.
 *   Used during normal input in `InputHandler` for faster buffer access.
 * - `setCell`
 *   This method takes a CellData object and stores the data in the buffer.
 *   Use `CellData.fromCharData` to create the CellData object (e.g.0 f from JS string).
 *
 * To retrieve data from the buffer use either one of the primitive methods
 * (if only one particular value is needed) or `loadCell`. For `loadCell` in a loop
 * memory allocs / GC pressure can be greatly reduced by reusing the CellData object.
 */
export class BufferLine implements IBufferLine {
  private _logicalLine: LogicalLine;
  public logical(): LogicalLine { return this._logicalLine; }
  public nextBufferLine: BufferLine | undefined;

  /**
   * Number of logical columns in previous rows.
   * Also: logical column number (column number assuming infinitely-wide
   * terminal) corresponding to the start of this row.
   * If R is the row number (0 for the first BufferLine for a LogicalLine),
   * If R is 0 for the previous LogicalBufferLine, R is 1 for first
   * then startColumn will *usually* be N*W (where W is the width of
   * the terminal in columns) but may be slightly
   * different when a wide character at column W-1 must wrap "early".
   */
  public startColumn: number = 0;

  public length: number;

  /** line text cache */
  public _cacheValid = false;
  protected _cache: string = '';
  protected _cacheTrimmed = false;

  /**
   * Last LogicalColumn of this BufferLine.
   * @internal
   */
  public get validEnd(): LogicalColumn {
    return this.nextBufferLine ? this.nextBufferLine.startColumn : this._logicalLine.length;
  }

  constructor(cols: number,
    logicalLine = new LogicalLine(cols)
  ) {
    this._logicalLine = logicalLine;
    this.length = cols;
    logicalLine.firstBufferLine ??= this;
  }
  public reinit(cols: number,
    logicalLine: LogicalLine): void {
    this._logicalLine = logicalLine;
    this.length = cols;
    logicalLine.firstBufferLine ??= this;
    this._cacheValid = false;
    this._cache = '';
    this.startColumn = 0;
  }

  public get isWrapped(): boolean {
    return this._logicalLine.firstBufferLine !== this;
  }

  /**
   * Get cell data CharData.
   * @deprecated
   */
  public get(index: BufferColumn): CharData {
    const lline = this._logicalLine;
    const lindex: LogicalColumn = index + this.startColumn;
    if (lindex >= this.validEnd) {
      return [0, '', NULL_CELL_WIDTH, 0];
    }
    const content = lline._data[lline._dataStart + index * Constants.CELL_INDICIES + Cell.CONTENT];
    const cp = content & Content.CODEPOINT_MASK;
    return [
      lline._data[lline._dataStart + lindex * Constants.CELL_INDICIES + Cell.FG],
      (content & Content.IS_COMBINED_MASK)
        ? lline._combined[lindex]
        : (cp) ? stringFromCodePoint(cp) : '',
      content >> Content.WIDTH_SHIFT,
      (content & Content.IS_COMBINED_MASK)
        ? lline._combined[lindex].charCodeAt(lline._combined[lindex].length - 1)
        : cp
    ];
  }

  /**
   * Set cell data from CharData.
   * @deprecated
   */
  public set(index: number, value: CharData): void {
    this.setCell(index, CellData.fromCharData(value));
  }

  /**
   * primitive getters
   * use these when only one value is needed, otherwise use `loadCell`
   */
  public getWidth(index: number): number {
    const lindex: LogicalColumn = index + this.startColumn;
    return lindex >= this.validEnd ? NULL_CELL_WIDTH
      : this._logicalLine.getWidth(lindex);
  }

  /** Test whether content has width. */
  public hasWidth(index: number): number {
    return this.getWidth(index);
  }

  /** Get FG cell component. */
  public getFg(index: number): number {
    const lline = this._logicalLine;
    const lcolumn = index + this.startColumn;
    return lcolumn >= this.validEnd ? 0 : lline._data[lline._dataStart + lcolumn * Constants.CELL_INDICIES + Cell.FG];
  }

  /** Get BG cell component. */
  public getBg(index: number): number {
    index += this.startColumn;
    const lline = this._logicalLine;
    return index > lline.length ? lline.backgroundColor
      : lline._data[lline._dataStart + index * Constants.CELL_INDICIES + Cell.BG];
  }

  /**
   * Test whether contains any chars.
   * Basically an empty has no content, but other cells might differ in FG/BG
   * from real empty cells.
   */
  public hasContent(index: number): number {
    index += this.startColumn;
    if (index >= this.validEnd) {
      return 0;
    }
    const lline = this._logicalLine;
    return lline._data[lline._dataStart + index * Constants.CELL_INDICIES + Cell.CONTENT] & Content.HAS_CONTENT_MASK;
  }

  /**
   * Get codepoint of the cell.
   * To be in line with `code` in CharData this either returns
   * a single UTF32 codepoint or the last codepoint of a combined string.
   */
  public getCodePoint(index: BufferColumn): number {
    const lline = this._logicalLine;
    const lcolumn: LogicalColumn = index + this.startColumn;
    if (lcolumn >= this.validEnd) {
      return 0;
    }
    const content = lline._data[lline._dataStart + lcolumn * Constants.CELL_INDICIES + Cell.CONTENT];
    if (content & Content.IS_COMBINED_MASK) {
      const combined = lline._combined[lcolumn];
      return combined.charCodeAt(combined.length - 1);
    }
    return content & Content.CODEPOINT_MASK;
  }

  /** Test whether the cell contains a combined string. */
  public isCombined(index: number): number {
    const lline = this._logicalLine;
    const lcolumn: LogicalColumn = index + this.startColumn;
    if (lcolumn >= this.validEnd) {
      return 0;
    }
    return lline._data[lline._dataStart + lcolumn * Constants.CELL_INDICIES + Cell.CONTENT] & Content.IS_COMBINED_MASK;
  }

  /** Returns the string content of the cell. */
  public getString(index: number): string {
    const lline = this._logicalLine;
    const lcolumn: LogicalColumn = index + this.startColumn;
    if (lcolumn >= this.validEnd) {
      return '';
    }
    const content = lline._data[lline._dataStart + lcolumn * Constants.CELL_INDICIES + Cell.CONTENT];
    if (content & Content.IS_COMBINED_MASK) {
      return lline._combined[lcolumn];
    }
    if (content & Content.CODEPOINT_MASK) {
      return stringFromCodePoint(content & Content.CODEPOINT_MASK);
    }
    // return empty string for empty cells
    return '';
  }

  /** Get state of protected flag. */
  public isProtected(index: number): number {
    const lline = this._logicalLine;
    const lcolumn = index + this.startColumn;
    return index >= this.length || lcolumn >= lline.length ? 0
      : lline._data[lline._dataStart + lcolumn * Constants.CELL_INDICIES + Cell.BG] & BgFlags.PROTECTED;
  }

  /**
   * Load data at `index` into `cell`. This is used to access cells in a way that's more friendly
   * to GC as it significantly reduced the amount of new objects/references needed.
   */
  public loadCell(index: number, cell: ICellData): ICellData {
    const lline = this._logicalLine;
    const lcolumn = index + this.startColumn;
    const lend = this.validEnd;
    if (lcolumn >= lend) {
      cell.content = NULL_CELL_CODE | (NULL_CELL_WIDTH << Content.WIDTH_SHIFT);
      cell.fg = 0;
      if (this.nextBufferLine) {
        cell.bg = 0; // FIXME
      } else {
        cell.bg = lline.backgroundColor;
      }
      return cell;
    }
    return lline.loadCell(lcolumn, cell);
  }

  public getExtended(index: number): IExtendedAttrs | undefined {
    const lline = this._logicalLine;
    const lcolumn = index + this.startColumn;
    return lline.getExtended(lcolumn, this.validEnd);
  }

  /**
   * Set data at `index` to `cell`.
   */
  public setCell(index: number, cell: ICellData): void {
    this._cacheValid = false;
    // this.logicalLine.setCell(index + this.startColumn, cell);
    const content = cell.content & (Content.CODEPOINT_MASK|Content.IS_COMBINED_MASK);
    this.setCellFromCodepoint(index, content, cell.getWidth(), cell);
    if (cell.content & Content.IS_COMBINED_MASK) {
      this._logicalLine._combined[index + this.startColumn] = cell.combinedData;
    }
  }

  /**
   * Set cell data from input handler.
   * Since the input handler see the incoming chars as UTF32 codepoints,
   * it gets an optimized access method.
   */
  public setCellFromCodepoint(index: number, codePoint: number, width: number, attrs: IAttributeData): void {
    this._cacheValid = false;
    this._logicalLine.setCellFromCodepoint(index + this.startColumn,
      codePoint, width, attrs);
  }
  public setCellsFromCodepoints(index: number, cols: number, codePoints: Uint32Array, start: number, end: number, attrs: IAttributeData, allocateBigBlock: number = 0): void {
    this._cacheValid = false;
    this._logicalLine.setCellsFromCodepoints(index + this.startColumn, cols, codePoints, start, end, attrs, allocateBigBlock);
  }

  /**
   * Add a codepoint to a cell from input handler.
   * During input stage combining chars with a width of 0 follow and stack
   * onto a leading char. Since we already set the attrs
   * by the previous `setDataFromCodePoint` call, we can omit it here.
   */
  public addCodepointToCell(index: number, codePoint: number, width: number): void {
    this._cacheValid = false;
    const lline = this._logicalLine;
    const lcolumn = index + this.startColumn;
    if (lcolumn >= this.validEnd) {
      // should not happen - we actually have no data in the cell yet
      // simply set the data in the cell buffer with a width of 1
      this.setCellFromCodepoint(index, codePoint, 1, CellData.fromCharData([0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]));
      return;
    }
    let content = lline._data[lline._dataStart + lcolumn * Constants.CELL_INDICIES + Cell.CONTENT];
    if (content & Content.IS_COMBINED_MASK) {
      // we already have a combined string, simply add
      lline._combined[lcolumn] += stringFromCodePoint(codePoint);
    } else {
      if (content & Content.CODEPOINT_MASK) {
        // normal case for combining chars:
        //  - move current leading char + new one into combined string
        //  - set combined flag
        lline._combined[lcolumn] = stringFromCodePoint(content & Content.CODEPOINT_MASK) + stringFromCodePoint(codePoint);
        content &= ~Content.CODEPOINT_MASK; // set codepoint in buffer to 0
        content |= Content.IS_COMBINED_MASK;
      } else {
        // should not happen - we actually have no data in the cell yet
        // simply set the data in the cell buffer with a width of 1
        content = codePoint | (1 << Content.WIDTH_SHIFT);
      }
    }
    if (width) {
      content &= ~Content.WIDTH_MASK;
      content |= width << Content.WIDTH_SHIFT;
    }
    lline._data[lline._dataStart + lcolumn * Constants.CELL_INDICIES + Cell.CONTENT] = content;
  }

  public insertCells(pos: number, n: number, fillCellData: ICellData): void {
    this._cacheValid = false;
    pos %= this.length;

    // handle fullwidth at pos: reset cell one to the left if pos is second cell of a wide char
    if (pos && this.getWidth(pos - 1) === 2) {
      this.setCellFromCodepoint(pos - 1, 0, 1, fillCellData);
    }

    if (n < this.length - pos) {
      for (let i = this.length - pos - n - 1; i >= 0; --i) {
        this.setCell(pos + n + i, this.loadCell(pos + i, $workCell));
      }
      for (let i = 0; i < n; ++i) {
        this.setCell(pos + i, fillCellData);
      }
    } else {
      for (let i = pos; i < this.length; ++i) {
        this.setCell(i, fillCellData);
      }
    }

    // handle fullwidth at line end: reset last cell if it is first cell of a wide char
    if (this.getWidth(this.length - 1) === 2) {
      this.setCellFromCodepoint(this.length - 1, 0, 1, fillCellData);
    }
  }

  public deleteCells(pos: number, n: number, fillCellData: ICellData): void {
    this._cacheValid = false;
    pos %= this.length;
    if (n < this.length - pos) {
      for (let i = 0; i < this.length - pos - n; ++i) {
        this.setCell(pos + i, this.loadCell(pos + n + i, $workCell));
      }
      for (let i = this.length - n; i < this.length; ++i) {
        this.setCell(i, fillCellData);
      }
    } else {
      for (let i = pos; i < this.length; ++i) {
        this.setCell(i, fillCellData);
      }
    }

    // handle fullwidth at pos:
    // - reset pos-1 if wide char
    // - reset pos if width==0 (previous second cell of a wide char)
    if (pos && this.getWidth(pos - 1) === 2) {
      this.setCellFromCodepoint(pos - 1, 0, 1, fillCellData);
    }
    if (this.getWidth(pos) === 0 && !this.hasContent(pos)) {
      this.setCellFromCodepoint(pos, 0, 1, fillCellData);
    }
  }

  public replaceCells(start: number, end: number, fillCellData: ICellData, respectProtect: boolean = false): void {
    this._cacheValid = false;
    // full branching on respectProtect==true, hopefully getting fast JIT for standard case
    if (respectProtect) {
      if (start && this.getWidth(start - 1) === 2 && !this.isProtected(start - 1)) {
        this.setCellFromCodepoint(start - 1, 0, 1, fillCellData);
      }
      if (end < this.length && this.getWidth(end - 1) === 2 && !this.isProtected(end)) {
        this.setCellFromCodepoint(end, 0, 1, fillCellData);
      }
      while (start < end  && start < this.length) {
        if (!this.isProtected(start)) {
          this.setCell(start, fillCellData);
        }
        start++;
      }
      return;
    }

    // handle fullwidth at start: reset cell one to the left if start is second cell of a wide char
    if (start && this.getWidth(start - 1) === 2) {
      this.setCellFromCodepoint(start - 1, 0, 1, fillCellData);
    }
    // handle fullwidth at last cell + 1: reset to empty cell if it is second part of a wide char
    if (end < this.length && this.getWidth(end - 1) === 2) {
      this.setCellFromCodepoint(end, 0, 1, fillCellData);
    }

    while (start < end  && start < this.length) {
      this.setCell(start++, fillCellData);
    }
  }

  /**
   * Resize to `cols` filling excess cells with `fillCellData`.
   * The underlying array buffer will not change if there is still enough space
   * to hold the new buffer line data.
   * Returns a boolean indicating, whether a `cleanupMemory` call would free
   * excess memory (true after shrinking > Constants.Constants.CLEANUP_THRESHOLD).
   * Assumes single unwrapped line.
   * @deprecated only used in tests
   */
  public resize(cols: number, fillCellData: ICellData): boolean {
    this._cacheValid = false;
    const logical = this._logicalLine;
    if (logical.firstBufferLine !== this || this.nextBufferLine) {
      throw new Error('invalid call to resize');
    }
    if (cols === this.length) {
      return logical._dataLength * 4 * Constants.CLEANUP_THRESHOLD < logical._data.buffer.byteLength;
    }
    const uint32Cells = cols * Constants.CELL_INDICIES;
    if (cols > this.length) {
      logical.resizeData(cols);
      logical.length = cols;
      for (let i = this.length; i < cols; ++i) {
        this.setCell(i, fillCellData);
      }
    } else {
      // optimization: just shrink the view on existing buffer
      logical._data = logical._data.subarray(0, cols * Constants.CELL_INDICIES);
      logical._dataStart = 0;
      logical._dataLength = cols * Constants.CELL_INDICIES;
      // Remove any cut off combined data
      const keys = Object.keys(logical._combined);
      for (let i = 0; i < keys.length; i++) {
        const key = parseInt(keys[i], 10);
        if (key >= cols) {
          delete logical._combined[key];
        }
      }
      // remove any cut off extended attributes
      const extKeys = Object.keys(logical._extendedAttrs);
      for (let i = 0; i < extKeys.length; i++) {
        const key = parseInt(extKeys[i], 10);
        if (key >= cols) {
          delete logical._extendedAttrs[key];
        }
      }
    }
    this.length = cols;
    return uint32Cells * 4 * Constants.CLEANUP_THRESHOLD < logical._data.buffer.byteLength;
  }

  /**
   * Cleanup underlying array buffer.
   * A cleanup will be triggered if the array buffer exceeds the actual used
   * memory by a factor of Constants.Constants.CLEANUP_THRESHOLD.
   * Returns 0 or 1 indicating whether a cleanup happened.
   * @deprecated
   */
  public cleanupMemory(): number {
    return 0;
  }

  /** fill a line with fillCharData */
  public fill(fillCellData: ICellData, respectProtect: boolean = false): void {
    this._cacheValid = false;
    // full branching on respectProtect==true, hopefully getting fast JIT for standard case
    if (respectProtect) {
      for (let i = 0; i < this.length; ++i) {
        if (!this.isProtected(i)) {
          this.setCell(i, fillCellData);
        }
      }
      return;
    }
    const lline = this._logicalLine;
    if (lline.firstBufferLine === this && !this.nextBufferLine) {
      lline._combined = {};
      lline._extendedAttrs = {};
    }
    for (let i = 0; i < this.length; ++i) {
      this.setCell(i, fillCellData);
    }
  }

  /** alter to a full copy of line
   * @deprecated only used in a few tests
   */
  public copyFrom(line: BufferLine): void {
    this.copyCellsFrom(line, 0, 0, this.length, false);
    this.length = line.length;
  }

  public getTrimmedLength(noBg: boolean = false): number {
    const logicalLine = this._logicalLine;
    const startColumn = this.startColumn;
    const data = logicalLine._data;
    for (let i = this.validEnd; --i >= startColumn; ) {
      const j = logicalLine._dataStart + i * Constants.CELL_INDICIES;
      if ((data[j + Cell.CONTENT] & Content.HAS_CONTENT_MASK)
      || (noBg && (data[j + Cell.BG] & Attributes.CM_MASK))) {
        i += data[j + Cell.CONTENT] >> Content.WIDTH_SHIFT;
        return i - startColumn;
      }
    }
    return startColumn;
  }

  public getNoBgTrimmedLength(): number {
    if (this._logicalLine.backgroundColor) {
      return this.length;
    }
    return this.getTrimmedLength(true);
  }

  public copyCellsFrom(src: BufferLine, srcCol: number, destCol: number, length: number, applyInReverse: boolean): void {
    this._cacheValid = false;
    this._logicalLine.copyCellsFrom(src._logicalLine, srcCol + src.startColumn,
      destCol + this.startColumn, length, applyInReverse);
  }

  public getPreviousLine(): BufferLine | undefined {
    for (let row = this._logicalLine.firstBufferLine; ;) {
      if (!row) {
        return undefined;
      }
      const next = row.nextBufferLine;
      if (next === this) {
        return row;
      }
      row = next;
    }
  }

  public eraseRight(index: BufferColumn): void {
    this._cacheValid = false;
    const lineStart = this.startColumn;
    let lineEnd = lineStart + index;
    const lline = this._logicalLine;
    if (lineEnd > lineStart && lline.getWidth(lineEnd - 1) === 2) {
      lineEnd--;
    }
    if (this.nextBufferLine) {
      const oldEnd = this.nextBufferLine.startColumn;
      const count = oldEnd - lineEnd;
      if (count > 0) {
        let next: BufferLine | undefined = this;
        for (;;) {
          next = next.nextBufferLine;
          if (!next) break;
          next.startColumn -= count;
        }
        lline.copyCellsFrom(lline, oldEnd, lineEnd, lline.length - oldEnd, false);
        lline.length -= count;
      }
    } else {
      if (lineEnd < lline.length) {
        lline.length = lineEnd;
      }
    }
  }

  public setWrapped(previousLine: BufferLine): BufferLine {
    this._cacheValid = false;
    const column = previousLine.startColumn + previousLine.length;
    const logicalLine = previousLine._logicalLine;
    const oldLogical = this._logicalLine;
    logicalLine.resizeData(column + oldLogical.length);
    const newData = logicalLine._data;
    const dataStart = logicalLine._dataStart;
    for (let i = logicalLine.length; i < column + oldLogical.length; i++) {
      const i3 = dataStart + i * Constants.CELL_INDICIES;
      newData[i3 + Cell.CONTENT] = 0;
      newData[i3 + Cell.FG] = 0;
      newData[i3 + Cell.BG] = logicalLine.backgroundColor;
    }
    logicalLine.copyCellsFrom(oldLogical, 0, column, oldLogical.length, false);
    /*
    const oldData = oldLogical._data;
    for (let i = 0; i < oldLogical.length; i++) {
      const oldIndex = i * Constants.CELL_INDICIES;
      const newIndex = (column + i) * Constants.CELL_INDICIES
      const content = oldData[oldIndex + Cell.CONTENT];
      const fg = oldData[oldIndex + Cell.FG];
      const bg = oldData[oldIndex + Cell.BG];
      newData[newIndex + Cell.CONTENT] = content;
      newData[newIndex + Cell.FG] = fg;
      newData[newIndex + Cell.BG] = bg;
      if (content & Content.IS_COMBINED_MASK) {
        lprevious._combined[column + i] = oldLogical._combined[i];
      }
      if (bg & BgFlags.HAS_EXTENDED) {
        lprevious._extendedAttrs[column + i] = oldLogical._extendedAttrs[i];
      }
    }
    */
    logicalLine.length = column + oldLogical.length;
    previousLine.nextBufferLine = this;
    for (let line: BufferLine | undefined = this; line; line = line.nextBufferLine) {
      line.startColumn += column;
      line._logicalLine = logicalLine;
    }
    return this;

  }

  public asUnwrapped(prevRow: BufferLine): LogicalLine {
    prevRow._cacheValid = false;
    const oldStartColumn = this.startColumn;
    prevRow.nextBufferLine = undefined;
    const oldLine = prevRow._logicalLine;
    const cell = new CellData();
    this.loadCell(oldStartColumn, cell);
    const newLength = oldLine.length - oldStartColumn;
    const newLogical = new LogicalLine(newLength);
    newLogical.copyCellsFrom(oldLine, oldStartColumn, 0, newLength, false);
    newLogical.firstBufferLine = this;
    for (let nextRow: BufferLine | undefined = this; nextRow; nextRow = nextRow.nextBufferLine) {
      nextRow._cacheValid = false;
      nextRow.startColumn -= oldStartColumn;
      nextRow._logicalLine = newLogical;
    }
    oldLine.length = oldStartColumn;
    oldLine.trimLength();
    // FIXME truncate/resize
    newLogical.backgroundColor = oldLine.backgroundColor;
    return newLogical;
  }

  /**
   * Translates the buffer line to a string. Caching only applies to canonical full-line translation
   * requests (regardless of `trimRight` value).
   *
   * @param trimRight Whether to trim any empty cells on the right.
   * @param startCol The column to start the string (0-based inclusive).
   * @param endCol The column to end the string (0-based exclusive).
   * @param outColumns if specified, this array will be filled with column numbers such that
   * `returnedString[i]` is displayed at `outColumns[i]` column. `outColumns[returnedString.length]`
   * is where the character following `returnedString` will be displayed.
   *
   * When a single cell is translated to multiple UTF-16 code units (e.g. surrogate pair) in the
   * returned string, the corresponding entries in `outColumns` will have the same column number.
   */
  public translateToString(trimRight?: boolean, startCol?: number, endCol?: number, outColumns?: number[]): string {
    const isCanonical = (startCol === undefined || startCol === 0) && endCol === undefined && outColumns === undefined;
    if (isCanonical && this._cacheValid && trimRight === this._cacheTrimmed) {
      return this._cache;
    }
    startCol = startCol ?? 0;
    endCol = endCol ?? this.length;
    if (trimRight) {
      endCol = Math.min(endCol, this.getTrimmedLength());
    }
    const lline = this._logicalLine;
    const lineStart = this.startColumn;
    const validEnd = this.validEnd;
    startCol += lineStart;
    endCol += lineStart;
    const paddingNeeded = trimRight || endCol <= validEnd ? 0
      : endCol - validEnd;
    const result = lline.translateToString(startCol, endCol, endCol - paddingNeeded, outColumns);
    if (outColumns && lineStart) {
      for (let i = outColumns.length; --i >= 0; ) {
        outColumns[i] -= lineStart;
      }
    }
    if (isCanonical) {
      this._cache = result;
      this._cacheValid = true;
      this._cacheTrimmed = !!trimRight;
    }
    return result;
  }
}
