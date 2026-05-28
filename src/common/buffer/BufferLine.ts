/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { CharData, IAttributeData, IBufferLine, ICellData, IExtendedAttrs } from 'common/Types';
import { AttributeData } from 'common/buffer/AttributeData';
import { CellData } from 'common/buffer/CellData';
import { Attributes, BgFlags, CHAR_DATA_ATTR_INDEX, CHAR_DATA_CHAR_INDEX, CHAR_DATA_WIDTH_INDEX, Content, NULL_CELL_CHAR, NULL_CELL_CODE, NULL_CELL_WIDTH, WHITESPACE_CELL_CHAR } from 'common/buffer/Constants';
import { stringFromCodePoint } from 'common/input/TextDecoder';
import { StringBuilder } from 'common/StringBuilder';

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

export const DEFAULT_ATTR_DATA = Object.freeze(new AttributeData());

// Work variables to avoid garbage collection
let $startIndex = 0;
const $workCell = new CellData();
const $translateToStringBuilder = new StringBuilder();

export interface IBufferLineStringCacheEntry {
  value: string | undefined;
  isTrimmed: boolean;
  generation: number;
}

export interface IBufferLineStringCache {
  generation: number;
  allocateEntry(): IBufferLineStringCacheEntry;
  touch?(): void;
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
 *   Use `CellData.fromCharData` to create the CellData object (e.g. from JS string).
 *
 * To retrieve data from the buffer use either one of the primitive methods
 * (if only one particular value is needed) or `loadCell`. For `loadCell` in a loop
 * memory allocs / GC pressure can be greatly reduced by reusing the CellData object.
 */
export class BufferLine implements IBufferLine {
  protected _data: Uint32Array;
  protected _combined: {[index: number]: string} = {};
  protected _extendedAttrs: {[index: number]: IExtendedAttrs | undefined} = {};
  protected _stringCacheEntryRef: WeakRef<IBufferLineStringCacheEntry> | undefined;
  /** When set, this row is a viewport slice of the logical line owned by this buffer line. */
  protected _logicalHead: BufferLine | undefined;
  protected _segmentStart: number = 0;
  protected _logicalCellCount: number = 0;
  protected _overflowRowCount: number = 0;
  protected _fillCellData: ICellData;
  public length: number;
  public isWrapped: boolean = false;

  constructor(
    protected readonly _stringCache: IBufferLineStringCache,
    cols: number,
    fillCellData?: ICellData,
    isWrapped: boolean = false,
    logicalHead?: BufferLine,
    segmentStart?: number
  ) {
    const cell = fillCellData ?? CellData.fromCharData([0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]);
    this._fillCellData = cell;
    if (logicalHead) {
      this._logicalHead = logicalHead;
      this._segmentStart = segmentStart ?? 0;
      this._data = logicalHead._data;
      this._combined = logicalHead._combined;
      this._extendedAttrs = logicalHead._extendedAttrs;
      this.length = cols;
      this.isWrapped = true;
      return;
    }
    this._data = new Uint32Array(cols * Constants.CELL_INDICIES);
    this._logicalCellCount = cols;
    for (let i = 0; i < cols; ++i) {
      this.setCell(i, cell);
    }
    this.length = cols;
    this.isWrapped = isWrapped;
  }

  public get logicalCellCount(): number {
    return this._logicalHead ? this._logicalHead._logicalCellCount : this._logicalCellCount;
  }

  public registerOverflowRow(): void {
    if (this._logicalHead) {
      this._logicalHead.registerOverflowRow();
    } else {
      this._overflowRowCount++;
    }
  }

  public unregisterOverflowRow(): void {
    if (this._logicalHead) {
      this._logicalHead.unregisterOverflowRow();
    } else if (this._overflowRowCount > 0) {
      this._overflowRowCount--;
    }
  }

  public clearOverflowRows(): void {
    if (!this._logicalHead) {
      this._overflowRowCount = 0;
    }
  }

  /** After reflow merges wrapped rows into the head, reset overflow tracking. */
  public clearReflowMergedState(): void {
    if (!this._logicalHead) {
      this._overflowRowCount = 0;
    }
  }

  public ensureLogicalCapacity(minCells: number, fillCellData: ICellData): void {
    const head = this._logicalHead ?? this;
    if (minCells <= head._logicalCellCount) {
      return;
    }
    head._invalidateStringCache();
    const uint32Cells = minCells * Constants.CELL_INDICIES;
    if (head._data.buffer.byteLength >= uint32Cells * 4) {
      head._data = new Uint32Array(head._data.buffer, 0, uint32Cells);
    } else {
      const data = new Uint32Array(uint32Cells);
      data.set(head._data);
      head._data = data;
    }
    for (let i = head._logicalCellCount; i < minCells; ++i) {
      const start = i * Constants.CELL_INDICIES;
      head._data[start + Cell.CONTENT] = fillCellData.content;
      head._data[start + Cell.FG] = fillCellData.fg;
      head._data[start + Cell.BG] = fillCellData.bg;
    }
    head._logicalCellCount = minCells;
  }

  protected _absoluteColumn(column: number): number {
    return this._segmentStart + column;
  }

  protected _cellStartIndex(column: number): number {
    return this._absoluteColumn(column) * Constants.CELL_INDICIES;
  }

  /**
   * Get cell data CharData.
   * @deprecated
   */
  public get(index: number): CharData {
    const abs = this._absoluteColumn(index);
    const start = this._cellStartIndex(index);
    const content = this._data[start + Cell.CONTENT];
    const cp = content & Content.CODEPOINT_MASK;
    return [
      this._data[start + Cell.FG],
      (content & Content.IS_COMBINED_MASK)
        ? this._combined[abs]
        : (cp) ? stringFromCodePoint(cp) : '',
      content >> Content.WIDTH_SHIFT,
      (content & Content.IS_COMBINED_MASK)
        ? this._combined[abs].charCodeAt(this._combined[abs].length - 1)
        : cp
    ];
  }

  /**
   * Set cell data from CharData.
   * @deprecated
   */
  public set(index: number, value: CharData): void {
    this._invalidateStringCache();
    const abs = this._absoluteColumn(index);
    const start = this._cellStartIndex(index);
    this._data[start + Cell.FG] = value[CHAR_DATA_ATTR_INDEX];
    if (value[CHAR_DATA_CHAR_INDEX].length > 1) {
      this._combined[abs] = value[1];
      this._data[start + Cell.CONTENT] = abs | Content.IS_COMBINED_MASK | (value[CHAR_DATA_WIDTH_INDEX] << Content.WIDTH_SHIFT);
    } else {
      this._data[start + Cell.CONTENT] = value[CHAR_DATA_CHAR_INDEX].charCodeAt(0) | (value[CHAR_DATA_WIDTH_INDEX] << Content.WIDTH_SHIFT);
    }
  }

  /**
   * primitive getters
   * use these when only one value is needed, otherwise use `loadCell`
   */
  public getWidth(index: number): number {
    return this._data[this._cellStartIndex(index) + Cell.CONTENT] >> Content.WIDTH_SHIFT;
  }

  /** Test whether content has width. */
  public hasWidth(index: number): number {
    return this._data[this._cellStartIndex(index) + Cell.CONTENT] & Content.WIDTH_MASK;
  }

  /** Get FG cell component. */
  public getFg(index: number): number {
    return this._data[this._cellStartIndex(index) + Cell.FG];
  }

  /** Get BG cell component. */
  public getBg(index: number): number {
    return this._data[this._cellStartIndex(index) + Cell.BG];
  }

  /**
   * Test whether contains any chars.
   * Basically an empty has no content, but other cells might differ in FG/BG
   * from real empty cells.
   */
  public hasContent(index: number): number {
    return this._data[this._cellStartIndex(index) + Cell.CONTENT] & Content.HAS_CONTENT_MASK;
  }

  /**
   * Get codepoint of the cell.
   * To be in line with `code` in CharData this either returns
   * a single UTF32 codepoint or the last codepoint of a combined string.
   */
  public getCodePoint(index: number): number {
    const abs = this._absoluteColumn(index);
    const content = this._data[this._cellStartIndex(index) + Cell.CONTENT];
    if (content & Content.IS_COMBINED_MASK) {
      return this._combined[abs].charCodeAt(this._combined[abs].length - 1);
    }
    return content & Content.CODEPOINT_MASK;
  }

  /** Test whether the cell contains a combined string. */
  public isCombined(index: number): number {
    return this._data[this._cellStartIndex(index) + Cell.CONTENT] & Content.IS_COMBINED_MASK;
  }

  /** Returns the string content of the cell. */
  public getString(index: number): string {
    const abs = this._absoluteColumn(index);
    const content = this._data[this._cellStartIndex(index) + Cell.CONTENT];
    if (content & Content.IS_COMBINED_MASK) {
      return this._combined[abs];
    }
    if (content & Content.CODEPOINT_MASK) {
      return stringFromCodePoint(content & Content.CODEPOINT_MASK);
    }
    // return empty string for empty cells
    return '';
  }

  /** Get state of protected flag. */
  public isProtected(index: number): number {
    return this._data[this._cellStartIndex(index) + Cell.BG] & BgFlags.PROTECTED;
  }

  /**
   * Load data at `index` into `cell`. This is used to access cells in a way that's more friendly
   * to GC as it significantly reduced the amount of new objects/references needed.
   */
  public loadCell(index: number, cell: ICellData): ICellData {
    const abs = this._absoluteColumn(index);
    $startIndex = this._cellStartIndex(index);
    cell.content = this._data[$startIndex + Cell.CONTENT];
    cell.fg = this._data[$startIndex + Cell.FG];
    cell.bg = this._data[$startIndex + Cell.BG];
    if (cell.content & Content.IS_COMBINED_MASK) {
      cell.combinedData = this._combined[abs];
    }
    if (cell.bg & BgFlags.HAS_EXTENDED) {
      cell.extended = this._extendedAttrs[abs]!;
    }
    return cell;
  }

  /**
   * Set data at `index` to `cell`.
   */
  public setCell(index: number, cell: ICellData): void {
    this._invalidateStringCache();
    const abs = this._absoluteColumn(index);
    const start = this._cellStartIndex(index);
    if (cell.content & Content.IS_COMBINED_MASK) {
      this._combined[abs] = cell.combinedData;
    }
    if (cell.bg & BgFlags.HAS_EXTENDED) {
      this._extendedAttrs[abs] = cell.extended;
    }
    this._data[start + Cell.CONTENT] = cell.content;
    this._data[start + Cell.FG] = cell.fg;
    this._data[start + Cell.BG] = cell.bg;
  }

  /**
   * Set cell data from input handler.
   * Since the input handler see the incoming chars as UTF32 codepoints,
   * it gets an optimized access method.
   */
  public setCellFromCodepoint(index: number, codePoint: number, width: number, attrs: IAttributeData): void {
    this._invalidateStringCache();
    const abs = this._absoluteColumn(index);
    const start = this._cellStartIndex(index);
    if (attrs.bg & BgFlags.HAS_EXTENDED) {
      this._extendedAttrs[abs] = attrs.extended;
    }
    this._data[start + Cell.CONTENT] = codePoint | (width << Content.WIDTH_SHIFT);
    this._data[start + Cell.FG] = attrs.fg;
    this._data[start + Cell.BG] = attrs.bg;
  }

  /**
   * Add a codepoint to a cell from input handler.
   * During input stage combining chars with a width of 0 follow and stack
   * onto a leading char. Since we already set the attrs
   * by the previous `setDataFromCodePoint` call, we can omit it here.
   */
  public addCodepointToCell(index: number, codePoint: number, width: number): void {
    this._invalidateStringCache();
    const abs = this._absoluteColumn(index);
    const start = this._cellStartIndex(index);
    let content = this._data[start + Cell.CONTENT];
    if (content & Content.IS_COMBINED_MASK) {
      // we already have a combined string, simply add
      this._combined[abs] += stringFromCodePoint(codePoint);
    } else {
      if (content & Content.CODEPOINT_MASK) {
        // normal case for combining chars:
        //  - move current leading char + new one into combined string
        //  - set combined flag
        this._combined[abs] = stringFromCodePoint(content & Content.CODEPOINT_MASK) + stringFromCodePoint(codePoint);
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
    this._data[start + Cell.CONTENT] = content;
  }

  public insertCells(pos: number, n: number, fillCellData: ICellData): void {
    this._invalidateStringCache();
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
    this._invalidateStringCache();
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
    this._invalidateStringCache();
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
   * Resize BufferLine to `cols` filling excess cells with `fillCellData`.
   * The underlying array buffer will not change if there is still enough space
   * to hold the new buffer line data.
   * Returns a boolean indicating, whether a `cleanupMemory` call would free
   * excess memory (true after shrinking > Constants.CLEANUP_THRESHOLD).
   */
  public resize(cols: number, fillCellData: ICellData): boolean {
    this._invalidateStringCache();
    if (this._logicalHead) {
      if (cols > this.length) {
        this._logicalHead.ensureLogicalCapacity(this._segmentStart + cols, fillCellData);
      }
      this.length = cols;
      return false;
    }
    if (this._overflowRowCount > 0) {
      if (cols > this.length) {
        this.ensureLogicalCapacity(Math.max(this._logicalCellCount, this._segmentStart + cols), fillCellData);
      }
      this.length = cols;
      return this._data.length * 4 * Constants.CLEANUP_THRESHOLD < this._data.buffer.byteLength;
    }
    if (cols === this.length) {
      return this._data.length * 4 * Constants.CLEANUP_THRESHOLD < this._data.buffer.byteLength;
    }
    const uint32Cells = cols * Constants.CELL_INDICIES;
    if (cols > this.length) {
      const data = new Uint32Array(uint32Cells);
      data.set(this._data.subarray(0, this.length * Constants.CELL_INDICIES));
      this._data = data;
      for (let i = this.length; i < cols; ++i) {
        this.setCell(i, fillCellData);
      }
    } else {
      // optimization: just shrink the view on existing buffer
      this._data = this._data.subarray(0, uint32Cells);
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
    }
    this.length = cols;
    this._logicalCellCount = cols;
    return uint32Cells * 4 * Constants.CLEANUP_THRESHOLD < this._data.buffer.byteLength;
  }

  /**
   * Cleanup underlying array buffer.
   * A cleanup will be triggered if the array buffer exceeds the actual used
   * memory by a factor of Constants.CLEANUP_THRESHOLD.
   * Returns 0 or 1 indicating whether a cleanup happened.
   */
  public cleanupMemory(): number {
    const head = this._logicalHead ?? this;
    const usedCells = head._logicalCellCount * Constants.CELL_INDICIES;
    if (usedCells * 4 * Constants.CLEANUP_THRESHOLD < head._data.buffer.byteLength) {
      const data = new Uint32Array(usedCells);
      data.set(head._data.subarray(0, usedCells));
      head._data = data;
      return 1;
    }
    return 0;
  }

  /** fill a line with fillCharData */
  public fill(fillCellData: ICellData, respectProtect: boolean = false): void {
    this._invalidateStringCache();
    // full branching on respectProtect==true, hopefully getting fast JIT for standard case
    if (respectProtect) {
      for (let i = 0; i < this.length; ++i) {
        if (!this.isProtected(i)) {
          this.setCell(i, fillCellData);
        }
      }
      return;
    }
    if (!this._logicalHead) {
      this._combined = {};
      this._extendedAttrs = {};
    }
    for (let i = 0; i < this.length; ++i) {
      this.setCell(i, fillCellData);
    }
  }

  /** alter to a full copy of line  */
  public copyFrom(line: BufferLine): void {
    if (this._logicalHead) {
      this.materializeFromLogicalHead(this._fillCellData);
    }
    this._invalidateStringCache();
    this._logicalHead = undefined;
    this._segmentStart = 0;
    this._overflowRowCount = 0;
    if (line._logicalHead) {
      const standalone = new BufferLine(this._stringCache, line.length, this._fillCellData, false);
      standalone.copyCellsFrom(line, 0, 0, line.length, false);
      line = standalone;
    }
    if (this.length !== line.length) {
      this._data = new Uint32Array(line._data.subarray(0, line.length * Constants.CELL_INDICIES));
    } else {
      // use high speed copy if lengths are equal
      this._data.set(line._data.subarray(0, line.length * Constants.CELL_INDICIES));
    }
    this.length = line.length;
    this._logicalCellCount = line._logicalCellCount || line.length;
    this._combined = {};
    for (const el in line._combined) {
      const key = parseInt(el, 10);
      if (key < this._logicalCellCount) {
        this._combined[key] = line._combined[el];
      }
    }
    this._extendedAttrs = {};
    for (const el in line._extendedAttrs) {
      const key = parseInt(el, 10);
      if (key < this._logicalCellCount) {
        this._extendedAttrs[key] = line._extendedAttrs[el];
      }
    }
    this.isWrapped = line.isWrapped;
  }

  public materializeFromLogicalHead(fillCellData: ICellData): BufferLine {
    if (!this._logicalHead) {
      return this;
    }
    const standalone = new BufferLine(this._stringCache, this.length, fillCellData, false);
    standalone.copyCellsFrom(this._logicalHead, this._segmentStart, 0, this.length, false);
    this._logicalHead.unregisterOverflowRow();
    this._data = standalone._data;
    this._combined = standalone._combined;
    this._extendedAttrs = standalone._extendedAttrs;
    this._logicalHead = undefined;
    this._segmentStart = 0;
    this._logicalCellCount = this.length;
    this.isWrapped = false;
    return this;
  }

  /** create a new clone */
  public clone(): IBufferLine {
    if (this._logicalHead) {
      const newLine = new BufferLine(this._stringCache, 0, undefined, true, this._logicalHead, this._segmentStart);
      newLine.length = this.length;
      return newLine;
    }
    const newLine = new BufferLine(this._stringCache, 0, undefined, false);
    newLine._data = new Uint32Array(this._data.subarray(0, this._logicalCellCount * Constants.CELL_INDICIES));
    newLine.length = this.length;
    newLine._logicalCellCount = this._logicalCellCount;
    newLine._overflowRowCount = this._overflowRowCount;
    for (const el in this._combined) {
      newLine._combined[el] = this._combined[el];
    }
    for (const el in this._extendedAttrs) {
      newLine._extendedAttrs[el] = this._extendedAttrs[el];
    }
    newLine.isWrapped = this.isWrapped;
    return newLine;
  }

  public getTrimmedLength(): number {
    for (let i = this.length - 1; i >= 0; --i) {
      const start = this._cellStartIndex(i);
      if ((this._data[start + Cell.CONTENT] & Content.HAS_CONTENT_MASK)) {
        return i + (this._data[start + Cell.CONTENT] >> Content.WIDTH_SHIFT);
      }
    }
    return 0;
  }

  /** Creates a standalone line containing the full logical line content. */
  public toStandaloneLogicalLine(cols: number, fillCellData: ICellData, stringCache: IBufferLineStringCache): BufferLine {
    const head = this._logicalHead ?? this;
    const trimmed = head.getLogicalTrimmedLength();
    const flat = new BufferLine(stringCache, cols, fillCellData, false);
    if (trimmed > 0) {
      flat.copyCellsFrom(head, 0, 0, trimmed, false);
      flat._logicalCellCount = trimmed;
    }
    head.clearReflowMergedState();
    return flat;
  }

  /** Trimmed length across the entire logical line (all segments). */
  public getLogicalTrimmedLength(): number {
    const head = this._logicalHead ?? this;
    for (let i = head._logicalCellCount - 1; i >= 0; --i) {
      const start = i * Constants.CELL_INDICIES;
      if ((head._data[start + Cell.CONTENT] & Content.HAS_CONTENT_MASK)) {
        return i + (head._data[start + Cell.CONTENT] >> Content.WIDTH_SHIFT);
      }
    }
    return 0;
  }

  public getNoBgTrimmedLength(): number {
    for (let i = this.length - 1; i >= 0; --i) {
      const start = this._cellStartIndex(i);
      if ((this._data[start + Cell.CONTENT] & Content.HAS_CONTENT_MASK) || (this._data[start + Cell.BG] & Attributes.CM_MASK)) {
        return i + (this._data[start + Cell.CONTENT] >> Content.WIDTH_SHIFT);
      }
    }
    return 0;
  }

  public copyCellsFrom(src: BufferLine, srcCol: number, destCol: number, length: number, applyInReverse: boolean): void {
    this._invalidateStringCache();
    const srcData = src._data;
    const srcOffset = src._segmentStart;
    const destOffset = this._segmentStart;
    if (applyInReverse) {
      for (let cell = length - 1; cell >= 0; cell--) {
        const srcStart = (srcOffset + srcCol + cell) * Constants.CELL_INDICIES;
        const destStart = (destOffset + destCol + cell) * Constants.CELL_INDICIES;
        for (let i = 0; i < Constants.CELL_INDICIES; i++) {
          this._data[destStart + i] = srcData[srcStart + i];
        }
        if (srcData[srcStart + Cell.BG] & BgFlags.HAS_EXTENDED) {
          const absSrc = srcOffset + srcCol + cell;
          const absDest = destOffset + destCol + cell;
          this._extendedAttrs[absDest] = src._extendedAttrs[absSrc];
        }
      }
    } else {
      for (let cell = 0; cell < length; cell++) {
        const srcStart = (srcOffset + srcCol + cell) * Constants.CELL_INDICIES;
        const destStart = (destOffset + destCol + cell) * Constants.CELL_INDICIES;
        for (let i = 0; i < Constants.CELL_INDICIES; i++) {
          this._data[destStart + i] = srcData[srcStart + i];
        }
        if (srcData[srcStart + Cell.BG] & BgFlags.HAS_EXTENDED) {
          const absSrc = srcOffset + srcCol + cell;
          const absDest = destOffset + destCol + cell;
          this._extendedAttrs[absDest] = src._extendedAttrs[absSrc];
        }
      }
    }

    // Move any combined data over as needed, FIXME: repeat for extended attrs
    const srcCombinedKeys = Object.keys(src._combined);
    for (let i = 0; i < srcCombinedKeys.length; i++) {
      const key = parseInt(srcCombinedKeys[i], 10);
      const srcAbsCol = srcOffset + srcCol;
      if (key >= srcAbsCol && key < srcAbsCol + length) {
        this._combined[key - srcCol + destOffset + destCol] = src._combined[key];
      }
    }
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
    const isCanonicalRequest = (startCol === undefined || startCol === 0) && endCol === undefined && outColumns === undefined;
    if (isCanonicalRequest) {
      this._stringCache.touch?.();
    }
    const stringCacheEntry = isCanonicalRequest ? this._getStringCacheEntry(false) : undefined;
    if (isCanonicalRequest && stringCacheEntry?.value !== undefined) {
      if (trimRight) {
        return stringCacheEntry.isTrimmed ? stringCacheEntry.value : stringCacheEntry.value.trimEnd();
      }
      if (!stringCacheEntry.isTrimmed) {
        return stringCacheEntry.value;
      }
    }
    startCol = startCol ?? 0;
    endCol = endCol ?? this.length;
    if (trimRight) {
      endCol = Math.min(endCol, this.getTrimmedLength());
    }
    if (outColumns) {
      outColumns.length = 0;
    }
    $translateToStringBuilder.reset();
    while (startCol < endCol) {
      const abs = this._absoluteColumn(startCol);
      const start = this._cellStartIndex(startCol);
      const content = this._data[start + Cell.CONTENT];
      const cp = content & Content.CODEPOINT_MASK;
      const chars = (content & Content.IS_COMBINED_MASK)
        ? (this._combined[abs] ?? '')
        : (cp) ? stringFromCodePoint(cp) : WHITESPACE_CELL_CHAR;
      $translateToStringBuilder.append(chars);
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
    const result = $translateToStringBuilder.toString();
    $translateToStringBuilder.reset();
    if (isCanonicalRequest) {
      const cacheEntry = this._getStringCacheEntry(true)!;
      cacheEntry.value = result;
      cacheEntry.isTrimmed = !!trimRight;
    }
    return result;
  }

  protected _getStringCacheEntry(createIfNeeded: boolean): IBufferLineStringCacheEntry | undefined {
    const cachedEntry = this._stringCacheEntryRef?.deref();
    if (cachedEntry) {
      if (cachedEntry.generation === this._stringCache.generation) {
        return cachedEntry;
      }
    }
    if (!createIfNeeded) {
      return undefined;
    }
    const cacheEntry = this._stringCache.allocateEntry();
    this._stringCacheEntryRef = new WeakRef(cacheEntry);
    return cacheEntry;
  }

  protected _invalidateStringCache(): void {
    const head = this._logicalHead ?? this;
    const cacheEntry = head._getStringCacheEntry(false);
    if (cacheEntry) {
      cacheEntry.value = undefined;
      cacheEntry.isTrimmed = false;
    }
  }
}
