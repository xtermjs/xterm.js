/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { CharData, IBufferLine, ICellData } from './Types';
import { NULL_CELL_CODE, NULL_CELL_WIDTH, NULL_CELL_CHAR, CHAR_DATA_CHAR_INDEX, CHAR_DATA_WIDTH_INDEX, WHITESPACE_CELL_CHAR, CHAR_DATA_ATTR_INDEX } from './Buffer';
import { stringFromCodePoint } from './core/input/TextDecoder';


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

/**
 * Bitmasks and helper for accessing data in `content`.
 */
export const enum Content {
  /**
   * bit 1..21    codepoint, max allowed in UTF32 is 0x10FFFF (21 bits taken)
   *              read:   `codepoint = content & Content.codepointMask;`
   *              write:  `content |= codepoint & Content.codepointMask;`
   *                      shortcut if precondition `codepoint <= 0x10FFFF` is met:
   *                      `content |= codepoint;`
   */
  CODEPOINT_MASK = 0x1FFFFF,

  /**
   * bit 22       flag indication whether a cell contains combined content
   *              read:   `isCombined = content & Content.isCombined;`
   *              set:    `content |= Content.isCombined;`
   *              clear:  `content &= ~Content.isCombined;`
   */
  IS_COMBINED = 0x200000,  // 1 << 21

  /**
   * bit 1..22    mask to check whether a cell contains any string data
   *              we need to check for codepoint and isCombined bits to see
   *              whether a cell contains anything
   *              read:   `isEmtpy = !(content & Content.hasContent)`
   */
  HAS_CONTENT = 0x3FFFFF,

  /**
   * bit 23..24   wcwidth value of cell, takes 2 bits (ranges from 0..2)
   *              read:   `width = (content & Content.widthMask) >> Content.widthShift;`
   *                      `hasWidth = content & Content.widthMask;`
   *                      as long as wcwidth is highest value in `content`:
   *                      `width = content >> Content.widthShift;`
   *              write:  `content |= (width << Content.widthShift) & Content.widthMask;`
   *                      shortcut if precondition `0 <= width <= 3` is met:
   *                      `content |= width << Content.widthShift;`
   */
  WIDTH_MASK = 0xC00000,   // 3 << 22
  WIDTH_SHIFT = 22
}

/**
 * CellData - represents a single Cell in the terminal buffer.
 */
export class CellData implements ICellData {

  /** Helper to create CellData from CharData. */
  public static fromCharData(value: CharData): CellData {
    const obj = new CellData();
    obj.setFromCharData(value);
    return obj;
  }

  /** Primitives from terminal buffer. */
  public content: number = 0;
  public fg: number = 0;
  public bg: number = 0;
  public combinedData: string = '';

  /** Whether cell contains a combined string. */
  public get combined(): number {
    return this.content & Content.IS_COMBINED;
  }

  /** Width of the cell. */
  public get width(): number {
    return this.content >> Content.WIDTH_SHIFT;
  }

  /** JS string of the content. */
  public get chars(): string {
    if (this.content & Content.IS_COMBINED) {
      return this.combinedData;
    }
    if (this.content & Content.CODEPOINT_MASK) {
      return stringFromCodePoint(this.content & Content.CODEPOINT_MASK);
    }
    return '';
  }

  /**
   * Codepoint of cell
   * Note this returns the UTF32 codepoint of single chars,
   * if content is a combined string it returns the codepoint
   * of the last char in string to be in line with code in CharData.
   * */
  public get code(): number {
    return ((this.combined) ? this.combinedData.charCodeAt(this.combinedData.length - 1) : this.content & Content.CODEPOINT_MASK);
  }

  /** Set data from CharData */
  public setFromCharData(value: CharData): void {
    this.fg = value[CHAR_DATA_ATTR_INDEX];
    this.bg = 0;
    let combined = false;

    // surrogates and combined strings need special treatment
    if (value[CHAR_DATA_CHAR_INDEX].length > 2) {
      combined = true;
    } else if (value[CHAR_DATA_CHAR_INDEX].length === 2) {
      const code = value[CHAR_DATA_CHAR_INDEX].charCodeAt(0);
      // if the 2-char string is a surrogate create single codepoint
      // everything else is combined
      if (0xD800 <= code && code <= 0xDBFF) {
        const second = value[CHAR_DATA_CHAR_INDEX].charCodeAt(1);
        if (0xDC00 <= second && second <= 0xDFFF) {
          this.content = ((code - 0xD800) * 0x400 + second - 0xDC00 + 0x10000) | (value[CHAR_DATA_WIDTH_INDEX] << Content.WIDTH_SHIFT);
        } else {
          combined = true;
        }
      } else {
        combined = true;
      }
    } else {
      this.content = value[CHAR_DATA_CHAR_INDEX].charCodeAt(0) | (value[CHAR_DATA_WIDTH_INDEX] << Content.WIDTH_SHIFT);
    }
    if (combined) {
      this.combinedData = value[CHAR_DATA_CHAR_INDEX];
      this.content = Content.IS_COMBINED | (value[CHAR_DATA_WIDTH_INDEX] << Content.WIDTH_SHIFT);
    }
  }

  /** Get data as CharData. */
  public get asCharData(): CharData {
    return [this.fg, this.chars, this.width, this.code];
  }
}


/**
 * Typed array based bufferline implementation.
 */
export class BufferLine implements IBufferLine {
  protected _data: Uint32Array | null = null;
  protected _combined: {[index: number]: string} = {};
  public length: number;

  constructor(cols: number, fillCellData?: ICellData, public isWrapped: boolean = false) {
    if (cols) {
      this._data = new Uint32Array(cols * CELL_SIZE);
      const cell = fillCellData || CellData.fromCharData([0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]);
      for (let i = 0; i < cols; ++i) {
        this.setCell(i, cell);
      }
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
      (content & Content.IS_COMBINED)
        ? this._combined[index]
        : (cp) ? stringFromCodePoint(cp) : '',
      content >> Content.WIDTH_SHIFT,
      (content & Content.IS_COMBINED)
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
      this._data[index * CELL_SIZE + Cell.CONTENT] = index | Content.IS_COMBINED | (value[CHAR_DATA_WIDTH_INDEX] << Content.WIDTH_SHIFT);
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
  public getFG(index: number): number {
    return this._data[index * CELL_SIZE + Cell.FG];
  }

  /** Get BG cell component. */
  public getBG(index: number): number {
    return this._data[index * CELL_SIZE + Cell.BG];
  }

  /**
   * Test whether contains any chars.
   * Basically an empty has no content, but other cells might differ in FG/BG
   * from real empty cells.
   * */
  public hasContent(index: number): number {
    return this._data[index * CELL_SIZE + Cell.CONTENT] & Content.HAS_CONTENT;
  }

  /**
   * Get codepoint of the cell.
   * To be in line with `code` in CharData this either returns
   * a single UTF32 codepoint or the last codepoint of a combined string.
   */
  public getCodePoint(index: number): number {
    const content = this._data[index * CELL_SIZE + Cell.CONTENT];
    if (content & Content.IS_COMBINED) {
      return this._combined[index].charCodeAt(this._combined[index].length - 1);
    }
    return content & Content.CODEPOINT_MASK;
  }

  /** Test whether the cell contains a combined string. */
  public isCombined(index: number): number {
    return this._data[index * CELL_SIZE + Cell.CONTENT] & Content.IS_COMBINED;
  }

  /** Returns the string content of the cell. */
  public getString(index: number): string {
    const content = this._data[index * CELL_SIZE + Cell.CONTENT];
    if (content & Content.IS_COMBINED) {
      return this._combined[index];
    }
    if (content & Content.CODEPOINT_MASK) {
      return stringFromCodePoint(content & Content.CODEPOINT_MASK);
    }
    // return empty string for empty cells
    return '';
  }

  /**
   * Load data at `index` into `cell`.
   */
  public loadCell(index: number, cell: ICellData): ICellData {
    cell.content = this._data[index * CELL_SIZE + Cell.CONTENT];
    cell.fg = this._data[index * CELL_SIZE + Cell.FG];
    cell.bg = this._data[index * CELL_SIZE + Cell.BG];
    if (cell.content & Content.IS_COMBINED) {
      cell.combinedData = this._combined[index];
    }
    return cell;
  }

  /**
   * Set data at `index` to `cell`.
   */
  public setCell(index: number, cell: ICellData): void {
    if (cell.content & Content.IS_COMBINED) {
      this._combined[index] = cell.combinedData;
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
  public setDataFromCodePoint(index: number, codePoint: number, width: number, fg: number, bg: number): void {
    this._data[index * CELL_SIZE + Cell.CONTENT] = codePoint | (width << Content.WIDTH_SHIFT);
    this._data[index * CELL_SIZE + Cell.FG] = fg;
    this._data[index * CELL_SIZE + Cell.BG] = bg;
  }

  /**
   * Add a char to a cell from input handler.
   * During input stage combining chars with a width of 0 follow and stack
   * onto a leading char. Since we already set the attrs
   * by the previous `setDataFromCodePoint` call, we can omit it here.
   */
  public addCharToCell(index: number, codePoint: number): void {
    let content = this._data[index * CELL_SIZE + Cell.CONTENT];
    if (content & Content.IS_COMBINED) {
      // we already have a combined string, simply add
      this._combined[index] += stringFromCodePoint(codePoint);
    } else {
      if (content & Content.CODEPOINT_MASK) {
        // normal case for combining chars:
        //  - move current leading char + new one into combined string
        //  - set codepoint in cell buffer to index
        //  - set combined flag
        this._combined[index] = stringFromCodePoint(content & Content.CODEPOINT_MASK) + stringFromCodePoint(codePoint);
        content &= ~Content.CODEPOINT_MASK;
        content |= index | Content.IS_COMBINED;
      } else {
        // should not happen - we actually have no data in the cell yet
        // simply set the data in the cell buffer with a width of 1
        content = codePoint | (1 << Content.WIDTH_SHIFT);
      }
      this._data[index * CELL_SIZE + Cell.CONTENT] = content;
    }
  }

  public insertCells(pos: number, n: number, fillCellData: ICellData): void {
    pos %= this.length;
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
  }

  public replaceCells(start: number, end: number, fillCellData: ICellData): void {
    while (start < end  && start < this.length) {
      this.setCell(start++, fillCellData);
    }
  }

  public resize(cols: number, fillCellData: ICellData): void {
    if (cols === this.length) {
      return;
    }
    if (cols > this.length) {
      const data = new Uint32Array(cols * CELL_SIZE);
      if (this.length) {
        if (cols * CELL_SIZE < this._data.length) {
          data.set(this._data.subarray(0, cols * CELL_SIZE));
        } else {
          data.set(this._data);
        }
      }
      this._data = data;
      for (let i = this.length; i < cols; ++i) {
        this.setCell(i, fillCellData);
      }
    } else {
      if (cols) {
        const data = new Uint32Array(cols * CELL_SIZE);
        data.set(this._data.subarray(0, cols * CELL_SIZE));
        this._data = data;
        // Remove any cut off combined data
        const keys = Object.keys(this._combined);
        for (let i = 0; i < keys.length; i++) {
          const key = parseInt(keys[i], 10);
          if (key >= cols) {
            delete this._combined[key];
          }
        }
      } else {
        this._data = null;
        this._combined = {};
      }
    }
    this.length = cols;
  }

  /** fill a line with fillCharData */
  public fill(fillCellData: ICellData): void {
    this._combined = {};
    for (let i = 0; i < this.length; ++i) {
      this.setCell(i, fillCellData);
    }
  }

  /** alter to a full copy of line  */
  public copyFrom(line: BufferLine): void {
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
    this.isWrapped = line.isWrapped;
  }

  /** create a new clone */
  public clone(): IBufferLine {
    const newLine = new BufferLine(0);
    newLine._data = new Uint32Array(this._data);
    newLine.length = this.length;
    for (const el in this._combined) {
      newLine._combined[el] = this._combined[el];
    }
    newLine.isWrapped = this.isWrapped;
    return newLine;
  }

  public getTrimmedLength(): number {
    for (let i = this.length - 1; i >= 0; --i) {
      if ((this._data[i * CELL_SIZE + Cell.CONTENT] & Content.HAS_CONTENT)) {
        return i + (this._data[i * CELL_SIZE + Cell.CONTENT] >> Content.WIDTH_SHIFT);
      }
    }
    return 0;
  }

  public copyCellsFrom(src: BufferLine, srcCol: number, destCol: number, length: number, applyInReverse: boolean): void {
    const srcData = src._data;
    if (applyInReverse) {
      for (let cell = length - 1; cell >= 0; cell--) {
        for (let i = 0; i < CELL_SIZE; i++) {
          this._data[(destCol + cell) * CELL_SIZE + i] = srcData[(srcCol + cell) * CELL_SIZE + i];
        }
      }
    } else {
      for (let cell = 0; cell < length; cell++) {
        for (let i = 0; i < CELL_SIZE; i++) {
          this._data[(destCol + cell) * CELL_SIZE + i] = srcData[(srcCol + cell) * CELL_SIZE + i];
        }
      }
    }

    // Move any combined data over as needed
    const srcCombinedKeys = Object.keys(src._combined);
    for (let i = 0; i < srcCombinedKeys.length; i++) {
      const key = parseInt(srcCombinedKeys[i], 10);
      if (key >= srcCol) {
        this._combined[key - srcCol + destCol] = src._combined[key];
      }
    }
  }

  public translateToString(trimRight: boolean = false, startCol: number = 0, endCol: number = this.length): string {
    if (trimRight) {
      endCol = Math.min(endCol, this.getTrimmedLength());
    }
    let result = '';
    while (startCol < endCol) {
      const content = this._data[startCol * CELL_SIZE + Cell.CONTENT];
      const cp = content & Content.CODEPOINT_MASK;
      result += (content & Content.IS_COMBINED) ? this._combined[startCol] : (cp) ? stringFromCodePoint(cp) : WHITESPACE_CELL_CHAR;
      startCol += (content >> Content.WIDTH_SHIFT) || 1; // always advance by 1
    }
    return result;
  }
}
