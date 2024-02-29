/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { CharData, IInputHandler, IAttributeData, IBufferLine, ICellData, IExtendedAttrs } from 'common/Types';
import { AttributeData } from 'common/buffer/AttributeData';
import { CellData } from 'common/buffer/CellData';
import { Attributes, BgFlags, CHAR_DATA_ATTR_INDEX, CHAR_DATA_CHAR_INDEX, CHAR_DATA_WIDTH_INDEX, Content, StyleFlags, NULL_CELL_CHAR, NULL_CELL_CODE, NULL_CELL_WIDTH, WHITESPACE_CELL_CHAR , UnderlineStyle } from 'common/buffer/Constants';
import { stringFromCodePoint, utf32ToString } from 'common/input/TextDecoder';
import { UnicodeService } from 'common/services/UnicodeService';
import { ICoreService } from 'common/services/Services';

export const DEFAULT_ATTR_DATA = Object.freeze(new AttributeData());

/** Column count within current visible row.
 * The left-most coulmn is column 0.
 */
type RowColumn = number;

/** Column count within current logical line.
 * If the display is 80 columns wide, then LineColumn of the left-most
 * character of the first wrapped line would normally be 80.
 * (It might be 79 if the character at column 79 is double-width.)
 */
type LineColumn = number;

// Work variables to avoid garbage collection
let $startIndex = 0;

/** Factor when to cleanup underlying array buffer after shrinking. */
const CLEANUP_THRESHOLD = 2;

export abstract class AbstractBufferLine implements IBufferLine {
  /** Number of logical columns */
  public length: number = 0;
  _isWrapped: boolean = false;
  public get isWrapped(): boolean { return this._isWrapped; }
  public abstract insertCells(pos: number, n: number, fillCellData: ICellData, eraseAttr?: IAttributeData): void;
  public abstract addCodepointToCell(index: number, codePoint: number, width: number): void; // DEPRECATED
  public abstract resize(cols: number, fillCellData: ICellData): boolean;
  public abstract fill(fillCellData: ICellData, respectProtect?: boolean): void;
  public abstract copyFrom(line: BufferLine): void;
  public abstract clone(): IBufferLine;
  public abstract translateToString(trimRight?: boolean, startCol?: number, endCol?: number, outColumns?: number[]): string;
  public abstract getTrimmedLength(): number;
  public abstract getNoBgTrimmedLength(): number;
  public abstract cleanupMemory(): number;

  public abstract loadCell(index: number, cell: ICellData): ICellData;

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
    const cell = new CellData();
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

  public abstract setCell(index: number, cell: ICellData): void;

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
  STYLE_FLAGS = 3, // lower 28 bits is StyleFlags

  SKIP_COLUMNS = 7, // empty ("null") columns (28 bit count)
  // The following have a 21-bit codepoint value in the low-order bits
  CHAR_W1 = 8, // single-non-compound, 1 column wide
  CHAR_W2 = 9, // single-non-compound, 2 columns wide
  // CLUSTER_START_xx have a 7=bit for number of CONTINUED entries
  CLUSTER_START_W1 = 10, // start of non-trivial cluster, 1 column wide
  CLUSTER_START_W2 = 11, // start of non-trivial cluster, 2 columns wide
  CLUSTER_CONTINUED = 12 // continuation of cluster
}

const NULL_DATA_WORD = DataKind.SKIP_COLUMNS << 28;

var USE_NewBufferLine = true;
export function usingNewBufferLine(): boolean { return USE_NewBufferLine; }
export function selectNewBufferLine(value: boolean): void { USE_NewBufferLine = value; }
export abstract class BufferLine extends AbstractBufferLine implements IBufferLine {

  static make(cols: number, fillCellData?: ICellData, isWrapped: boolean = false): BufferLine {
    if (USE_NewBufferLine) {
      // if (isWrapped) new WrappedBufferLine(...);
      return new LogicalBufferLine(cols, fillCellData);
    }
    return new OldBufferLine(cols, fillCellData, isWrapped);

  }

  // @deprecated - only if !usingNewBufferLine()
  public  abstract copyCellsFrom(src: BufferLine, srcCol: number, destCol: number, length: number, applyInReverse: boolean): void;

  // FOLLOWING ONLY USED BY NewBufferLine
  /** From a Uint23 in _data, extract the DataKind bits. */
  public static wKind(word: number): DataKind { return word >>> 28; }
  public static wKindIsText(kind: DataKind): boolean { return kind >= DataKind.CHAR_W1 && kind <= DataKind.CLUSTER_CONTINUED; }
  public static wKindIsTextOrSkip(kind: DataKind): boolean { return kind >= DataKind.SKIP_COLUMNS && kind <= DataKind.CLUSTER_CONTINUED; }
  /** From a Uint23 in _data, extract length of string within _text.
   * Only for SKIP_COLUMNS. */
  public static wSkipCount(word: number): number { return word & 0xfffff; }
  public static wSet1(kind: DataKind, value: number): number {
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
  public fill(fillCellData: ICellData, respectProtect?: boolean): void {
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

  public translateToString(trimRight: boolean = false, startCol: number = 0, endCol: number = this.length, outColumns?: number[], skipReplace: string = WHITESPACE_CELL_CHAR): string {
    if (trimRight) {
      endCol = Math.min(endCol, this.getTrimmedLength());
    }
    if (outColumns) {
      outColumns.length = 0;
    }
    let result = '';
    while (startCol < endCol) {
      const content = this._data[startCol * CELL_SIZE + Cell.CONTENT];
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

// This class will be merged with its parent when OldBufferLine is removed,

export abstract class NewBufferLine extends BufferLine implements IBufferLine {

  nextRowSameLine: WrappedBufferLine | undefined;

  /** The "current" index into the _data array.
   * The index must be either dataLength() or wKindIsTextOrSkip must be true.
   * (The index never points to a CLUSTER_CONTINUED item.)
   */
  _cachedDataIndex(): number { return this.logicalLine()._cache1 >>> 16; }
  /** The logical column number corresponding to _cachedDataIndex(). */
  _cachedColumn(): LineColumn { return this.logicalLine()._cache1 & 0xFFFF; }
  protected abstract _cachedColumnInRow(): RowColumn;
  // private _cachedColOffset(): number { return this._cache3 >> 24; } // UNUSED
  abstract _cachedBg(): number;
  abstract _cachedFg(): number;
  // An index (in data()) of a STYLE_FLAGS entry; -1 if none.
  protected _cachedStyleFlagsIndex(): number { return this.logicalLine()._cache4; }
  protected _cacheReset(): void { const line = this.logicalLine(); line._cache1 = 0; line._cache2 = 0; line._cache3 = 0; line._cache4 = -1; }
  protected _cacheSetFgBg(fg: number, bg: number): void { const line = this.logicalLine(); line._cache2 = bg; line._cache3 = fg; }
  protected _cacheSetStyleFlagsIndex(index: number): void { this.logicalLine()._cache4 = index; }
  protected _cacheSetColumnDataIndex(column: LineColumn, dataIndex: number): void { this.logicalLine()._cache1 = (dataIndex << 16) | (column & 0xFFFF); }

  public setStartFromCache(wrapRow: WrappedBufferLine): void {
    wrapRow.startIndex = this._cachedDataIndex();
    wrapRow.startColumn = this._cachedColumn();
    wrapRow.startBg = this._cachedBg();
    wrapRow.startFg = this._cachedFg();
    wrapRow.startStyle = this._cachedStyleFlagsIndex();
  }

  // Length of data() array.
  abstract dataLength(): number;
  // Key is index in _data array that has STYLE_FLAGS kind with HAS_EXTENDED.
  protected _extendedAttrs: IExtendedAttrs[] = [];

  public abstract logicalLine(): LogicalBufferLine;
  public abstract logicalStartColumn(): LineColumn;
  protected abstract data(): Uint32Array;
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
    const styleWord = styleIndex < 0 ? 0 : this.data()[styleIndex];
    return this._cachedFg() | ((styleWord << 24) & Attributes.STYLE_BITS_MASK);
  }

  /** Get BG cell component. @deprecated */
  public getBg(index: number): number {
    this.moveToColumn(index);
    const styleIndex = this._cachedStyleFlagsIndex();
    const styleWord = styleIndex < 0 ? 0 : this.data()[styleIndex];
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

  public showRowData(): string {
    return this.showData(this.logicalStartColumn(), this.nextRowSameLine ? this.nextRowSameLine?.logicalStartColumn() : Infinity);
  }
  /* Human-readable display of data() array, for debugging */
  public showData(startColumn = 0, endColumn = Infinity): string {
    let s = '';
    let curColumn = 0;
    for (let i = 0; i < this.dataLength() && curColumn < endColumn; i++) {
      const word = this.data()[i];
      const kind = BufferLine.wKind(word);
      let code: string | number = kind;
      const wnum = word & 0xfffffff;
      let nextColumn = curColumn;
      switch (kind) {
        case DataKind.FG: code = 'FG'; break;
        case DataKind.BG: code = 'BG'; break;
        case DataKind.STYLE_FLAGS: code = 'STYLE'; break;
        case DataKind.SKIP_COLUMNS: code = 'SKIP'; nextColumn += wnum; break;
        case DataKind.CLUSTER_START_W1: code = 'CL1'; nextColumn += 1; break;
        case DataKind.CLUSTER_START_W2: code = 'CL2'; nextColumn += 2; break;
        case DataKind.CLUSTER_CONTINUED: code = 'CL_CONT'; break;
        case DataKind.CHAR_W1: code = 'C1'; nextColumn += 1; break;
        case DataKind.CHAR_W2: code = 'C2'; nextColumn += 2; break;
      }

      if (startColumn < nextColumn) {
        if (s) {
          s += ', ';
        }
        let value;
        if (kind === DataKind.CHAR_W1 || kind === DataKind.CHAR_W2) {
          let count = 1;
          const w = nextColumn - curColumn;
          while (curColumn + count * w < endColumn && i + count < this.dataLength() && BufferLine.wKind(this.data()[i + count]) === kind) {
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
          nextColumn = curColumn + count * w;
        } else if (kind === DataKind.CLUSTER_START_W1
            || kind === DataKind.CLUSTER_START_W2
            || kind === DataKind.CLUSTER_CONTINUED) {
          value = '#' + (word & 0x1fffff).toString(16);
        } else if (kind === DataKind.BG || kind === DataKind.FG) {
          value = (wnum >> 24) + '#' + (wnum & 0xffffff).toString(16);
        } else if (kind === DataKind.STYLE_FLAGS) {
          value = '#' + (wnum & 0xfffffff).toString(16);
          if (wnum & StyleFlags.HAS_EXTENDED) {
              const extended = this._extendedAttrs[i];
              if (! extended) { value += " (missing ext)"; }
              else {
                  switch (extended.underlineStyle) {
                    case UnderlineStyle.SINGLE: value += " us:SINGLE"; break;
                    case UnderlineStyle.DOUBLE: value += " us:DOUBLE"; break;
                    case UnderlineStyle.CURLY: value += " us:CURLY"; break;
                    case UnderlineStyle.DOTTED: value += " us:DOTTED"; break;
                    case UnderlineStyle.DASHED: value += " us:DASHED"; break;
                  }
              }
          }
        } else if (kind === DataKind.SKIP_COLUMNS) {
          value = nextColumn <= endColumn ? wnum
          : `${endColumn - curColumn} of ${wnum}`;
        } else {
          value = wnum.toString();
        }
        s += code + ': ' + value;
        if (curColumn < startColumn) {
          s += ` offset ${startColumn - curColumn}`;
        }
      }
      curColumn = nextColumn;
    }
    return `[${s}]`;
  }

  /** Check invariants. Useful for debugging. */
  _check(): void {
    function error(str: string): void {
      console.log('ERROR: '+str);
    }
    const data = this.data();
    if (this.dataLength() < 0 || this.dataLength() > data.length)
    {error('bad _dataLength');}
    if (this.dataLength() === 2 && BufferLine.wKind(data[0]) === DataKind.SKIP_COLUMNS && BufferLine.wKind(data[1]) === DataKind.BG) {
      error('SKIP followed by BG');
    }
    if (this.dataLength() === 1 && data[0] === BufferLine.wSet1(DataKind.BG, 0)) {
      error('default BG only');
    }
    for (let idata = 0; idata < this.dataLength(); idata++) {
      const word = this.data()[idata];
      const kind = BufferLine.wKind(word);
      switch (kind) {
        case DataKind.FG:
        case DataKind.BG:
          break;
        case DataKind.STYLE_FLAGS:
          if ((word & StyleFlags.HAS_EXTENDED) != 0
          && ! this._extendedAttrs[idata]) {
            error("missed ExtendedAttributes")
          }
          break;
        case DataKind.SKIP_COLUMNS:
          break;
        case DataKind.CHAR_W1:
        case DataKind.CHAR_W2:
        case DataKind.CLUSTER_START_W1:
        case DataKind.CLUSTER_START_W2:
        case DataKind.CLUSTER_CONTINUED:
          break;
        default:
          error('invalid _dataKind');
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
    // FIXME handle if start or end in middle of wide character.
    const width = this.length;
    if (pos >= width) {
      return;
    }
    if (pos + n < width) {
      const endpos = width - n;
      this.moveToColumn(endpos);
      const idata = this._cachedDataIndex();
      const colOffset = this._cachedColumn();
      this.logicalLine().deleteCellsOnly(idata, this.logicalStartColumn() + endpos - colOffset, n);
    } else {
      n = width - pos;
    }
    this.preInsert(this.logicalStartColumn() + pos, fillCellData);
    const idata = this._cachedDataIndex();
    this.addEmptyDataElements(idata, 1);
    // Ideally should optimize for adjacent SKIP_COLUMNS (as in eraseCells).
    // However, typically is followed by replacing the new empty cells.
    this.data()[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, n);
  }

  /** Move to column 'index', which is a RowColumn.
   * Return encoded 'content'.
   */
  public moveToColumn(index: RowColumn, stopEarly: boolean = false): number {
    const endColumn = this.nextRowSameLine ? this.nextRowSameLine.logicalStartColumn() : Infinity;
    return this.moveToLineColumn(index + this.logicalStartColumn(), endColumn, stopEarly);
  }

  /** Move to column 'index', which is a LineColumn.
   * Return encoded 'content' (code value with width and possible IS_COMBINED_MARK) of following character, if any.
   * If at SKIP_COLUMNS or after end then the code value is 0 and the width is 1.
   * If in the middle of a multi-column character, the code value is 0 and the width is 0.
   */
  public moveToLineColumn(index: LineColumn, endColumn = Infinity, stopEarly: boolean = false): number {
    let curColumn = this._cachedColumn();
    if (index < curColumn) {
      // FIXME can sometimes do better
      this._cacheReset();
      curColumn = this._cachedColumn();
    }
    let idata = this._cachedDataIndex();
    let fg = this._cachedFg();
    let bg = this._cachedBg();
    let styleFlagsIndex = this._cachedStyleFlagsIndex();
    let todo = index - curColumn;
    let word;
    let kind;
    let content = 0;
    while (stopEarly ? todo > 0 : todo >= 0) {
      if (idata >= this.dataLength()) {
        word = NULL_DATA_WORD;
        kind = DataKind.SKIP_COLUMNS;
        content = (NULL_CELL_WIDTH << Content.WIDTH_SHIFT) | NULL_CELL_CODE;
        break;
      }
      let nextColumn = curColumn;
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
          styleFlagsIndex = idata;
          idata++;
          break;
        case DataKind.SKIP_COLUMNS:
          w = BufferLine.wSkipCount(word);
          nextColumn = curColumn + w;
          if (todo >= w && nextColumn <= endColumn) {
            todo -= w;
            idata++;
            curColumn += w;
          } else {
            content = (NULL_CELL_WIDTH << Content.WIDTH_SHIFT) | NULL_CELL_CODE;
            todo = -1;
          }
          break;
        case DataKind.CLUSTER_START_W1:
        case DataKind.CLUSTER_START_W2:
          w = kind + 1 - DataKind.CLUSTER_START_W1;
          nextColumn = curColumn + w;
          if (todo >= w && nextColumn <= endColumn) {
            const clEnd = this.clusterEnd(idata);
            todo -= w;
            curColumn = nextColumn;
            idata = clEnd;
          } else {
            content = nextColumn > endColumn
              ? (NULL_CELL_WIDTH << Content.WIDTH_SHIFT) | NULL_CELL_CODE
              : index !== curColumn ? 0
              : (w << Content.WIDTH_SHIFT) | Content.IS_COMBINED_MASK;
            todo = -1;
          }
          break;
        case DataKind.CHAR_W1:
        case DataKind.CHAR_W2:
          w = kind + 1 - DataKind.CHAR_W1; // 1, or 2 if wide characters
          nextColumn = curColumn + w;
          if (todo >= w && nextColumn <= endColumn) {
            todo -= w;
            idata++;
            curColumn = nextColumn;
          } else {
            todo = -1;
            content = nextColumn > endColumn
              ? (NULL_CELL_WIDTH << Content.WIDTH_SHIFT) | NULL_CELL_CODE
              : index !== curColumn ? 0
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
   * to GC as it significantly reduced the amount of new objects/references needed.
   */
  public loadCell(index: number, cell: ICellData): ICellData {
    const cursor = cell as CellData;
    const content = this.moveToColumn(index);
    cursor.content = content;
    cursor.setFg(this._cachedFg());
    cursor.setBg(this._cachedBg());
    const styleFlagsIndex = this._cachedStyleFlagsIndex();
    const word = styleFlagsIndex < 0 ? 0 : this.data()[styleFlagsIndex];
    cursor.setStyleFlags(word);
    if ((word & StyleFlags.HAS_EXTENDED) !== 0) {
      cursor.extended = this._extendedAttrs[styleFlagsIndex]!;
    }
    if (content & Content.IS_COMBINED_MASK) {
      // FIXME do this lazily, in CellData.getChars
      const idata = this._cachedDataIndex();
      const str = utf32ToString(this.data(), idata, this.clusterEnd(idata));
      cursor.combinedData = str;
    }
    return cell;
  }

  public deleteCells(pos: number, n: number, fillCellData: ICellData): void {
    this.moveToColumn(pos);
    const idata = this._cachedDataIndex();
    const curColumn = this._cachedColumn();
    this.logicalLine().deleteCellsOnly(idata, pos - curColumn, n);
  }

  public _splitIfNeeded(index: LineColumn): number {
    const content = this.logicalLine().moveToLineColumn(index, Infinity, true);
    let curColumn = this._cachedColumn();
    let idata = this._cachedDataIndex();

    // CASES:
    // 1. idata === dataLength() - easy.
    // 2. data()[idata] is SKIP_COLUMNS
    // -- split if curColumnn > 0 && curColumn < wlen
    // 3. kind is wKindIsText:
    // a. curColumn===index
    // b. index === curColumn + width
    // c. otherwise - in middle of wide char

    if (curColumn < index) {
      if ((content >> Content.WIDTH_SHIFT) === 0
        && index === curColumn + 1) {
        // In the middle of a wide character. Well-behaved applications are
        // unlikely to do this, so it's not worth optimizing.
        const clEnd = this.clusterEnd(idata);
        this.addEmptyDataElements(idata, 2 - (clEnd - idata));
        let wrappedBecauseWide = false; // FIXME
        let prev: NewBufferLine = this.logicalLine();
        let prevStart = 0;
        for (;;) {
          let next = prev.nextRowSameLine;
          if (! next) { break; }
          let nextStart = next.logicalStartColumn();
          if (nextStart === curColumn && nextStart === prevStart + this.length - 1) {
            wrappedBecauseWide = true;
            index++;
          }
          if (wrappedBecauseWide) {
            next.startColumn++;
          }
          prev = next;
        }
        this.data()[idata++] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, wrappedBecauseWide ? 2 : 1);
        this.data()[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, 1);
        curColumn = index;
      } else if (idata === this.dataLength()) {
        this.addEmptyDataElements(idata, 1);
        this.data()[idata] =
          BufferLine.wSet1(DataKind.SKIP_COLUMNS, index - curColumn);
        curColumn = index;
        idata++;
      } else if (BufferLine.wKind(this.data()[idata]) === DataKind.SKIP_COLUMNS) {
        const oldSkip = BufferLine.wSkipCount(this.data()[idata]);
        this.addEmptyDataElements(idata, 1);
        const needed = index - curColumn;
        this.data()[idata++] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, needed);
        this.data()[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, oldSkip - needed);
        curColumn = index;
      } else {
        console.log(`can't insert at column ${index}`);
      }
      this._cacheSetColumnDataIndex(curColumn, idata);
    }
    return idata;
  }
  protected preInsert(index: LineColumn, attrs: IAttributeData, extendToEnd: boolean = false): boolean {
    let idata = this._splitIfNeeded(index);
    // set attributes
    const newFg = attrs.getFg();
    const newBg = attrs.getBg();
    const newStyle = attrs.getStyleFlags();
    let oldFg = this._cachedFg();
    let oldBg = this._cachedBg();
    const styleFlagsIndex = this._cachedStyleFlagsIndex();
    const oldStyle = styleFlagsIndex < 0 ? 0 : (this.data()[styleFlagsIndex] & 0xfffffff);
    let data = this.data();
    const idata0 = idata;
    let dataLength = this.dataLength();
    for (; idata < dataLength; idata++) {
      const word = data[idata];
      let done = true;
      switch (BufferLine.wKind(word)) {
        case DataKind.BG:
          if ((word & 0x3ffffff) === newBg) {
            oldBg = newBg;
            done = false;
          }
          break;
          case DataKind.FG:
            if ((word & 0x3ffffff) === newFg) {
              oldFg = newFg;
              done = false;
            }
            break;
      }
      if (done) {
        break;
      }
    }
    let needFg = newFg !== oldFg;
    let needBg = newBg !== oldBg;
    let oldExt = (oldStyle & StyleFlags.HAS_EXTENDED) && this._extendedAttrs[styleFlagsIndex];
    let newExt = (newStyle & StyleFlags.HAS_EXTENDED) && attrs.extended;
    let needStyle = newStyle !== oldStyle || oldExt !== newExt;
    const add1 = extendToEnd ? 1 : 2;
    let add = (needBg?add1:0) + (needFg?add1:0) + (needStyle?add1:0);
    if (add ) {
      add =(needBg?add1:0) + (needFg?add1:0) + (needStyle?add1:0);
      this.addEmptyDataElements(idata, add - (idata0 - idata));
      data = this.data();
      if (needFg) {
        data[idata++] = BufferLine.wSet1(DataKind.FG, newFg);
      }
      if (needBg) {
        data[idata++] = BufferLine.wSet1(DataKind.BG, newBg);
      }
      if (needStyle) {
        if (newStyle & StyleFlags.HAS_EXTENDED)
        {this._extendedAttrs[idata] = attrs.extended;}
        this._cacheSetStyleFlagsIndex(idata);
        data[idata++] = BufferLine.wSet1(DataKind.STYLE_FLAGS, newStyle);
      }
      this._cacheSetColumnDataIndex(index, idata);
      let xdata = idata; // FIXME
      if (! extendToEnd) {
        if (needFg) {
          data[xdata++] = BufferLine.wSet1(DataKind.FG, oldFg);
        }
        if (needStyle) {
          if ((oldStyle & StyleFlags.HAS_EXTENDED) !== 0 && oldExt)
            {this._extendedAttrs[xdata] = oldExt;}
          data[xdata++] = BufferLine.wSet1(DataKind.STYLE_FLAGS, oldStyle);
        }
       if (needBg) {
         data[xdata++] = BufferLine.wSet1(DataKind.BG, oldBg);
        }
       }
      this._cacheSetFgBg(newFg, newBg);
    } else if (idata > idata0) {
      this._cacheSetColumnDataIndex(index, idata);
    }
    return add > 0;
  }

  /** Insert characters from 'data' (from 'start' to 'end').
   * @return The ending column. This may be more than the available width,
   * in which case the caller is responsible for wrapping.
   */
  public insertText(index: RowColumn, data: Uint32Array, start: number, end: number, attrs: IAttributeData, inputHandler: IInputHandler, coreService: ICoreService): RowColumn {
    const insertMode = coreService.modes.insertMode;
    const wraparoundMode = coreService.decPrivateModes.wraparound;
    let lstart = this.logicalStartColumn();
    let lindex = index + lstart;
    const add = this.preInsert(lindex, attrs);
    lstart = this.logicalStartColumn();
    lindex = index + lstart;
    let curColumn = this._cachedColumn();
    const lline = this.logicalLine();
    const startColumn: LineColumn = curColumn;
    let idata = this._cachedDataIndex();
    let precedingJoinState = inputHandler.precedingJoinState;
    let inext;
    if (add || idata === this.dataLength() || lindex === curColumn)
    {inext = idata;}
    else {
      const kind = BufferLine.wKind(this.data()[idata]);
      if (BufferLine.wKindIsText(kind))
      {inext = this.clusterEnd(idata);}
      else
      {inext = idata;}
    }
    // FIXME optimize of overwriting simple text in-place
    this.addEmptyDataElements(inext, end - start);

    let cellColumn = curColumn;
    let chWidth = 0;
    for (let i = start; i < end; i++) {
      // inext is the insertion point for the current codepoint
      // idata is the start of the most recent character or cluster,
      // assuming all codepoints from idata until inext are the same cluster.
      // If there is no preceding character/cluster that can be added to,
      // then idata === inext.
      const code = data[i];
      const currentInfo = inputHandler.unicodeService.charProperties(code, precedingJoinState);
      chWidth = UnicodeService.extractWidth(currentInfo);
      const shouldJoin = UnicodeService.extractShouldJoin(currentInfo);
      const oldWidth = shouldJoin ? UnicodeService.extractWidth(precedingJoinState) : 0;
      precedingJoinState = currentInfo;
      let kind;
      if (shouldJoin) {
        kind = chWidth === 2 ? DataKind.CLUSTER_START_W2 : DataKind.CLUSTER_START_W1;
        const oldCount = (this.data()[idata] >> 21) & 0x3F;
        const startChar = this.data()[idata] & 0x1FFFFF;
        // FIXME check for count overflow;
        this.data()[idata] = BufferLine.wSet1(kind,
          startChar + ((oldCount + 1) << 21));
        kind = DataKind.CLUSTER_CONTINUED;
        curColumn += chWidth - oldWidth;
      } else {
        kind = chWidth === 2 ? DataKind.CHAR_W2 : DataKind.CHAR_W1;
        idata = inext;
        cellColumn = curColumn;
        curColumn += chWidth;
      }
      this.data()[inext++] = BufferLine.wSet1(kind, code);
    }
    const lastChar = idata;
    inputHandler.precedingJoinState = precedingJoinState;
    if (! insertMode && idata < this.dataLength()) {
      this.logicalLine().deleteCellsOnly(inext, 0, curColumn - startColumn);
    }
    if (curColumn > lline.logicalWidth)
    {lline.logicalWidth = curColumn;}
    curColumn -= lstart;
    if (curColumn > this.length && ! wraparoundMode) {
      this.moveToColumn(this.length - chWidth);
      idata = this._cachedDataIndex();
      this.addEmptyDataElements(idata, idata - lastChar);
    } else {
      this._cacheSetColumnDataIndex(cellColumn, idata);
    }
    return curColumn;
  }

  public eraseCells(start: RowColumn, end: RowColumn, attrs: IAttributeData): void {
    const startColumn = this.logicalStartColumn();
    if (end === Infinity && this.nextRowSameLine) { end = this.length; }
    const count = end - start;
    start += startColumn;
    this.moveToLineColumn(start);
    end += startColumn;
    let idata = this._cachedDataIndex();
    const colOffset = start - this._cachedColumn();
    const lline = this.logicalLine();
    lline.deleteCellsOnly(idata, colOffset, count);
    this.preInsert(start, attrs, end === Infinity);
    idata = this._cachedDataIndex();
    const data = this.data();
    if (idata > 0 && BufferLine.wKind(data[idata-1]) === DataKind.SKIP_COLUMNS) {
      const skipped = BufferLine.wSkipCount(data[idata - 1]);
      if (idata === this.dataLength()) {
        end = start - skipped;
        idata--;
        lline._dataLength = idata;
      } else {
        data[idata-1] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, skipped + count);
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

  /**
   * Set data at `index` to `cell`. FIXME doesn't handle combined chars.
   */
  public setCell(index: number, cell: ICellData): void {
    const width = cell.getWidth();
    if (cell.content & Content.IS_COMBINED_MASK) {
      const str = cell.combinedData;
      const nstr = str.length;
      const arr = new Uint32Array(nstr);
      let istr = 0;
      let iarr = 0;
      while (istr < nstr) {
        const cp = str.codePointAt(istr) || 0;
        arr[iarr++] += cp;
        istr += cp >= 0x10000 ? 2 : 1;
      }
      if (iarr <= 1) {
        this.setCellFromCodepoint(index, iarr > 0 ? arr[0] : NULL_CELL_CODE, width, cell);
      } else {
        const lindex = index + this.logicalStartColumn();
        const add = this.preInsert(lindex, cell); // FIXME
        let curColumn = this._cachedColumn();
        let idata = this._cachedDataIndex();
        let inext = idata;
        let cellColumn = curColumn;
        const kind = width === 2 ? DataKind.CLUSTER_START_W2 : DataKind.CLUSTER_START_W1;
        idata = inext;
        cellColumn = curColumn;
        curColumn += width;
        this.addEmptyDataElements(inext, iarr);
        this.data()[inext++] = BufferLine.wSet1(kind, arr[0] + ((iarr - 1) << 21));
        for (let i = 1; i < iarr; i++) {
          this.data()[inext++] = BufferLine.wSet1(DataKind.CLUSTER_CONTINUED, arr[i]);
        }
        this._cacheSetColumnDataIndex(cellColumn, idata);
        if (idata < this.dataLength()) {
          this.logicalLine().deleteCellsOnly(inext, 0, width);
        }
      }
    } else {
      this.setCellFromCodepoint(index, cell.getCode(), width, cell);
    }
  }

  public setCellFromCodepoint(index: RowColumn, codePoint: number, width: number,  attrs: IAttributeData): void {
    if (codePoint === NULL_CELL_CODE) {
      if (width === 0) {
        // i.e. combining character
        // FIXME - usually a no-op
      } else {
        this.eraseCells(index, index + 1, attrs);
      }
      return;
    }
    const lindex = index + this.logicalStartColumn();
    const add = this.preInsert(lindex, attrs); // FIXME
    let curColumn = this._cachedColumn();
    let idata = this._cachedDataIndex();
    let inext;
    if (add || idata === this.dataLength() || lindex === curColumn)
    {inext = idata;}
    else {
      const kind = BufferLine.wKind(this.data()[idata]);
      if (BufferLine.wKindIsText(kind))
      {inext = this.clusterEnd(idata);}
      else
      {inext = idata;}
    }
    let cellColumn = curColumn;
    const kind = width === 2 ? DataKind.CHAR_W2 : DataKind.CHAR_W1;
    idata = inext;
    cellColumn = curColumn;
    curColumn += width;
    // FIXME optimize of overwriting simple text in-place
    this.addEmptyDataElements(inext, 1);
    this.data()[inext++] = BufferLine.wSet1(kind, codePoint);
    this._cacheSetColumnDataIndex(cellColumn, idata);
    if (idata < this.dataLength()) {
      this.logicalLine().deleteCellsOnly(inext, 0, width);
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
    const data = this.data();
    const startWord = data[idata];
    const startChar = startWord & 0x1FFFFF;
    width = width || (BufferLine.wKind(startWord) === DataKind.CLUSTER_START_W2 ? 2 : 1);
    const kind = width === 2 ? DataKind.CLUSTER_START_W2 : DataKind.CLUSTER_START_W1;
    data[idata] = BufferLine.wSet1(kind,
      startChar + (nContinued << 21));
    data[clEnd] = BufferLine.wSet1(DataKind.CLUSTER_CONTINUED, codePoint);
  }

  /**
   * Resize BufferLine to `cols` filling excess cells with `fillCellData`.
   * The underlying array buffer will not change if there is still enough space
   * to hold the new buffer line data.
   * Returns a boolean indicating, whether a `cleanupMemory` call would free
   * excess memory (true after shrinking > CLEANUP_THRESHOLD).
   */
  public resize(cols: number, fillCellData: ICellData): boolean {
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
  public fill(fillCellData: ICellData, respectProtect?: boolean): void {
    this.replaceCells(0, this.length, fillCellData, respectProtect);
  }

  // @deprecated - not used if usingNewBufferLine()
  public copyFrom(xline: BufferLine): void {
    alert('copyFrom');
  }

  /** create a new clone */
  public clone(): IBufferLine {
    alert('NewBufferLine.clone');
    const newLine = new LogicalBufferLine(0);
    return newLine;
  }

  public getTrimmedLength(countBackground: boolean = false): number {
    let cols = 0;
    let skipped = 0;
    const startColumn = this.logicalStartColumn();
    const data = this.data();
    const end = this.nextRowSameLine ? this.nextRowSameLine.startIndex : this.dataLength();
    let bg = this._cachedBg();
    for (let idata = startColumn; idata < end; idata++) {
      const word = data[idata];
      const kind = BufferLine.wKind(word);
      const w = kind === DataKind.CHAR_W2 || kind === DataKind.CLUSTER_START_W2 ? 2 : 1;
      let wcols = 0;
      switch (kind) {
        case DataKind.BG:
          bg = word & 0x3ffffff;
          break;
        case DataKind.FG:
        case DataKind.STYLE_FLAGS:
          break;
        case DataKind.SKIP_COLUMNS:
          skipped += BufferLine.wSkipCount(word);
          break;
        case DataKind.CLUSTER_START_W1:
        case DataKind.CLUSTER_START_W2:
          const clEnd = this.clusterEnd(idata);
          wcols = w * (clEnd - idata);
          idata = clEnd - 1;
          break;
        case DataKind.CHAR_W1:
        case DataKind.CHAR_W2:
          wcols = w;
          break;
        case DataKind.CLUSTER_CONTINUED:
          break; // should be skipped
      }
      if (wcols) {
        cols += skipped + wcols;
        skipped = 0;
      }
    }
    return countBackground && bg !== 0 ? this.length : cols;
  }

  public getNoBgTrimmedLength(): number {
    return this.getTrimmedLength(true);
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

  public translateToString(trimRight: boolean = false, startCol: number = 0, endCol: number = this.length, outColumns?: number[], skipReplace: string = WHITESPACE_CELL_CHAR): string {
    const lineStart = this.logicalStartColumn();
    const s = this.logicalLine().translateLogicalToString(trimRight, lineStart + startCol, lineStart + endCol, outColumns, skipReplace);
    if (outColumns && lineStart !== 0) {
      for (let i = outColumns.length; --i >= 0; ) {
        outColumns[i] -= lineStart;
      }
    }
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
  _cache4: number = -1;

  constructor(cols: number, fillCellData?: IAttributeData, src?: WrappedBufferLine, startIndex?: number) {
    super();
    // MAYBE: const buffer = new ArrayBuffer(0, { maxByteLength: 6 * cols });
    // const buffer = new ArrayBuffer(4 * cols, { maxByteLength: 6 * cols });
    if (src) {
      const lline = src.logicalLine();
      const oldStart = startIndex || 0;
      this._data = lline._data.slice(oldStart);
      this._dataLength = lline._dataLength - oldStart;
      this._extendedAttrs = lline._extendedAttrs.slice(oldStart);
    } else {
      this._data = new Uint32Array(cols);
      this._dataLength = 0;
    }
    this.length = cols;
    this._isWrapped = false;
    if (fillCellData) { this.preInsert(0, fillCellData); }
  }
  public override logicalLine(): LogicalBufferLine { return this; }
  public override logicalStartColumn(): LineColumn { return 0; }
  override data(): Uint32Array { return this._data; }
  override dataLength(): number { return this._dataLength; }
  override _cachedBg(): number { return this._cache2; }
  override _cachedFg(): number { return this._cache3; }

  protected _cachedColumnInRow(): RowColumn { return (this.logicalLine()._cache1 & 0xFFFF); }

  // count can be negative
  addEmptyDataElements(position: number, count: number): void {
    const oldDataLength = this._dataLength;
    this.resizeData(oldDataLength + count);
    if (count < 0) {
      this.data().copyWithin(position, position - count, oldDataLength);
    } else {
      this.data().copyWithin(position + count, position, oldDataLength);
    }
    this._dataLength += count;
    for (let next = this.nextRowSameLine; next; next = next.nextRowSameLine) {
      if (next.startIndex > position)
      {next.startIndex += count;}
    }
    if (count < 0) {
      this._extendedAttrs.copyWithin(position, position - count, oldDataLength);
    } else {
      this._extendedAttrs.length = this._dataLength
      this._extendedAttrs.copyWithin(position + count, position, oldDataLength);
    }
    if (this._extendedAttrs.length > this._dataLength) {
      this._extendedAttrs.length = this._dataLength;
    }
  }

  resizeData(size: number): void {
    if (size > this.data().length) {
      // buffer = new ArrayBuffer(buffer.byteLength, { maxByteLength: 6 * size });
      const dataNew = new Uint32Array((3 * size) >> 1);
      dataNew.set(this._data);
      this.logicalLine()._data = dataNew;
    }
  }

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
  /** Internal - delete n columns, with no adjust at end of line. */
  public deleteCellsOnly(idata0: number, colOffset0: number, n: number): void {
    let todo = n;
    const data = this.data();
    let idata = idata0;
    let colOffset = colOffset0;
    let dskipFirst = idata; let dskipLast = -1; let w;
    let fgValue = -1; // cursor.getFg();
    let bgValue = -1; // cursor.getBg();
    let styleValue = -1;
    let extended = undefined; // cursor.getStyleFlags(); // FIXME handle extendedattrs

    if (colOffset === 0) {
      while (idata > 0) {
        let skipItem = true;
        const word = data[idata-1];
        switch (BufferLine.wKind(word)) {
          case DataKind.BG: bgValue = word & 0x3ffffff; break;
          case DataKind.FG: fgValue = word & 0x3ffffff; break;
          case DataKind.STYLE_FLAGS:
            styleValue = word & 0xfffffff;
            extended = (word & StyleFlags.HAS_EXTENDED) !== 0 && this._extendedAttrs[idata - 1];
            break;
          default: skipItem = false;
        }
        if (skipItem) {
          idata--;
          dskipFirst = idata;
          dskipLast = idata0-1;
        } else {
          break;
        }
      }
    }

    for (; todo > 0 && idata < this.dataLength(); idata++) {
      const word = data[idata];
      const kind = BufferLine.wKind(word);
      switch (kind) {
        case DataKind.FG:
          fgValue = word & 0x3ffffff;
          dskipLast = idata;
          break;
        case DataKind.BG:
          bgValue = word & 0x3ffffff;
          dskipLast = idata;
          break;
        case DataKind.STYLE_FLAGS:
          dskipLast = idata;
          styleValue = word & 0xfffffff;
          extended = (word & StyleFlags.HAS_EXTENDED) !== 0 && this._extendedAttrs[idata];
          break;
        case DataKind.SKIP_COLUMNS:
          const wlen = BufferLine.wSkipCount(word);
          if (colOffset === 0 && wlen <= todo) {
            dskipLast = idata;
            todo -= wlen;
          } else {
            const delta = Math.min(todo,  wlen - colOffset);
            this.data()[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, wlen - delta);
            todo -= delta;
          }
          colOffset = 0;
          break;
        case DataKind.CHAR_W1:
        case DataKind.CHAR_W2:
          w = kind - DataKind.CHAR_W1; // 0, or 1 if wide characters
          if (colOffset === 0 && (1 << w) <= todo) {
            dskipLast = idata;
            todo -= 1 << w;
          }
          break;
        case DataKind.CLUSTER_START_W1:
        case DataKind.CLUSTER_START_W2:
          w = kind - DataKind.CLUSTER_START_W1; // 0, or 1 if wide characters
          const clEnd = this.clusterEnd(idata);
          if (colOffset < (1 << w)) {
            idata = clEnd;
            dskipLast = idata;
            todo -= (1 << w);
          }
          colOffset = 0;
          break;
      }
    }
    idata0 = dskipFirst;
    if (bgValue >= 0) {
      this.data()[idata0++] = BufferLine.wSet1(DataKind.BG, bgValue);
    }
    if (fgValue >= 0 && idata0 !== this._dataLength) {
      this.data()[idata0++] = BufferLine.wSet1(DataKind.FG, fgValue);
    }
    if (styleValue >= 0 && idata0 !== this._dataLength) {
      if ((styleValue & StyleFlags.HAS_EXTENDED) !== 0 && extended) {
        if (! extended) throw(new Error("missing extended"));
        this._extendedAttrs[idata0] = extended;
      }
      this.data()[idata0++] = BufferLine.wSet1(DataKind.STYLE_FLAGS, styleValue);
    }
    if (dskipLast >= 0) {
      const dcount = dskipLast + 1 - idata0;
      this.addEmptyDataElements(idata0, - dcount);
    }
  }

  public setWrapped(previousLine: NewBufferLine): WrappedBufferLine {
    previousLine.moveToColumn(previousLine.length);
    const startLine = previousLine.logicalLine();
    startLine.resizeData(this._dataLength + startLine._dataLength);
    startLine._data.set(this._data.subarray(0, this._dataLength), startLine._dataLength);
    startLine._dataLength += this._dataLength;
    for (let i = this._extendedAttrs.length; --i >= 0; ) {
       const attr = this._extendedAttrs[i];
       if (attr) { startLine._extendedAttrs[startLine._dataLength + i] = attr; }
    }
    const newRow = new WrappedBufferLine(previousLine);
    newRow.nextRowSameLine = this.nextRowSameLine;
    startLine.setStartFromCache(newRow);
    for (let following = this.nextRowSameLine; following;
      following = following?.nextRowSameLine) {
      following.startColumn += newRow.startColumn;
      following.startIndex += newRow.startIndex;
    }
    return newRow;
  }

  public translateLogicalToString(trimRight: boolean = false, startCol: number = 0, endCol: number = Infinity, outColumns?: number[], skipReplace: string = WHITESPACE_CELL_CHAR): string {
    if (outColumns) {
      outColumns.length = 0;
    }
    let s = '';
    let col = 0;
    let pendingStart = -1;
    let pendingLength = 0;
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
      if (outColumns) {
        for (let i = 0; i < length; ++i) {
          outColumns.push(col);
        }
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
      const wide = kind === DataKind.CHAR_W2 || kind === DataKind.CLUSTER_START_W2 ? 1 : 0;
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
        case DataKind.CLUSTER_START_W1:
        case DataKind.CLUSTER_START_W2:
          const clEnd = this.clusterEnd(idata);
          wcols = 1 << wide;
          if (col >= startCol && col + wcols <= endCol) {
            addPendingString(idata, clEnd - idata);
          }
          idata = clEnd - 1;
          col += wcols;
          break;
        case DataKind.CHAR_W1:
        case DataKind.CHAR_W2:
          wcols = 1 << wide;
          if (col >= startCol && col + wcols <= endCol) {
            addPendingString(idata, 1);
          }
          col += wcols;
          break;
      }
    }
    if (col < startCol) { col = startCol; }
    if (! trimRight && col < endCol && endCol !== Infinity) {
      addPendingSkip(endCol - col);
    }
    pendingForce();
    return s;
  }

  /** for debugging */
  getText(skipReplace: string = ' '): string {
    return this.translateLogicalToString(true, 0, this.length, undefined, skipReplace);
  }
}

export class WrappedBufferLine extends NewBufferLine implements IBufferLine {
  _logicalLine: LogicalBufferLine;
  /** Number of logical columns in previous rows.
   * Also: logical column number (column number assuming infinitely-wide
   * terminal) corresponding to the start of this row.
   * If R is 0 for the previous LogicalBufferLine, R is 1 for first
   * WrappedBufferLine and so on, startColumn will *usually* be N*W
   * (where W is the width of the terminal in columns) but may be slightly
   * different when a wide character at column W-1 must wrap "early".
   */
  startColumn: LineColumn = 0;
  // DEPRECATE FIXME startIndex doesn't work in the case of when soft line-break is inside a SKIP_COLUMNS.
  // startIndex, startFg, startBg, startStyle are primaraily used by _cacheReset
  // to optimize moveToColumn on same row.  It might be best to get rid of them;
  // to migitate the pergfance cost we cann support backwards movement by moveToColumn.
  // Changing Data>FG etc to use xor-encoding would help. TODO.
  startIndex: number = 0;
  startFg: number = 0;
  startBg: number = 0;
  startStyle: number = -1;

  constructor(prevRow: NewBufferLine) {
    super();
    const logicalLine = prevRow.logicalLine();
    prevRow.nextRowSameLine = this;
    this._logicalLine = logicalLine;
    this._isWrapped = true;
    this.length = logicalLine.length;
  }

  public override logicalLine(): LogicalBufferLine { return this._logicalLine; }
  public override logicalStartColumn(): LineColumn { return this.startColumn; }
  protected override data(): Uint32Array { return this._logicalLine.data(); }
  public override dataLength(): number { return this._logicalLine.dataLength(); }
  public override _cachedBg(): number { return this._logicalLine._cachedBg(); }
  public override _cachedFg(): number { return this._logicalLine._cachedFg(); }
  addEmptyDataElements(position: number, count: number): void {
    this._logicalLine.addEmptyDataElements(position, count);
  }
  protected _cachedColumnInRow(): RowColumn { return (this.logicalLine()._cache1 & 0xFFFF) - this.startColumn; }
  protected _cacheReset(): void {
    this._cacheSetFgBg(this.startFg, this.startBg);
    this._cacheSetStyleFlagsIndex(this.startStyle);
    this._cacheSetColumnDataIndex(this.startColumn, this.startIndex);
  }
  public resizeData(size: number): void { this._logicalLine.resizeData(size); }
  public cleanupMemory(): number { return 0;}
}
