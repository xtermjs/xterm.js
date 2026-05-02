/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { CharData, IAttributeData, IBufferLine, ICellData, IExtendedAttrs } from 'common/Types';
import { AttributeData } from 'common/buffer/AttributeData';
import { CellData } from 'common/buffer/CellData';
import { Marker } from 'common/buffer/Marker';
import { Attributes, BgFlags, Content, NULL_CELL_CHAR, NULL_CELL_CODE, NULL_CELL_WIDTH, WHITESPACE_CELL_CHAR } from 'common/buffer/Constants';
import { stringFromCodePoint } from 'common/input/TextDecoder';

/**
 * buffer memory layout:
 *
 *   |             uint32_t             |        uint32_t         |        uint32_t         |
 *   |             `content`            |          `FG`           |          `BG`           |
 *   | wcwidth(2) comb(1) codepoint(21) | flags(8) R(8) G(8) B(8) | flags(8) R(8) G(8) B(8) |
 */


/** typed array slots taken by one cell */
const CELL_SIZE = 3;

/** Column count within current visible BufferLine(row).
 * The left-most column is column 0.
 */
export type BufferColumn = number;

/** Column count within current LogicalLine.
 * If the display is 80 columns wide, then LineColumn of the left-most
 * character of the first wrapped line would normally be 80.
 * (It might be 79 if the character at column 79 is double-width.)
 */
export type LogicalColumn = number;

/**
 * Cell member indices.
 *
 * Direct access:
 *    `content = data[column * CELL_SIZE + Cell.CONTENT];`
 *    `fg = data[column * CELL_SIZE + Cell.FG];`
 *    `bg = data[column * CELL_SIZE + Cell.BG];`
 */
const enum Cell {
  CONTENT = 0,
  FG = 1, // currently simply holds all known attrs
  BG = 2  // currently unused
}

export const DEFAULT_ATTR_DATA = Object.freeze(new AttributeData());

// Work variable to avoid garbage collection
const $workCell = new CellData();

/** Factor when to cleanup underlying array buffer after shrinking. */
const CLEANUP_THRESHOLD = 2;

/*
 * The data "model" of a line ignoring line wrapping.
 */
export class LogicalLine {
  /**
   * @internal
   */
  public _data: Uint32Array;

  /**
   * @internal
   */
  public _combined: {[index: LogicalColumn]: string} = {};
  /**
   * @internal
   */
  public _firstMarker: Marker | undefined;
  /**
   * @internal
   */
  public _extendedAttrs: {[index: LogicalColumn]: IExtendedAttrs | undefined} = {};

  public reflowNeeded: boolean = false;
  public firstBufferLine: BufferLine | undefined;
  public backgroundColor: number = 0;
  /**
   * Logical "trimmed" length of line.
   * Must be no more than this._data.length / 3. */
  public length: number = 0;

  constructor(cols: number = 0, data = new Uint32Array(cols * CELL_SIZE)) {
    this._data = data;
  }

  /**
   * @internal
   */
  public resizeData(cols: number): void {
    const uint32Cells = cols * CELL_SIZE;
    const oldByteLength = this._data.buffer.byteLength;
    const neededByteLength = uint32Cells * 4;
    if (oldByteLength >= neededByteLength) {
      // optimization: avoid alloc and data copy if buffer has enough room
      this._data = new Uint32Array(this._data.buffer, 0, uint32Cells);
    } else {
      // slow path: new alloc and full data copy
      const buffer = new ArrayBuffer(Math.max(12 + neededByteLength,  (3 * oldByteLength) >> 1));
      const data = new Uint32Array(buffer, 0, uint32Cells);
      data.set(this._data);
      this._data = data;
    }
  }

  public getWidth(index: LogicalColumn): number {
    return index >= this.length ? NULL_CELL_WIDTH
      : this._data[index * CELL_SIZE + Cell.CONTENT] >> Content.WIDTH_SHIFT;
  }

  /** usually same as argument, but adjust if wide or at end.
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
    const startIndex = index * CELL_SIZE;
    cell.content = this._data[startIndex + Cell.CONTENT];
    cell.fg = this._data[startIndex + Cell.FG];
    cell.bg = this._data[startIndex + Cell.BG];
    if (cell.content & Content.IS_COMBINED_MASK) {
      cell.combinedData = this._combined[index];
    }
    if (cell.bg & BgFlags.HAS_EXTENDED) {
      cell.extended = this._extendedAttrs[index]!;
    }
    return cell;
  }

  /**
   * Set data at `index` to `cell`.
   */
  public setCell(index: LogicalColumn, cell: ICellData): void {
    const content = cell.content & (Content.CODEPOINT_MASK|Content.IS_COMBINED_MASK);
    this.setCellFromCodepoint(index, content, cell.getWidth(), cell);
    if (cell.content & Content.IS_COMBINED_MASK) {
      this._combined[index] = cell.combinedData;
    }
  }

  /**
   * Set cell data from input handler.
   * Since the input handler see the incoming chars as UTF32 codepoints,
   * it gets an optimized access method.
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
      if ((this as any).xyz) { console.log('-set fill '+index+' to '+this.length);}
      this.resizeData(index + 1);
      for (let i = this.length; i < index; i++) {
        this._data[i * CELL_SIZE + Cell.CONTENT] = NULL_CELL_WIDTH << Content.WIDTH_SHIFT;
        this._data[i * CELL_SIZE + Cell.FG] = 0;
        this._data[i * CELL_SIZE + Cell.BG] = this.backgroundColor;
      }
      this.length = index + 1;
    }
    if (attrs.bg & BgFlags.HAS_EXTENDED) {
      this._extendedAttrs[index] = attrs.extended;
    }
    this._data[index * CELL_SIZE + Cell.CONTENT] = codePoint | (width << Content.WIDTH_SHIFT);
    this._data[index * CELL_SIZE + Cell.FG] = attrs.fg;
    this._data[index * CELL_SIZE + Cell.BG] = attrs.bg;
  }

  /**
   * Cleanup underlying array buffer.
   * A cleanup will be triggered if the array buffer exceeds the actual used
   * memory by a factor of CLEANUP_THRESHOLD.
   * Returns 0 or 1 indicating whether a cleanup happened.
   */
  public cleanupMemory(threshold: number = 1.3): number {
    const cols = this.length;
    if (cols * CELL_SIZE * 4 * threshold < this._data.buffer.byteLength) {
      const data = new Uint32Array(CELL_SIZE * cols);
      data.set(this._data);
      this._data = data;
      // Remove any cut off combined data
      const keys = Object.keys(this._combined);
      for (let i = 0; i < keys.length; i++) {
        const key = parseInt(keys[i], 10);
        if (key >= cols) {
          delete this._combined[key];
        }
      }
      // remove any cut off extended attributes
      const extKeys = Object.keys(this._extendedAttrs);
      for (let i = 0; i < extKeys.length; i++) {
        const key = parseInt(extKeys[i], 10);
        if (key >= cols) {
          delete this._extendedAttrs[key];
        }
      }
      return 1;
    }
    return 0;
  }

  /**
   * @internal
   *
   */
  public trimLength(): void {
    let index = this.length;
    while (index > 0) {
      index--;
      const content = this._data[index * CELL_SIZE + Cell.CONTENT];
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

  public copyCellsFrom(src: LogicalLine, srcCol: number, dstCol: number, length: number, applyInReverse: boolean): void {
    let cell = applyInReverse ? length - 1 : 0;
    const cellIncrement = applyInReverse ? -1 : 1;
    for (let todo = length; --todo >= 0; cell += cellIncrement) {
      src.loadCell(srcCol + cell, $workCell);
      this.setCell(dstCol + cell, $workCell);
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
    let result = '';
    while (startCol < endCol) {
      const content = startCol >= dataLength ? 0
        : this._data[startCol * CELL_SIZE + Cell.CONTENT];
      const cp = content & Content.CODEPOINT_MASK;
      const chars = (content & Content.IS_COMBINED_MASK) ? this._combined[startCol] : (cp) ? stringFromCodePoint(cp) : WHITESPACE_CELL_CHAR;
      result += chars;
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
  public logicalLine: LogicalLine;
  public nextBufferLine: BufferLine | undefined;

  /** Number of logical columns in previous rows.
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

  /**
   * Last LogicalColumn of this BufferLine.
   * @internal
   */
  public get validEnd(): LogicalColumn {
    return this.nextBufferLine ? this.nextBufferLine.startColumn : this.logicalLine.length;
  }

  constructor(cols: number, logicalLine = new LogicalLine(cols)) {
    this.logicalLine = logicalLine;
    this.length = cols;
    logicalLine.firstBufferLine ??= this;
  }

  public get isWrapped(): boolean {
    return this.logicalLine.firstBufferLine !== this;
  }

  /**
   * Get cell data CharData.
   * @deprecated
   */
  public get(index: BufferColumn): CharData {
    const lline = this.logicalLine;
    const lindex: LogicalColumn = index + this.startColumn;
    if (lindex >= this.validEnd) {
      return [0, '', NULL_CELL_WIDTH, 0];
    }
    const content = lline._data[index * CELL_SIZE + Cell.CONTENT];
    const cp = content & Content.CODEPOINT_MASK;
    return [
      lline._data[lindex * CELL_SIZE + Cell.FG],
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
      : this.logicalLine.getWidth(lindex);
  }

  /** Test whether content has width. */
  public hasWidth(index: number): number {
    return this.getWidth(index);
  }

  /** Get FG cell component. */
  public getFg(index: number): number {
    const lline = this.logicalLine;
    const lcolumn = index + this.startColumn;
    return lcolumn >= this.validEnd ? 0 : lline._data[lcolumn * CELL_SIZE + Cell.FG];
  }

  /** Get BG cell component. */
  public getBg(index: number): number {
    index += this.startColumn;
    const lline = this.logicalLine;
    return index > lline.length ? lline.backgroundColor
      : lline._data[index * CELL_SIZE + Cell.BG];
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
    const lline = this.logicalLine;
    return lline._data[index * CELL_SIZE + Cell.CONTENT] & Content.HAS_CONTENT_MASK;
  }

  /**
   * Get codepoint of the cell.
   * To be in line with `code` in CharData this either returns
   * a single UTF32 codepoint or the last codepoint of a combined string.
   */
  public getCodePoint(index: BufferColumn): number {
    const lline = this.logicalLine;
    const lcolumn: LogicalColumn = index + this.startColumn;
    if (lcolumn >= this.validEnd) {
      return 0;
    }
    const content = lline._data[lcolumn * CELL_SIZE + Cell.CONTENT];
    if (content & Content.IS_COMBINED_MASK) {
      const combined = lline._combined[lcolumn];
      return combined.charCodeAt(combined.length - 1);
    }
    return content & Content.CODEPOINT_MASK;
  }

  /** Test whether the cell contains a combined string. */
  public isCombined(index: number): number {
    const lline = this.logicalLine;
    const lcolumn: LogicalColumn = index + this.startColumn;
    if (lcolumn >= this.validEnd) {
      return 0;
    }
    return lline._data[lcolumn * CELL_SIZE + Cell.CONTENT] & Content.IS_COMBINED_MASK;
  }

  /** Returns the string content of the cell. */
  public getString(index: number): string {
    const lline = this.logicalLine;
    const lcolumn: LogicalColumn = index + this.startColumn;
    if (lcolumn >= this.validEnd) {
      return '';
    }
    const content = lline._data[lcolumn * CELL_SIZE + Cell.CONTENT];
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
    const lline = this.logicalLine;
    const lcolumn = index + this.startColumn;
    return index >= this.length || lcolumn >= lline.length ? 0
      : lline._data[lcolumn * CELL_SIZE + Cell.BG] & BgFlags.PROTECTED;
  }

  /**
   * Load data at `index` into `cell`. This is used to access cells in a way that's more friendly
   * to GC as it significantly reduced the amount of new objects/references needed.
   */
  public loadCell(index: number, cell: ICellData): ICellData {
    const lline = this.logicalLine;
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

  /**
   * Set data at `index` to `cell`.
   */
  public setCell(index: number, cell: ICellData): void {
    // this.logicalLine.setCell(index + this.startColumn, cell);
    const content = cell.content & (Content.CODEPOINT_MASK|Content.IS_COMBINED_MASK);
    this.setCellFromCodepoint(index, content, cell.getWidth(), cell);
    if (cell.content & Content.IS_COMBINED_MASK) {
      this.logicalLine._combined[index + this.startColumn] = cell.combinedData;
    }
  }

  /**
   * Set cell data from input handler.
   * Since the input handler see the incoming chars as UTF32 codepoints,
   * it gets an optimized access method.
   */
  public setCellFromCodepoint(index: number, codePoint: number, width: number, attrs: IAttributeData): void {
    this.logicalLine.setCellFromCodepoint(index + this.startColumn,
      codePoint, width, attrs);
  }

  /**
   * Add a codepoint to a cell from input handler.
   * During input stage combining chars with a width of 0 follow and stack
   * onto a leading char. Since we already set the attrs
   * by the previous `setDataFromCodePoint` call, we can omit it here.
   */
  public addCodepointToCell(index: number, codePoint: number, width: number): void {
    const lline = this.logicalLine;
    const lcolumn = index + this.startColumn;
    if (lcolumn >= this.validEnd) {
      // should not happen - we actually have no data in the cell yet
      // simply set the data in the cell buffer with a width of 1
      this.setCellFromCodepoint(index, codePoint, 1, CellData.fromCharData([0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]));
      return;
    }
    let content = lline._data[lcolumn * CELL_SIZE + Cell.CONTENT];
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
    lline._data[lcolumn * CELL_SIZE + Cell.CONTENT] = content;
  }

  public insertCells(pos: number, n: number, fillCellData: ICellData): void {
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
   * @internal
   */
  public clearMarkers(): void {
    const lline = this.logicalLine;
    const startColumn = this.startColumn;
    const endColumn = this.nextBufferLine ? this.nextBufferLine.startColumn : Infinity;
    for (let m = lline._firstMarker; m; m = m._nextMarker) {
      if (m._startColumn >= startColumn && m._startColumn < endColumn) {
        m.dispose();
      }
    }
  }

  /**
   * Resize to `cols` filling excess cells with `fillCellData`.
   * The underlying array buffer will not change if there is still enough space
   * to hold the new buffer line data.
   * Returns a boolean indicating, whether a `cleanupMemory` call would free
   * excess memory (true after shrinking > CLEANUP_THRESHOLD).
   * Assumes single unwrapped line.
   * @deprecated only used in tests
   */
  public resize(cols: number, fillCellData: ICellData): boolean {
    const logical = this.logicalLine;
    if (logical.firstBufferLine !== this || this.nextBufferLine) {
      throw new Error('invalid call to resize');
    }
    if (cols === this.length) {
      return logical._data.length * 4 * CLEANUP_THRESHOLD < logical._data.buffer.byteLength;
    }
    const uint32Cells = cols * CELL_SIZE;
    if (cols > this.length) {
      logical.resizeData(cols);
      for (let i = this.length; i < cols; ++i) {
        this.setCell(i, fillCellData);
      }
    } else {
      // optimization: just shrink the view on existing buffer
      logical._data = logical._data.subarray(0, cols * CELL_SIZE);
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
    return uint32Cells * 4 * CLEANUP_THRESHOLD < logical._data.buffer.byteLength;
  }

  /**
   * Cleanup underlying array buffer.
   * A cleanup will be triggered if the array buffer exceeds the actual used
   * memory by a factor of CLEANUP_THRESHOLD.
   * Returns 0 or 1 indicating whether a cleanup happened.
   */
  public cleanupMemory(): number {
    return this.logicalLine.cleanupMemory(CLEANUP_THRESHOLD);
  }

  /** fill a line with fillCharData */
  public fill(fillCellData: ICellData, respectProtect: boolean = false): void {
    // full branching on respectProtect==true, hopefully getting fast JIT for standard case
    if (respectProtect) {
      for (let i = 0; i < this.length; ++i) {
        if (!this.isProtected(i)) {
          this.setCell(i, fillCellData);
        }
      }
      return;
    }
    const lline = this.logicalLine;
    if (lline.firstBufferLine === this && ! this.nextBufferLine) {
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
    const logicalLine = this.logicalLine;
    const startColumn = this.startColumn;
    const data = logicalLine._data;
    for (let i = this.validEnd; --i >= startColumn; ) {
      if ((data[i * CELL_SIZE + Cell.CONTENT] & Content.HAS_CONTENT_MASK)
      || (noBg && (data[i * CELL_SIZE + Cell.BG] & Attributes.CM_MASK))) {
        i += data[i * CELL_SIZE + Cell.CONTENT] >> Content.WIDTH_SHIFT;
        return i - startColumn;
      }
    }
    return startColumn;
  }

  public getNoBgTrimmedLength(): number {
    if (this.logicalLine.backgroundColor) {
      return this.length;
    }
    return this.getTrimmedLength(true);
  }

  public copyCellsFrom(src: BufferLine, srcCol: number, destCol: number, length: number, applyInReverse: boolean): void {
    this.logicalLine.copyCellsFrom(src.logicalLine, srcCol + src.startColumn,
      destCol + this.startColumn, length, applyInReverse);
  }

  /**
   * Translates the buffer line to a string.
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
    startCol = startCol ?? 0;
    endCol = endCol ?? this.length;
    if (trimRight) {
      endCol = Math.min(endCol, this.getTrimmedLength());
    }
    const lline = this.logicalLine;
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
    return result;
  }

  public getPreviousLine(): BufferLine | undefined {
    for (let row = this.logicalLine.firstBufferLine; ;) {
      if (! row) {
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
    const lineStart = this.startColumn;
    const lineEnd = lineStart + index;
    const lline = this.logicalLine;
    if (this.nextBufferLine) {
      const oldEnd = this.nextBufferLine.startColumn;
      const count = oldEnd - lineEnd;
      if (count > 0) {
        let next: BufferLine | undefined = this;
        for (;;) {
          next = next.nextBufferLine;
          if (! next) break;
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
    const column = previousLine.startColumn + previousLine.length;
    const logicalLine = previousLine.logicalLine;
    const oldLogical = this.logicalLine;
    logicalLine.resizeData(column + oldLogical.length);
    const newData = logicalLine._data;
    for (let i = logicalLine.length; i < column + oldLogical.length; i++) {
      newData[i * CELL_SIZE + Cell.CONTENT] = 0;
      newData[i * CELL_SIZE + Cell.FG] = 0;
      newData[i * CELL_SIZE + Cell.BG] = logicalLine.backgroundColor;
    }
    logicalLine.copyCellsFrom(oldLogical, 0, column, oldLogical.length, false);
    /*
    const oldData = oldLogical._data;
    for (let i = 0; i < oldLogical.length; i++) {
      const oldIndex = i * CELL_SIZE;
      const newIndex = (column + i) * CELL_SIZE
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
    let prevLastMarker;
    for (let m = logicalLine._firstMarker; m; m = m._nextMarker) {
      prevLastMarker = m;
    }
    let m = oldLogical._firstMarker;
    if (prevLastMarker) prevLastMarker._nextMarker = m;
    else logicalLine._firstMarker = m;
    for (; m; m = m._nextMarker) {
      m._startColumn += column;
    }
    oldLogical._firstMarker = undefined;
    logicalLine.length = column + oldLogical.length;
    previousLine.nextBufferLine = this;
    for (let line: BufferLine | undefined = this; line; line = line.nextBufferLine) {
      line.startColumn += column;
      line.logicalLine = logicalLine;
    }
    return this;

  }

  public asUnwrapped(prevRow: BufferLine): LogicalLine {
    const oldStartColumn = this.startColumn;
    prevRow.nextBufferLine = undefined;
    const oldLine = prevRow.logicalLine;
    const cell = new CellData();
    this.loadCell(oldStartColumn, cell);
    const newLength = oldLine.length - oldStartColumn;
    const newLogical = new LogicalLine(newLength);
    newLogical.copyCellsFrom(oldLine, oldStartColumn, 0, newLength, false);
    newLogical.firstBufferLine = this;
    for (let nextRow: BufferLine | undefined = this; nextRow; nextRow = nextRow.nextBufferLine) {
      nextRow.startColumn -= oldStartColumn;
      nextRow.logicalLine = newLogical;
    }
    let prevMarker: Marker | undefined; // in oldLine marker list
    let newMarkerLast: Marker | undefined; // in newLogical marker list
    for (let m = oldLine._firstMarker; m; ) {
      const oldNext = m._nextMarker;
      if (m._startColumn >= oldStartColumn) { // move to new line
        m._startColumn -= oldStartColumn;
        if (prevMarker) { prevMarker._nextMarker = oldNext; }
        else { oldLine._firstMarker = oldNext; }
        m._nextMarker = undefined;
        if (newMarkerLast) { newMarkerLast._nextMarker = m; }
        else { newLogical._firstMarker = m; }
        newMarkerLast = m;
      }
      prevMarker = m;
      m = oldNext;
    }
    oldLine.length = oldStartColumn;
    oldLine.trimLength();
    // FIXME truncate/resize
    newLogical.backgroundColor = oldLine.backgroundColor;
    return newLogical;
  }
}
