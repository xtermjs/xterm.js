/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { CharData, IInputHandler, IAttributeData, IBufferLine, ICellData, IExtendedAttrs } from 'common/Types';
import { AttributeData } from 'common/buffer/AttributeData';
import { CellData } from 'common/buffer/CellData';
import { Attributes, BgFlags, CHAR_DATA_ATTR_INDEX, CHAR_DATA_CHAR_INDEX, CHAR_DATA_WIDTH_INDEX, Content, StyleFlags, NULL_CELL_CHAR, NULL_CELL_CODE, NULL_CELL_WIDTH, WHITESPACE_CELL_CHAR } from 'common/buffer/Constants';
import { stringFromCodePoint, utf32ToString } from 'common/input/TextDecoder';
import { UnicodeService } from 'common/services/UnicodeService';

export const DEFAULT_ATTR_DATA = Object.freeze(new AttributeData());

const EMPTY_DATA = new Uint32Array(0);

// Work variables to avoid garbage collection
let $startIndex = 0;

/** Factor when to cleanup underlying array buffer after shrinking. */
const CLEANUP_THRESHOLD = 2;

export abstract class AbstractBufferLine implements IBufferLine {
  /** Number of logical columns */
  length: number = 0;
  _isWrapped: boolean = false;
  get isWrapped(): boolean { return this._isWrapped; }
  //abstract eraseAll(bg: number): void;
  abstract insertCells(pos: number, n: number, fillCellData: ICellData, eraseAttr?: IAttributeData): void;
  abstract addCodepointToCell(index: number, codePoint: number, width: number): void; // DEPRECATED
  abstract resize(cols: number, fillCellData: ICellData): boolean;
  abstract fill(fillCellData: ICellData, respectProtect: boolean): void;
  abstract copyFrom(line: BufferLine): void;
  abstract clone(): IBufferLine;
  abstract translateToString(trimRight: boolean, startCol: number, endCol: number): string;
  abstract getTrimmedLength(): number;
  abstract getNoBgTrimmedLength(): number;
  abstract cleanupMemory(): number;

  abstract loadCell(index: number, cell: ICellData): ICellData;

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
   * Get cell data CharData.
   * @deprecated
   */
  get(index: number): CharData {
    let cell = new CellData();
    this.loadCell(index, cell);
    return cell.getAsCharData();
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
    return this.loadCell(index, new CellData()).content >>> Content.WIDTH_SHIFT;
  }

  /** Test whether content has width. */
  public hasWidth(index: number): number {
    return this.loadCell(index, new CellData()).content & Content.WIDTH_MASK;
  }

  /** Get FG cell component. */
  public getFg(index: number): number {
    return this.loadCell(index, new CellData()).fg;
  }

  /** Get BG cell component. @deprecated */
  public getBg(index: number): number {
    return this.loadCell(index, new CellData()).bg;
  }

  /**
   * Test whether contains any chars. @deprecated
   * Basically an empty has no content, but other cells might differ in FG/BG
   * from real empty cells.
   */
  public hasContent(index: number): number {
    return this.loadCell(index, new CellData()).content & Content.HAS_CONTENT_MASK;
  }

  abstract setCellFromCodepoint(index: number, codePoint: number, width: number,  attrs: IAttributeData): void;
  /**
   * Set data at `index` to `cell`. FIXME doesn't handle combined chars.
   */
  public setCell(index: number, cell: ICellData): void {
    this.setCellFromCodepoint(index, cell.getCode(), cell.getWidth(), cell);
  }

  /**
   * Get codepoint of the cell. @deprecated
   * To be in line with `code` in CharData this either returns
   * a single UTF32 codepoint or the last codepoint of a combined string.
   */
  public getCodePoint(index: number): number {
    return this.loadCell(index, new CellData()).getCode();
  }

  /** Test whether the cell contains a combined string. */
  public isCombined(index: number): number {
    return this.loadCell(index, new CellData()).isCombined();
  }

  abstract deleteCells(pos: number, n: number, fillCellData: ICellData): void;

  /** Returns the string content of the cell. @deprecated  */
  public getString(index: number): string {
    const cell = new CellData();
    this.loadCell(index, cell);
    return cell.getChars();
  }

  /** Get state of protected flag. @deprecated */
  public isProtected(index: number): number {
    return this.loadCell(index, new CellData()).bg & BgFlags.PROTECTED;
  }

}

const enum DataKind { // 4 bits
  FG = 1, // lower 26 bits is RGB foreground color and CM_MASK
  BG = 2, // lower 26 bits is RGB background color and CM_MASK
  STYLE_FLAGS = 3, // lower 26 bits is StyleFlags

  SKIP_COLUMNS = 7, // empty ("null") columns (28 bit count)
  // The following have a 21-bit codepoint value in the low-order bits
  CHAR_w1 = 8, // single-non-compound, 1 column wide
  CHAR_w2 = 9, // single-non-compound, 2 columns wide
  // CLUSTER_START_xx have a 7=bit for number of CONTINUED entries
  CLUSTER_START_w1 = 10, // start of non-trivial cluster, 1 column wide
  CLUSTER_START_w2 = 11, // start of non-trivial cluster, 2 columns wide
  CLUSTER_CONTINUED = 12 // continuation of cluster
}

const NULL_DATA_WORD = DataKind.SKIP_COLUMNS << 28;

export var USE_NewBufferLine = true;

export abstract class BufferLine extends AbstractBufferLine implements IBufferLine {
  static make(cols: number, fillCellData?: ICellData, isWrapped: boolean = false): BufferLine {
    if (USE_NewBufferLine) {
      // if (isWrapped) new WrappedBufferLine(...);
      return new LogicalBufferLine(cols, fillCellData);
    } else {
      return new OldBufferLine(cols, fillCellData, isWrapped);
    }
  }

  public abstract copyCellsFrom(src: BufferLine, srcCol: number, destCol: number, length: number, applyInReverse: boolean): void;

  public translateToString(trimRight: boolean = false, startCol: number = 0, endCol: number = this.length, skipReplace: string = WHITESPACE_CELL_CHAR): string {
   if (trimRight) {
      endCol = Math.min(endCol, this.getTrimmedLength());
    }
    let result = '';
    const cell = new CellData();
    while (startCol < endCol) {
      this.loadCell(startCol, cell);
      const content = cell.content;
      const cp = content & Content.CODEPOINT_MASK;
      result += cp ? cell.getChars() : skipReplace;
      startCol += (content >> Content.WIDTH_SHIFT) || 1; // always advance by 1
    }
    return result;
  }

  // FOLLOWING ONLY USED BY NewBufferLine
  /** From a Uint23 in _data, extract the DataKind bits. */
  protected static wKind(word: number): DataKind { return word >>> 28; }
  protected static wKindIsText(kind: DataKind): boolean { return kind >= DataKind.CHAR_w1 && kind <= DataKind.CLUSTER_CONTINUED; }
  protected static wKindIsTextOrSkip(kind: DataKind): boolean { return kind >= DataKind.SKIP_COLUMNS && kind <= DataKind.CLUSTER_CONTINUED; }
  /** From a Uint23 in _data, extract length of string within _text.
    * Only for SKIP_COLUMNS. */
  protected static wSkipCount(word: number): number { return word & 0xfffff; }
  protected static wSet1(kind: DataKind, value: number): number {
    return (kind << 28) | (value & 0x0fffffff);
  }
}

// FOLLOWING ONLY APPLIES for OldBufferLine

/**
 * buffer memory layout:
 *
 *   |             uint32_t             |        uint32_t         |        uint32_t         |
 *   |             `content`            |          `FG`           |          `BG`           |
 *   | wcwidth(2) comb(1) codepoint(21) | flags(8) R(8) G(8) B(8) | flags(8) R(8) G(8) B(8) |
 */


/** typed array slots taken by one cell */
const CELL_SIZE = 3;

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

// This class will be removed at some point

export class OldBufferLine extends BufferLine implements IBufferLine {
  protected _data: Uint32Array;
  protected _combined: {[index: number]: string} = {};
  protected _extendedAttrs: {[index: number]: IExtendedAttrs | undefined} = {};
  public length: number;

  constructor(cols: number, fillCellData?: ICellData, isWrapped: boolean = false) {
    super();
    this._isWrapped = isWrapped;
    this._data = new Uint32Array(cols * CELL_SIZE);
    const cell = fillCellData || CellData.fromCharData([0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]);
    for (let i = 0; i < cols; ++i) {
      this.setCell(i, cell);
    }
    this.length = cols;
    this._isWrapped = isWrapped;
  }

  /**
   * Get cell data CharData.
   * @deprecated
   */
  public get(index: number): CharData {
    const content = this._data[index * CELL_SIZE + Cell.CONTENT];
    const cp = content & Content.CODEPOINT_MASK;
    return [
      this._data[index * CELL_SIZE + Cell.FG],
      (content & Content.IS_COMBINED_MASK)
        ? this._combined[index]
        : (cp) ? stringFromCodePoint(cp) : '',
      content >> Content.WIDTH_SHIFT,
      (content & Content.IS_COMBINED_MASK)
        ? this._combined[index].charCodeAt(this._combined[index].length - 1)
        : cp
    ];
  }

  /**
   * Set cell data from CharData.
   * @deprecated
   */
  public set(index: number, value: CharData): void {
    this._data[index * CELL_SIZE + Cell.FG] = value[CHAR_DATA_ATTR_INDEX];
    if (value[CHAR_DATA_CHAR_INDEX].length > 1) {
      this._combined[index] = value[1];
      this._data[index * CELL_SIZE + Cell.CONTENT] = index | Content.IS_COMBINED_MASK | (value[CHAR_DATA_WIDTH_INDEX] << Content.WIDTH_SHIFT);
    } else {
      this._data[index * CELL_SIZE + Cell.CONTENT] = value[CHAR_DATA_CHAR_INDEX].charCodeAt(0) | (value[CHAR_DATA_WIDTH_INDEX] << Content.WIDTH_SHIFT);
    }
  }

  /**
   * primitive getters
   * use these when only one value is needed, otherwise use `loadCell`
   */
  public getWidth(index: number): number {
    return this._data[index * CELL_SIZE + Cell.CONTENT] >> Content.WIDTH_SHIFT;
  }

  /** Test whether content has width. */
  public hasWidth(index: number): number {
    return this._data[index * CELL_SIZE + Cell.CONTENT] & Content.WIDTH_MASK;
  }

  /** Get FG cell component. */
  public getFg(index: number): number {
    return this._data[index * CELL_SIZE + Cell.FG];
  }

  /** Get BG cell component. */
  public getBg(index: number): number {
    return this._data[index * CELL_SIZE + Cell.BG];
  }

  /**
   * Test whether contains any chars.
   * Basically an empty has no content, but other cells might differ in FG/BG
   * from real empty cells.
   */
  public hasContent(index: number): number {
    return this._data[index * CELL_SIZE + Cell.CONTENT] & Content.HAS_CONTENT_MASK;
  }

  /**
   * Get codepoint of the cell.
   * To be in line with `code` in CharData this either returns
   * a single UTF32 codepoint or the last codepoint of a combined string.
   */
  public getCodePoint(index: number): number {
    const content = this._data[index * CELL_SIZE + Cell.CONTENT];
    if (content & Content.IS_COMBINED_MASK) {
      return this._combined[index].charCodeAt(this._combined[index].length - 1);
    }
    return content & Content.CODEPOINT_MASK;
  }

  /** Test whether the cell contains a combined string. */
  public isCombined(index: number): number {
    return this._data[index * CELL_SIZE + Cell.CONTENT] & Content.IS_COMBINED_MASK;
  }
  /** Returns the string content of the cell. */
  public getString(index: number): string {
    const content = this._data[index * CELL_SIZE + Cell.CONTENT];
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
    return this._data[index * CELL_SIZE + Cell.BG] & BgFlags.PROTECTED;
  }

  /**
   * Load data at `index` into `cell`. This is used to access cells in a way that's more friendly
   * to GC as it significantly reduced the amount of new objects/references needed.
   */
  public loadCell(index: number, cell: ICellData): ICellData {
    $startIndex = index * CELL_SIZE;
    cell.content = this._data[$startIndex + Cell.CONTENT];
    cell.fg = this._data[$startIndex + Cell.FG];
    cell.bg = this._data[$startIndex + Cell.BG];
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
  public setCell(index: number, cell: ICellData): void {
    if (cell.content & Content.IS_COMBINED_MASK) {
      this._combined[index] = cell.combinedData;
    }
    if (cell.bg & BgFlags.HAS_EXTENDED) {
      this._extendedAttrs[index] = cell.extended;
    }
    this._data[index * CELL_SIZE + Cell.CONTENT] = cell.content;
    this._data[index * CELL_SIZE + Cell.FG] = cell.fg;
    this._data[index * CELL_SIZE + Cell.BG] = cell.bg;
  }

  /**
   * Set cell data from input handler.
   * Since the input handler see the incoming chars as UTF32 codepoints,
   * it gets an optimized access method.
   */
  public setCellFromCodepoint(index: number, codePoint: number, width: number, attrs: IAttributeData): void {
    if (attrs.bg & BgFlags.HAS_EXTENDED) {
      this._extendedAttrs[index] = attrs.extended;
    }
    this._data[index * CELL_SIZE + Cell.CONTENT] = codePoint | (width << Content.WIDTH_SHIFT);
    this._data[index * CELL_SIZE + Cell.FG] = attrs.fg;
    this._data[index * CELL_SIZE + Cell.BG] = attrs.bg;
  }

  /**
   * Add a codepoint to a cell from input handler.
   * During input stage combining chars with a width of 0 follow and stack
   * onto a leading char. Since we already set the attrs
   * by the previous `setDataFromCodePoint` call, we can omit it here.
   */
  public addCodepointToCell(index: number, codePoint: number, width: number): void {
    let content = this._data[index * CELL_SIZE + Cell.CONTENT];
    if (content & Content.IS_COMBINED_MASK) {
      // we already have a combined string, simply add
      this._combined[index] += stringFromCodePoint(codePoint);
    } else {
      if (content & Content.CODEPOINT_MASK) {
        // normal case for combining chars:
        //  - move current leading char + new one into combined string
        //  - set combined flag
        this._combined[index] = stringFromCodePoint(content & Content.CODEPOINT_MASK) + stringFromCodePoint(codePoint);
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
    this._data[index * CELL_SIZE + Cell.CONTENT] = content;
  }
  public insertCells(pos: number, n: number, fillCellData: ICellData): void {
    pos %= this.length;

    // handle fullwidth at pos: reset cell one to the left if pos is second cell of a wide char
    if (pos && this.getWidth(pos - 1) === 2) {
      this.setCellFromCodepoint(pos - 1, 0, 1, fillCellData);
    }

    if (n < this.length - pos) {
      const cell = new CellData();
      for (let i = this.length - pos - n - 1; i >= 0; --i) {
        this.setCell(pos + n + i, this.loadCell(pos + i, cell));
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
      const cell = new CellData();
      for (let i = 0; i < this.length - pos - n; ++i) {
        this.setCell(pos + i, this.loadCell(pos + n + i, cell));
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
      this.setCellFromCodepoint(pos, 0, 1,fillCellData);
    }
  }

  /**
   * Resize BufferLine to `cols` filling excess cells with `fillCellData`.
   * The underlying array buffer will not change if there is still enough space
   * to hold the new buffer line data.
   * Returns a boolean indicating, whether a `cleanupMemory` call would free
   * excess memory (true after shrinking > CLEANUP_THRESHOLD).
   */
  public resize(cols: number, fillCellData: ICellData): boolean {
    if (cols === this.length) {
      return this._data.length * 4 * CLEANUP_THRESHOLD < this._data.buffer.byteLength;
    }
    const uint32Cells = cols * CELL_SIZE;
    if (cols > this.length) {
      if (this._data.buffer.byteLength >= uint32Cells * 4) {
        // optimization: avoid alloc and data copy if buffer has enough room
        this._data = new Uint32Array(this._data.buffer, 0, uint32Cells);
      } else {
        // slow path: new alloc and full data copy
        const data = new Uint32Array(uint32Cells);
        data.set(this._data);
        this._data = data;
      }
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
    return uint32Cells * 4 * CLEANUP_THRESHOLD < this._data.buffer.byteLength;
  }

  /**
   * Cleanup underlying array buffer.
   * A cleanup will be triggered if the array buffer exceeds the actual used
   * memory by a factor of CLEANUP_THRESHOLD.
   * Returns 0 or 1 indicating whether a cleanup happened.
   */
  public cleanupMemory(): number {
    if (this._data.length * 4 * CLEANUP_THRESHOLD < this._data.buffer.byteLength) {
      const data = new Uint32Array(this._data.length);
      data.set(this._data);
      this._data = data;
      return 1;
    }
    return 0;
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
    this._combined = {};
    this._extendedAttrs = {};
    for (let i = 0; i < this.length; ++i) {
      this.setCell(i, fillCellData);
    }
  }

  /** alter to a full copy of line  */
  public copyFrom(xline: BufferLine): void {
    const line = xline as OldBufferLine;
    if (this.length !== line.length) {
      this._data = new Uint32Array(line._data);
    } else {
      // use high speed copy if lengths are equal
      this._data.set(line._data);
    }
    this.length = line.length;
    this._combined = {};
    for (const el in line._combined) {
      this._combined[el] = line._combined[el];
    }
    this._extendedAttrs = {};
    for (const el in line._extendedAttrs) {
      this._extendedAttrs[el] = line._extendedAttrs[el];
    }
    this._isWrapped = line.isWrapped;
  }

  /** create a new clone */
  public clone(): IBufferLine {
    const newLine = new OldBufferLine(0);
    newLine._data = new Uint32Array(this._data);
    newLine.length = this.length;
    for (const el in this._combined) {
      newLine._combined[el] = this._combined[el];
    }
    for (const el in this._extendedAttrs) {
      newLine._extendedAttrs[el] = this._extendedAttrs[el];
    }
    newLine._isWrapped = this.isWrapped;
    return newLine as IBufferLine;
  }

  public getTrimmedLength(): number {
    for (let i = this.length - 1; i >= 0; --i) {
      if ((this._data[i * CELL_SIZE + Cell.CONTENT] & Content.HAS_CONTENT_MASK)) {
        return i + (this._data[i * CELL_SIZE + Cell.CONTENT] >> Content.WIDTH_SHIFT);
      }
    }
    return 0;
  }

  public getNoBgTrimmedLength(): number {
    for (let i = this.length - 1; i >= 0; --i) {
      if ((this._data[i * CELL_SIZE + Cell.CONTENT] & Content.HAS_CONTENT_MASK) || (this._data[i * CELL_SIZE + Cell.BG] & Attributes.CM_MASK)) {
        return i + (this._data[i * CELL_SIZE + Cell.CONTENT] >> Content.WIDTH_SHIFT);
      }
    }
    return 0;
  }

  public copyCellsFrom(xsrc: BufferLine, srcCol: number, destCol: number, length: number, applyInReverse: boolean): void {
    const src = xsrc as OldBufferLine;
    const srcData = src._data;
    if (applyInReverse) {
      for (let cell = length - 1; cell >= 0; cell--) {
        for (let i = 0; i < CELL_SIZE; i++) {
          this._data[(destCol + cell) * CELL_SIZE + i] = srcData[(srcCol + cell) * CELL_SIZE + i];
        }
        if (srcData[(srcCol + cell) * CELL_SIZE + Cell.BG] & BgFlags.HAS_EXTENDED) {
          this._extendedAttrs[destCol + cell] = src._extendedAttrs[srcCol + cell];
        }
      }
    } else {
      for (let cell = 0; cell < length; cell++) {
        for (let i = 0; i < CELL_SIZE; i++) {
          this._data[(destCol + cell) * CELL_SIZE + i] = srcData[(srcCol + cell) * CELL_SIZE + i];
        }
        if (srcData[(srcCol + cell) * CELL_SIZE + Cell.BG] & BgFlags.HAS_EXTENDED) {
          this._extendedAttrs[destCol + cell] = src._extendedAttrs[srcCol + cell];
        }
      }
    }

    // Move any combined data over as needed, FIXME: repeat for extended attrs
    const srcCombinedKeys = Object.keys(src._combined);
    for (let i = 0; i < srcCombinedKeys.length; i++) {
      const key = parseInt(srcCombinedKeys[i], 10);
      if (key >= srcCol) {
        this._combined[key - srcCol + destCol] = src._combined[key];
      }
    }
  }
}

// This class will be merged with its parent when OldBufferLine is removed,

export abstract class NewBufferLine extends BufferLine implements IBufferLine {
  /** Color for "rest of line" background, following _dataLength. */
  lineEndBg: number = 0;

  nextRowSameLine: WrappedBufferLine | undefined;

  /** The "current" index into the _data array.
   * The index must be either dataLength() or wKindIsTextOrSkip must be true.
   * (The index never points to a CLUSTER_CONTINUED item.)
   */
  _cachedDataIndex(): number { return this.logicalLine()._cache1 >>> 16; }
  /** The logical column number corresponding to _cachedDataIndex(). */
  _cachedColumn(): number { return this.logicalLine()._cache1 & 0xFFFF; }
  protected abstract _cachedColumnInRow(): number;
  //private _cachedColOffset(): number { return this._cache3 >> 24; } // UNUSED
  protected _cachedBg(): number { return this.logicalLine()._cache2; }
  protected _cachedFg(): number { return this.logicalLine()._cache3; }
  // One more than index (in data()) of STYLE_FLAGS; 0 if none.
  protected _cachedStyleFlagsIndex(): number { return this.logicalLine()._cache4; }
  protected _cacheReset(): void { const line = this.logicalLine(); line._cache1 = 0; line._cache2 = 0; line._cache3 = 0; line._cache4 = 0; }
  protected _cacheSetFgBg(fg: number, bg: number): void { const line = this.logicalLine(); line._cache2 = bg; line._cache3 = fg; }
  protected _cacheSetStyleFlagsIndex(index: number): void { this.logicalLine()._cache4 = index; }
  protected _cacheSetColumnDataIndex(column: number, dataIndex: number): void { this.logicalLine()._cache1 = (dataIndex << 16) | (column & 0xFFFF); }

  public setStartFromCache(wrapRow: WrappedBufferLine): void {
    wrapRow.startIndex = this._cachedDataIndex();
    wrapRow.startColumn = this._cachedColumn();
    wrapRow.startBg = this._cachedBg();
    wrapRow.startFg = this._cachedFg();
    wrapRow.startStyle = this._cachedStyleFlagsIndex();
  }

  constructor() {
    super();
  }
  // Length of data() array.
  protected abstract dataLength(): number;
  // End of current row in data() array.
  protected dataRowEnd(): number {
    return this.nextRowSameLine ? this.nextRowSameLine.startIndex : this.dataLength();
  }
  // Key is index in _data array that has STYLE_FLAGS kind with HAS_EXTENDED.
  protected _extendedAttrs: IExtendedAttrs[] = [];
  //protected _extendedAttrs: {[index: number]: IExtendedAttrs | undefined} = {};
  //public length: number;

  abstract logicalLine(): LogicalBufferLine;
  abstract data(): Uint32Array;
  abstract resizeData(size: number): void;
  abstract addEmptyDataElements(position: number, count: number): void;

  /**
   * primitive getters
   * use these when only one value is needed, otherwise use `loadCell`
   */
  public getWidth(index: number): number {
    return this.moveToColumn(index) >>> Content.WIDTH_SHIFT;
  }

  /** Test whether content has width. */
  public hasWidth(index: number): number {
    return this.moveToColumn(index) & Content.WIDTH_MASK;
  }

  /** Get FG cell component. */
  public getFg(index: number): number {
    this.moveToColumn(index);
    const styleIndex = this._cachedStyleFlagsIndex();
    const styleWord = styleIndex > 0 ? this.data()[styleIndex - 1] : 0;
    return this._cachedFg() | ((styleWord << 24) & Attributes.STYLE_BITS_MASK);
  }

  /** Get BG cell component. @deprecated */
  public getBg(index: number): number {
    this.moveToColumn(index);
    const styleIndex = this._cachedStyleFlagsIndex();
    const styleWord = styleIndex > 0 ? this.data()[styleIndex - 1] : 0;
    return this._cachedBg() | ((styleWord << 16) & Attributes.STYLE_BITS_MASK);
  }

  /**
   * Test whether contains any chars. @deprecated
   * Basically an empty has no content, but other cells might differ in FG/BG
   * from real empty cells.
   */
  public hasContent(index: number): number {
    return this.moveToColumn(index) & Content.HAS_CONTENT_MASK;
  }

  /** Test whether the cell contains a combined string. */
  public isCombined(index: number): number {
    return this.moveToColumn(index) & Content.IS_COMBINED_MASK;
  }

  /** for debugging */
  getText(skipReplace: string = ' '): string {
    return this.translateToString(true, 0, this.length, skipReplace);
  }

  /* Human-readable display of data() array, for debugging */
  _showData(start = 0, end = this.dataLength()) {
    let s = '[';
    let toffset = 0;
    for (let i = 0; i < end; i++) {
      const word = this.data()[i];
      const kind = BufferLine.wKind(word);
      let code: string | number = kind;
      const wnum = word & 0xfffffff;
      switch (kind) {
        case DataKind.FG: code = 'FG'; break;
        case DataKind.BG: code = 'BG'; break;
        case DataKind.STYLE_FLAGS: code = 'STYLE'; break;
        case DataKind.SKIP_COLUMNS: code = 'SKIP'; break;
        case DataKind.CLUSTER_START_w1: code = 'CL1'; break;
        case DataKind.CLUSTER_START_w2: code = 'CL2'; break;
        case DataKind.CLUSTER_CONTINUED: code = 'CL_CONT'; break;
        case DataKind.CHAR_w1: code = 'C1'; break;
        case DataKind.CHAR_w2: code = 'C2'; break;
      }
      if (i >= start) {
        if (i !== start) {
          s += ', ';
        }
        let value;
        if (kind === DataKind.CHAR_w1 || kind === DataKind.CHAR_w2) {
            let count = 1;
            while (i + count < end && BufferLine.wKind(this.data()[i + count]) === kind) {
                count++;
            }
            let str;
            if (count === 1) {
              str = stringFromCodePoint(word & 0x1fffff);
            } else {
                str = utf32ToString(this.data(), i, i + count);
                code = code + '*' + count;
                i += count - 1;
            }
            value = JSON.stringify(str);
        } else if (kind === DataKind.CLUSTER_START_w1
            || kind === DataKind.CLUSTER_START_w2) {
          // FIXME extract cluster as string
          value = '*' + (word & 0x1fffff);
        } else if (kind === DataKind.CLUSTER_CONTINUED) {
          value = '*' + (word & 0x1fffff);
        } else if (kind === DataKind.BG || kind === DataKind.FG) {
          value = (wnum >> 24) + '#' + (wnum & 0xffffff).toString(16);
        } else if (DataKind.STYLE_FLAGS) {
          value = '#' + (wnum & 0xfffffff).toString(16);
        } else if (kind !== DataKind.SKIP_COLUMNS) {
          value = wnum;
        } else {
          value = wnum.toString();
        }
        s += code + ': ' + value;
      }
    }
    return s + ']';
  }

  /** Check invariants. Useful for debugging. */
  _check(): void {
    function error(str: string) {
      console.log("ERROR: "+str);
    }
    let itext = 0;
    let icol = 0;
    if (this.dataLength() < 0 || this.dataLength() > this.data().length)
      error("bad _dataLength");
    const incrementText = (wlen: number) => {
    };
    for (let idata = 0; idata < this.dataLength(); idata++) {
      const word = this.data()[idata];
      const kind = BufferLine.wKind(word);
      switch (kind) {
        case DataKind.FG:
        case DataKind.BG:
          break;
        case DataKind.STYLE_FLAGS:
          break;
        case DataKind.SKIP_COLUMNS:
          break;
        case DataKind.CHAR_w1:
        case DataKind.CHAR_w2:
        case DataKind.CLUSTER_START_w1:
        case DataKind.CLUSTER_START_w2:
        case DataKind.CLUSTER_CONTINUED:
          break;
        default:
          error("invalid _dataKind");
      }
    }
  }

  /**
   * Get cell data CharData.
   * @deprecated
   */
  public get(index: number): CharData {
    return this.loadCell(index, new CellData()).getAsCharData();
  }

  public clusterEnd(idata: number): number {
    // FIXME do we need to handle more than 7 bits of CLUSTED_CONTINUED?
    return idata + 1 + ((this.data()[idata] >> 21) & 0x3F);
  }

  public insertCells(pos: number, n: number, fillCellData: ICellData): void {
    alert("insertCells");
    /*
    pos %= this.length;

    // handle fullwidth at pos: reset cell one to the left if pos is second cell of a wide char
    if (pos && this.getWidth(pos - 1) === 2) {
      this.setCellFromCodepoint(pos - 1, 0, 1, fillCellData);
    }

    if (n < this.length - pos) {
      const cell = new CellData();
      for (let i = this.length - pos - n - 1; i >= 0; --i) {
        this.setCell(pos + n + i, this.loadCell(pos + i, cell));
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
    */
  }

  /** Move to column 'index'.
   * If 'logical' true, 'index' is relative to logical line;
   * otherwise relative to (and restricted to) this (screen) row.
   * Return encoded 'content'.
   */
  public moveToColumn(index: number, logical: boolean = false): number {
    const startColumn = ! logical && this instanceof WrappedBufferLine ? this.startColumn : 0;
    index += startColumn;
    let curColumn = this._cachedColumn();
    if (index < curColumn) {
      // FIXME can sometimes do better
      this._cacheReset();
      curColumn = 0;
    }
    let idata = this._cachedDataIndex();
    let fg = this._cachedFg();
    let bg = this._cachedBg();
    let styleFlagsIndex = this._cachedStyleFlagsIndex();
    let todo = index - curColumn;
    let word;
    let kind;
    let content = 0;
    const end = logical ? this.dataLength() : this.dataRowEnd();
    while (todo >= 0) {
      if (idata >= end) {
        word = NULL_DATA_WORD;
        kind = DataKind.SKIP_COLUMNS;
        content = (NULL_CELL_WIDTH << Content.WIDTH_SHIFT) | NULL_CELL_CODE;
        break;
      }
      word = this.data()[idata];
      kind = BufferLine.wKind(word);
      let w;
      switch (kind) {
        case DataKind.FG:
          fg = word & 0x3FFFFFF;
          idata++;
          break;
        case DataKind.BG:
          bg = word & 0x3FFFFFF;
          idata++;
          break;
        case DataKind.STYLE_FLAGS:
          idata++;
          styleFlagsIndex = idata;
          break;
        case DataKind.SKIP_COLUMNS:
          let wlen = BufferLine.wSkipCount(word);
          if (todo >= wlen) {
            todo -= wlen;
            idata++;
            curColumn += wlen;
          } else {
            content = (NULL_CELL_WIDTH << Content.WIDTH_SHIFT) | NULL_CELL_CODE;
            todo = -1;
          }
          break;
        case DataKind.CLUSTER_START_w1:
        case DataKind.CLUSTER_START_w2:
          w = kind + 1 - DataKind.CLUSTER_START_w1;
          if (todo >= w) {
            const clEnd = this.clusterEnd(idata);
            todo -= w;
            curColumn += w;
            idata = clEnd;
          } else {
            content = index !== curColumn ? 0
              : (w << Content.WIDTH_SHIFT) | Content.IS_COMBINED_MASK;
            todo = -1;
          }
          break;
        case DataKind.CHAR_w1:
        case DataKind.CHAR_w2:
          w = kind + 1 - DataKind.CHAR_w1; // 1, or 2 if wide characters
          if (todo >= w) {
            todo -= w;
            idata++;
            curColumn += w;
          } else {
            todo = -1;
            content = index !== curColumn ? 0
              : (w << Content.WIDTH_SHIFT) | (word & 0x1fffff);
          }
          break;
      }
    }
    this._cacheSetColumnDataIndex(curColumn, idata);
    this._cacheSetFgBg(fg, bg);
    this._cacheSetStyleFlagsIndex(styleFlagsIndex);
    return content;
  }

  /**
   * Load data at `index` into `cell`. This is used to access cells in a way that's more friendly
   * to GC as it significantly reduced the amount of new objects/references needed. @deprecated
   */
  public loadCell(index: number, cell: ICellData): ICellData {
    const cursor = cell as CellData;
    const content = this.moveToColumn(index);
    cursor.content = content;
    cursor.setFg(this._cachedFg());
    cursor.setBg(this._cachedBg());
    let styleFlagsIndex = this._cachedStyleFlagsIndex();
    const word = styleFlagsIndex > 0 ? this.data()[styleFlagsIndex - 1] : 0;
    cursor.setStyleFlags(word);
    if (word & StyleFlags.HAS_EXTENDED) {
      cursor.extended = this._extendedAttrs[styleFlagsIndex - 1]!;
    }
    if (content & Content.IS_COMBINED_MASK) {
      // FIXME do this lazily, in CellData.getChars
      let idata = this._cachedDataIndex();
      const str = utf32ToString(this.data(), idata, this.clusterEnd(idata));
      cursor.combinedData = str;
    }
    return cell;
  }

  public deleteCells(pos: number, n: number, fillCellData: ICellData): void {
    const content = this.moveToColumn(pos);
    let idata = this._cachedDataIndex();
    let curColumn = this._cachedColumn();
    this.logicalLine().deleteCellsOnly(idata, 0, n);
    // FIXME
    this.lineEndBg = fillCellData.bg;
  }

  private preInsert(index: number, attrs: IAttributeData): boolean {
    let content = this.moveToColumn(index);
    let curColumn = this._cachedColumn();
    const startColumn = curColumn;
    let idata = this._cachedDataIndex();

    // CASES:
    // 1. idata === dataLength() - easy.
    // 2. data()[idata] is SKIP_COLUMNS
    // -- split if curColumnn > 0 && curColumn < wlen
    // 3. kind is wKindIsText:
    // a. curColumn===index
    // b. index === curColumn + width
    // c. otherwise - in middle of wide char

    if ((content >> Content.WIDTH_SHIFT) === 2
      && index === curColumn + 1) {
      // In the middle of a wide character. Well-behaved applications are
      // unlikely to do this, so it's not worth optimizing.
      const clEnd = this.clusterEnd(idata);
      this.addEmptyDataElements(idata, idata - clEnd - 1);
      this.data()[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, 2);
    }
    // FIXME handle after dataLength() or in SKIP_COILUMNS

    // set attributes
    const newFg = attrs.getFg();
    const newBg = attrs.getBg();
    const newStyle = attrs.getStyleFlags();
    const oldFg = this._cachedFg();
    const oldBg = this._cachedBg();
    let styleFlagsIndex = this._cachedStyleFlagsIndex();
    const oldStyle = styleFlagsIndex > 0 ? this.data()[styleFlagsIndex - 1] : 0;
    const needFg = newFg !== oldFg;
    const needBg = newBg !== oldBg
    // FIXME let oldExt = (oldStyle & StyleFlags.HAS_EXTENDED) && cell.extended;
    //let newExt = (newStyle & StyleFlags.HAS_EXTENDED) && attrs.extended;
    const needStyle = newStyle !== oldStyle // FIXME || oldExt !== newExt;
    const atEnd = idata === this.dataLength();
    let add1 = atEnd ? 1 : 2;
    let add = (needBg?add1:0) + (needFg?add1:0) + (needStyle?add1:0);

    if (add) {
      this.addEmptyDataElements(idata, add);
      if (needFg) {
        this.data()[idata++] = BufferLine.wSet1(DataKind.FG, newFg);
      }
      if (needBg) {
        this.data()[idata++] = BufferLine.wSet1(DataKind.BG, newBg);
      }
      if (needStyle) {
        if (newStyle & StyleFlags.HAS_EXTENDED)
          this._extendedAttrs[idata] = attrs.extended;
        this._cacheSetStyleFlagsIndex(idata);
        this.data()[idata++] = BufferLine.wSet1(DataKind.STYLE_FLAGS, newStyle);
      }
      this._cacheSetColumnDataIndex(index, idata);
      let xdata = idata; // FIXME
      if (! atEnd) {
        if (needFg) {
          this.data()[xdata++] = BufferLine.wSet1(DataKind.FG, oldFg);
        }
        if (needStyle) {
          this.data()[xdata++] = BufferLine.wSet1(DataKind.STYLE_FLAGS, oldStyle);
        }
        if (needBg) {
          this.data()[xdata++] = BufferLine.wSet1(DataKind.BG, oldBg);
        }
      }
      this._cacheSetFgBg(newFg, newBg);
    }
    return add > 0;
  }

  public insertText(index: number, data: Uint32Array, start: number, end: number, attrs: IAttributeData, inputHandler: IInputHandler, insertMode: boolean): number {
    const add = this.preInsert(index, attrs);
    let curColumn = this._cachedColumn();
    const lline = this.logicalLine();
    const startColumn = curColumn;
    let idata = this._cachedDataIndex();
    let precedingJoinState = inputHandler.precedingJoinState;
    let inext;
    if (add || idata === this.dataLength() || index === curColumn)
        inext = idata;
    else {
        const kind = BufferLine.wKind(this.data()[idata]);
        if (BufferLine.wKindIsText(kind))
            inext = this.clusterEnd(idata);
        else
            inext = idata;
    }
    // FIXME optimize of overwriting simple text in-place
    this.addEmptyDataElements(inext, end - start);

    let cellColumn = curColumn;
    for (let i = start; i < end; i++) {
      // inext is the insertion point for the current codepoint
      // idata is the start of the most recent character or cluster,
      // assuming all codepoints from idata until inext are the same cluster.
      // If there is no preceding character/cluster that can be added to,
      // then idata === inext.
      const code = data[i];
      const currentInfo = inputHandler.unicodeService.charProperties(code, precedingJoinState);
      const chWidth = UnicodeService.extractWidth(currentInfo);
      const shouldJoin = UnicodeService.extractShouldJoin(currentInfo);
      const oldWidth = shouldJoin ? UnicodeService.extractWidth(precedingJoinState) : 0;
      precedingJoinState = currentInfo;
      let kind;
      if (shouldJoin) {
        kind = chWidth === 2 ? DataKind.CLUSTER_START_w2 : DataKind.CLUSTER_START_w1;
        const oldCount = (this.data()[idata] >> 21) & 0x3F;
        const startChar = this.data()[idata] & 0x1FFFFF;
        // FIXME check for count overflow;
        this.data()[idata] = BufferLine.wSet1(kind,
          startChar + ((oldCount + 1) << 21));
        kind = DataKind.CLUSTER_CONTINUED;
        curColumn += chWidth - oldWidth;
      } else {
        kind = chWidth === 2 ? DataKind.CHAR_w2 : DataKind.CHAR_w1;
        idata = inext;
        cellColumn = curColumn;
        curColumn += chWidth;
      }
      this.data()[inext++] = BufferLine.wSet1(kind, code);
    }
    inputHandler.precedingJoinState = precedingJoinState;
    this._cacheSetColumnDataIndex(cellColumn, idata);
    if (! insertMode && idata < this.dataLength()) {
      this.logicalLine().deleteCellsOnly(inext, 0, curColumn - startColumn);
    }
    if (curColumn > lline.logicalWidth)
      lline.logicalWidth = curColumn;
    return curColumn;
  }

  public eraseCells(start: number, end: number, attrs: IAttributeData): void {
    const add = this.preInsert(start, attrs);
    let idata = this._cachedDataIndex();
    let colOffset = start - this._cachedColumn();
    const lline = this.logicalLine();
    lline.deleteCellsOnly(idata, colOffset, end - start);
    idata = this._cachedDataIndex();
    const data = this.data();
    const count = end - start;
    if (idata > 0 && BufferLine.wKind(data[idata-1]) === DataKind.SKIP_COLUMNS) {
      if (idata === this.dataLength()) {
        end = start;
        idata--;
        lline._dataLength = idata;
      } else {
        data[idata-1] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, BufferLine.wSkipCount(data[idata - 1]) + count);
      }
    } else {
      if (idata === this.dataLength()) {
        return;
      }
      this.addEmptyDataElements(idata, 1);
      data[idata++] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, count);
    }
    this._cacheSetColumnDataIndex(end, idata);
  }

  public setCellFromCodepoint(index: number, codePoint: number, width: number,  attrs: IAttributeData): void {
    if (codePoint === NULL_CELL_CODE) {
      if (width === 0) {
        // i.e. combining character
        // FIXME - usually a no-op
      } else {
        this.eraseCells(index, index + 1, attrs);
      }
      return;
    }
    const add = this.preInsert(index, attrs);
    let curColumn = this._cachedColumn();
    const startColumn = curColumn;
    let idata = this._cachedDataIndex();
    let inext;
    if (add || idata === this.dataLength() || index === curColumn)
      inext = idata;
    else {
      const kind = BufferLine.wKind(this.data()[idata]);
      if (BufferLine.wKindIsText(kind))
        inext = this.clusterEnd(idata);
      else
        inext = idata;
    }
    let cellColumn = curColumn;
    let kind = width === 2 ? DataKind.CHAR_w2 : DataKind.CHAR_w1;
    idata = inext;
    cellColumn = curColumn;
    curColumn += width;
    // FIXME optimize of overwriting simple text in-place
    this.addEmptyDataElements(inext, 1);
    this.data()[inext++] = BufferLine.wSet1(kind, codePoint);
    this._cacheSetColumnDataIndex(cellColumn, idata);
    if (idata < this.dataLength()) {
      this.logicalLine().deleteCellsOnly(inext, 0, curColumn - startColumn);
    }
  }

  public replaceCells(start: number, end: number, fillCellData: ICellData, respectProtect: boolean = false): void {
    if (! respectProtect && fillCellData.getCode() === 0) {
      // FIXME optimize
    }
    super.replaceCells(start, end, fillCellData, respectProtect);
  }

  // DEPRECATED
  public addCodepointToCell(index: number, codePoint: number, width: number): void {
    const content = this.moveToColumn(index);
    const idata = this._cachedDataIndex();
    const clEnd = this.clusterEnd(idata);
    this.addEmptyDataElements(clEnd, 1);
    const nContinued = clEnd - idata;
    const startChar = this.data()[idata] & 0x1FFFFF;
    const kind = width === 2 ? DataKind.CLUSTER_START_w2 : DataKind.CLUSTER_START_w1;
    this.data()[idata] = BufferLine.wSet1(kind,
                                         startChar + (nContinued << 21));
    this.data()[clEnd] = BufferLine.wSet1(DataKind.CLUSTER_CONTINUED, codePoint);
  }

  /**
   * Resize BufferLine to `cols` filling excess cells with `fillCellData`.
   * The underlying array buffer will not change if there is still enough space
   * to hold the new buffer line data.
   * Returns a boolean indicating, whether a `cleanupMemory` call would free
   * excess memory (true after shrinking > CLEANUP_THRESHOLD).
   */
  public resize(cols: number, fillCellData: ICellData): boolean {
      console.log("BufferLineNew.resize");
    /*
    if (cols === this.length) {
      return this.data().length * 4 * CLEANUP_THRESHOLD < this.data().buffer.byteLength;
    }
    const uint32Cells = cols * CELL_SIZE;
    if (cols > this.length) {
      if (this.data().buffer.byteLength >= uint32Cells * 4) {
        // optimization: avoid alloc and data copy if buffer has enough room
        this.data() = new Uint32Array(this.data().buffer, 0, uint32Cells);
      } else {
        // slow path: new alloc and full data copy
        const data = new Uint32Array(uint32Cells);
        data.set(this.data());
        this.data() = data;
      }
      for (let i = this.length; i < cols; ++i) {
        this.setCell(i, fillCellData);
      }
    } else {
      // optimization: just shrink the view on existing buffer
      this.data() = this.data().subarray(0, uint32Cells);
      / *
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
      * /
    }
    */
    this.length = cols;
    return this.dataLength() * CLEANUP_THRESHOLD < this.data().length;
  }

  /** fill a line with fillCharData */
  public fill(fillCellData: ICellData, respectProtect: boolean = false): void {
    this.replaceCells(0, this.length, fillCellData, respectProtect);
  }

  /** alter to a full copy of line  */
  public copyFrom(xline: BufferLine): void {
    alert("copyFrom");
    /*
    const line = xline as LogicalBufferLine; // FIXME
    if (this.length !== line.length) {
      this._data = new Uint32Array(line._data);
    } else {
      // use high speed copy if lengths are equal
      this.data().set(line.data());
    }
    this.dataLength() = line.dataLength();
    this.length = line.length;
    this._extendedAttrs = {};
    for (const el in line._extendedAttrs) {
      this._extendedAttrs[el] = line._extendedAttrs[el];
    }
    this._isWrapped = line.isWrapped;
    */
  }

  /** create a new clone */
  public clone(): IBufferLine {
    alert("NewBufferLine.clone");
    const newLine = new LogicalBufferLine(0);
    return newLine;
  }

  public getTrimmedLength(): number {
    let cols = 0;
    let skipped = 0;
    for (let idata = 0; idata < this.dataLength(); idata++) {
      const word = this.data()[idata];
      const kind = BufferLine.wKind(word);
      const w = kind === DataKind.CHAR_w2 || kind === DataKind.CLUSTER_START_w2 ? 2 : 1;
      let wcols = 0;
      switch (kind) {
        case DataKind.FG:
        case DataKind.BG:
        case DataKind.STYLE_FLAGS:
          break;
        case DataKind.SKIP_COLUMNS:
          skipped += BufferLine.wSkipCount(word);
          break;
        case DataKind.CLUSTER_START_w1:
        case DataKind.CLUSTER_START_w2:
          wcols = w;
          break;
        case DataKind.CHAR_w1:
        case DataKind.CHAR_w2:
          wcols = w * 1;
          break;
        case DataKind.CLUSTER_CONTINUED:
          break;
      }
      if (wcols) {
        cols += skipped + wcols;
        skipped = 0;
      }
    }
    return cols;
  }

  public getNoBgTrimmedLength(): number {
    return this.getTrimmedLength(); // FIXME
    /*
    for (let i = this.length - 1; i >= 0; --i) {
      if ((this.data()[i * CELL_SIZE + Cell.CONTENT] & Content.HAS_CONTENT_MASK) || (this.data()[i * CELL_SIZE + Cell.BG] & Attributes.CM_MASK)) {
        return i + (this.data()[i * CELL_SIZE + Cell.CONTENT] >> Content.WIDTH_SHIFT);
      }
    }
    return 0;
    */
  }

  public copyCellsFrom(src: BufferLine, srcCol: number, destCol: number, length: number, applyInReverse: boolean): void {
    // This is used by reflow (window resize). FUTURE: Integrate with pretty-printing.
    const cell = new CellData();
    if (applyInReverse) {
      for (let i = length - 1; i >= 0; i--) {
          src.loadCell(srcCol + i, cell);
          this.setCell(destCol + i, cell);
      }
    } else {
      for (let i = 0; i < length; i++) {
        src.loadCell(srcCol + i, cell);
        this.setCell(destCol + i, cell);
      }
    }
  }

  public translateToString(trimRight: boolean = false, startCol: number = 0, endCol: number = this.length, skipReplace: string = WHITESPACE_CELL_CHAR): string {
    let s = '';
    let col = 0;
    let pendingStart = -1;
    let pendingLength = 0;
    let pendingSkip = 0;
    //const text = this._text;
    const data = this.data();
    function pendingForce(handleSkip = ! trimRight): void {
      if (pendingStart >= 0 && pendingLength > 0) {
        s += utf32ToString(data, pendingStart, pendingStart + pendingLength);
        pendingLength = 0;
      } else if (handleSkip && pendingLength > 0) {
        s += skipReplace.repeat(pendingLength);
        pendingLength = 0;
      }
      pendingStart = -1;
    }
    function addPendingString(start: number, length: number): void {
      if (pendingStart >= 0 && pendingStart + pendingLength === start) {
        pendingLength += length;
      } else {
        pendingForce(true);
        pendingStart = start;
        pendingLength = length;
      }
    }
    function addPendingSkip(length: number): void {
      if (pendingStart >= 0) {
        pendingForce();
      }
      pendingLength += length;
    }
    for (let idata = 0; idata < this.dataLength() && col < endCol; idata++) {
      const word = this.data()[idata];
      const kind = BufferLine.wKind(word);
      const wide = kind === DataKind.CHAR_w2 || kind === DataKind.CLUSTER_START_w2 ? 1 : 0;
      let wcols;
      switch (kind) {
        case DataKind.FG:
        case DataKind.BG:
        case DataKind.STYLE_FLAGS:
          break;
        case DataKind.SKIP_COLUMNS:
          let wlen = BufferLine.wSkipCount(word);
          if (col + wlen > startCol) {
            if (col < startCol) {
              wlen -= startCol - col;
              col = startCol;
            }
            if (col + wlen > endCol) {
              wlen = endCol - col;
            }
            addPendingSkip(wlen);
          }
          col += wlen;
          break;
        case DataKind.CLUSTER_START_w1:
        case DataKind.CLUSTER_START_w2:
          let clEnd = this.clusterEnd(idata);
          wcols = 1 << wide;
          if (col >= startCol && col + wcols <= endCol) {
            addPendingString(idata, clEnd - idata);
          }
          idata = clEnd - 1;
          col += wcols;
          break;
        case DataKind.CHAR_w1:
        case DataKind.CHAR_w2:
          wcols = 1 << wide;
          if (col >= startCol && col + wcols <= endCol) {
            addPendingString(idata, 1);
          }
          col += wcols;
          break;
      }
    }
    if (! trimRight && col < endCol) {
      addPendingSkip(endCol - col);
    }
    pendingForce();
    return s;
  }
}

export class LogicalBufferLine extends NewBufferLine implements IBufferLine {
  protected _data: Uint32Array;
  // Each item in _data is a 4-bit DataKind and 28 bits data.
  _dataLength: number; // active length of _data array
  logicalWidth: number = 0; // FIXME needs work updating this
  reflowNeeded: boolean = false;

  // Maybe move these to LogicalBufferLine? or to Buffer?
  _cache1: number = 0;
  _cache2: number = 0;
  _cache3: number = 0;
  _cache4: number = 0;

  constructor(cols: number, fillCellData?: IAttributeData) {
    super();
    // MAYBE: const buffer = new ArrayBuffer(0, { maxByteLength: 6 * cols });
    //const buffer = new ArrayBuffer(4 * cols, { maxByteLength: 6 * cols });
    this._data = new Uint32Array(cols);
    this._dataLength = 0;
    this.length = cols;
    this._isWrapped = false;
  }
  logicalLine(): LogicalBufferLine { return this; }
  data(): Uint32Array { return this._data; }
  dataLength(): number { return this._dataLength; }

  protected _cachedColumnInRow(): number { return (this.logicalLine()._cache1 & 0xFFFF); }

  // count can be negative
  addEmptyDataElements(position: number, count: number): void {
    // FIXME also adjust _extendedAttr indexes
    this.resizeData(this.dataLength() + count);
    if (count < 0) {
      this.data().copyWithin(position, position - count, this._dataLength);
    } else {
      this.data().copyWithin(position + count, position, this._dataLength);
    }
    for (let next = this.nextRowSameLine; next; next = next.nextRowSameLine) {
      next.startIndex += count;
    }
    this._extendedAttrs.copyWithin(position + count, position, this._dataLength);
    this._dataLength += count;
    // FIXME cleanup old element s in _extendedAttr.
    // But is it worth it - only matters for garbage collection?
    // if (count > 0) for each element i in _data[position..position+count-1] (
    //   if _data[i] & (0xC000000|HAS_EXTENDED) === (STYLE_FLAGS<<28)|HAS_EXTENDED
    //     delete this._extendedAttrs[i]
    // else this._extendedAttr.length = this._dataLength;
  }

  resizeData(size: number): void {
      if (size > this.data().length) {
        //buffer = new ArrayBuffer(buffer.byteLength, { maxByteLength: 6 * size });
        const new_data = new Uint32Array((3 * size) >> 1);
        new_data.set(this._data);
        this.logicalLine()._data = new_data;
      }
  }

  /* ???
  public eraseAll(bg: number): void {
    // FIXME sometimes better to reuse old _data.
    this._data = EMPTY_DATA;
    this._dataLength = 0;
    this.lineEndBg = bg;
  }
  */

  /**
   * Cleanup underlying array buffer.
   * A cleanup will be triggered if the array buffer exceeds the actual used
   * memory by a factor of CLEANUP_THRESHOLD.
   * Returns 0 or 1 indicating whether a cleanup happened.
   */
  public cleanupMemory(): number {
    /*
    if (this.dataLength() * CLEANUP_THRESHOLD < this.data().length) {
      const data = new Uint32Array(this.dataLength());
      data.set(this.data());
      this._data = data;
      return 1;
    }
    */
    return 0;
  }

  // FIXME doesn't properly handle if delete range starts or ends in middle
  // of wide character
  /** Internal - delete n columns, with adjust at end of line. */
  public deleteCellsOnly(idata0: number, colOffset0: number, n: number): void {
    let todo = n;
    let idata = idata0;
    let colOffset = colOffset0;
    let word0 = this.data()[idata];
    let dskip_first = idata, dskip_last = -1, tskip_first = -1, tskip_last = -1, w;
    let fgValue = -1; //cursor.getFg();
    let bgValue = -1; //cursor.getBg();
    let styleValue = -1; //cursor.getStyleFlags(); // FIXME handle extendedattrs

    /*
    if (colOffset === 0) {
      while (idata > 0) {
        let skipItem = true;
        switch (BufferLine.wKind(this.data()[idata-1])) {
          case DataKind.BG: cursor.setBg(-1); break;
          case DataKind.FG: cursor.setFg(-1); break;
          case DataKind.STYLE_FLAGS: cursor.setStyleFlags(-1 as StyleFlags); break;
          default: skipItem = false;
        }
        if (skipItem) {
          idata--;
          dskip_first = idata;
          dskip_last = idata0-1;
        } else {
          break;
        }
      }
    }
    */

    for (; todo > 0 && idata < this.dataLength(); idata++) {
      let word = this.data()[idata];
      const kind = BufferLine.wKind(word);
      switch (kind) {
        case DataKind.FG: fgValue = word; break;
        case DataKind.BG: bgValue = word; break;
        case DataKind.STYLE_FLAGS:
          styleValue = word;
          // handle ExtendedAttrs FIXME
          break;
        case DataKind.SKIP_COLUMNS:
          let wlen = BufferLine.wSkipCount(word);
          if (colOffset === 0 && wlen <= todo) {
            dskip_last = idata;
            todo -= wlen;
          } else {
            let delta = Math.min(todo,  wlen - colOffset);
            this.data()[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, wlen - delta);
            dskip_first = idata + 1;
            todo -= delta;
          }
          colOffset = 0;
          break;
        case DataKind.CHAR_w1:
        case DataKind.CHAR_w2:
          w = kind - DataKind.CHAR_w1; // 0, or 1 if wide characters
          if (colOffset === 0 && (1 << w) <= todo) {
            dskip_last = idata;
            todo -= 1 << w;
          } else {
            dskip_first = idata + 1;
            /*
            const delta = tend - tstart;
            this._data[idata] = BufferLine.wSet1(kind, wlen - delta);
            todo -= delta << w;
            */
          }
          break;
        case DataKind.CLUSTER_START_w1:
        case DataKind.CLUSTER_START_w2:
          w = kind - DataKind.CLUSTER_START_w1; // 0, or 1 if wide characters
          const clEnd = this.clusterEnd(idata);
          if (colOffset < (1 << w)) {
            idata = clEnd;
            dskip_last = idata;
            todo -= (1 << w);
          } else {
            dskip_first = idata + 1;
          }
          colOffset = 0;
          break;
      }
    }
    idata0 = dskip_first;
    if (bgValue >= 0) {
      this.data()[idata0++] = BufferLine.wSet1(DataKind.BG, bgValue);
    }
    if (fgValue >= 0) {
      this.data()[idata0++] = BufferLine.wSet1(DataKind.FG, fgValue);
    }
    if (styleValue >= 0) {
      this.data()[idata0++] = BufferLine.wSet1(DataKind.STYLE_FLAGS, styleValue);
    }
    if (dskip_last >= 0) {
      const dcount = dskip_last + 1 - idata0;
      this.addEmptyDataElements(idata0, - dcount);
    }
  }
}

export class WrappedBufferLine extends NewBufferLine implements IBufferLine {
  _logicalLine: LogicalBufferLine;
  startIndex: number = 0;
  /** Number of logical columns in previous rows.
   * Also: logical column number (column number assuming infinitely-wide
   * terminal) corresponding to the start of this row.
   * If R is 0 for the previous LogicalBufferLine, R is 1 for first
   * WrappedBufferLine and so on, startColumn will *usually* be N*W
   * (where W is the width of the terminal in columns) but may be slightly
   * different when a wide character at column W-1 must wrap "early".
   */
  startColumn: number = 0;
  startFg: number = 0;
  startBg: number = 0;
  startStyle: number = 0;

  constructor(logicalLine: LogicalBufferLine) {
    super();
    this._logicalLine = logicalLine;
    this._isWrapped = true;
  }
  logicalLine(): LogicalBufferLine { return this._logicalLine; }
  data(): Uint32Array { return this._logicalLine.data(); }
  dataLength(): number { return this._logicalLine.dataLength(); }
  addEmptyDataElements(position: number, count: number): void {
    this._logicalLine.addEmptyDataElements(position, count);
  }
  protected _cachedColumnInRow(): number { return (this.logicalLine()._cache1 & 0xFFFF) - this.startColumn; }
  protected _cacheReset(): void {
    this._cacheSetFgBg(this.startFg, this.startBg);
    this._cacheSetStyleFlagsIndex(this.startStyle);
    this._cacheSetColumnDataIndex(this.startColumn, this.startIndex);
  }
  resizeData(size: number): void { this._logicalLine.resizeData(size); }
  public cleanupMemory(): number { return 0;}
}
