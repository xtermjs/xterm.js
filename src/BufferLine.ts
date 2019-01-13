/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { CharData, IBufferLine, ICellData, IColorRGB, IAttributeData } from './Types';
import { NULL_CELL_CODE, NULL_CELL_WIDTH, NULL_CELL_CHAR, CHAR_DATA_CHAR_INDEX, CHAR_DATA_WIDTH_INDEX, WHITESPACE_CELL_CHAR, CHAR_DATA_ATTR_INDEX } from './Buffer';
import { stringFromCodePoint } from './core/input/TextDecoder';
import { FLAGS } from './renderer/Types';
import { DEFAULT_ANSI_COLORS } from './renderer/ColorManager';


/**
 * TODO:
 * The below color-related code can be removed when true color is implemented.
 * It's only purpose is to match true color requests with the closest matching
 * ANSI color code.
 */
const matchColorCache: {[colorRGBHash: number]: number} = {};

// http://stackoverflow.com/questions/1633828
function matchColorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.pow(30 * (r1 - r2), 2)
    + Math.pow(59 * (g1 - g2), 2)
    + Math.pow(11 * (b1 - b2), 2);
}

function matchColor(r1: number, g1: number, b1: number): number {
  const hash = (r1 << 16) | (g1 << 8) | b1;

  if (matchColorCache[hash] !== null && matchColorCache[hash] !== undefined) {
    return matchColorCache[hash];
  }

  let ldiff = Infinity;
  let li = -1;
  let i = 0;
  let c: number;
  let r2: number;
  let g2: number;
  let b2: number;
  let diff: number;

  for (; i < DEFAULT_ANSI_COLORS.length; i++) {
    c = DEFAULT_ANSI_COLORS[i].rgba;
    r2 = c >>> 24;
    g2 = c >>> 16 & 0xFF;
    b2 = c >>> 8 & 0xFF;
    // assume that alpha is 0xFF

    diff = matchColorDistance(r1, g1, b1, r2, g2, b2);

    if (diff === 0) {
      li = i;
      break;
    }

    if (diff < ldiff) {
      ldiff = diff;
      li = i;
    }
  }

  return matchColorCache[hash] = li;
}

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
  HAS_CONTENT = 0x2FFFFF,

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

export enum Attributes {
  /**
   * bit 1..8     blue in RGB, color in P256 and P16
   */
  BLUE_MASK = 0xFF,
  BLUE_SHIFT = 0,
  PCOLOR_MASK = 0xFF,
  PCOLOR_SHIFT = 0,

  /**
   * bit 9..16    green in RGB
   */
  GREEN_MASK = 0xFF00,
  GREEN_SHIFT = 8,

  /**
   * bit 17..24   red in RGB
   */
  RED_MASK = 0xFF0000,
  RED_SHIFT = 16,

  /**
   * bit 25..26   color mode: DEFAULT (0) | P16 (1) | P256 (2) | RGB (3)
   */
  CM_MASK = 0x3000000,
  CM_DEFAULT = 0,
  CM_P16 = 0x1000000,
  CM_P256 = 0x2000000,
  CM_RGB = 0x3000000,

  /**
   * bit 1..24  RGB room
   */
  RGB_MASK = 0xFFFFFF
}

export enum FgFlags {
  /**
   * bit 27..31 (32th bit unused)
   */
  INVERSE = 0x4000000,
  BOLD = 0x8000000,
  UNDERLINE = 0x10000000,
  BLINK = 0x20000000,
  INVISIBLE = 0x40000000
}

export enum BgFlags {
  /**
   * bit 27..32 (upper 4 unused)
   */
  ITALIC = 0x4000000,
  DIM = 0x8000000
}

export class AttributeData implements IAttributeData {
  static toRGB(value: number): IColorRGB {
    return [
      value >>> Attributes.RED_SHIFT & 255,
      value >>> Attributes.GREEN_SHIFT & 255,
      value & 255
    ];
  }
  static fromRGB(value: IColorRGB): number {
    return (value[0] & 255) << Attributes.RED_SHIFT | (value[1] & 255) << Attributes.GREEN_SHIFT | value[2] & 255;
  }

  public clone(): IAttributeData {
    const newObj = new AttributeData();
    newObj.fg = this.fg;
    newObj.bg = this.bg;
    return newObj;
  }

  // data
  public fg: number = 0;
  public bg: number = 0;

  // flags
  public isInverse(): number   { return this.fg & FgFlags.INVERSE; }
  public isBold(): number      { return this.fg & FgFlags.BOLD; }
  public isUnderline(): number { return this.fg & FgFlags.UNDERLINE; }
  public isBlink(): number     { return this.fg & FgFlags.BLINK; }
  public isInvisible(): number { return this.fg & FgFlags.INVISIBLE; }
  public isItalic(): number    { return this.bg & BgFlags.ITALIC; }
  public isDim(): number       { return this.bg & BgFlags.DIM; }

  // color modes
  public getFgColormode(): number { return this.fg & Attributes.CM_MASK; }
  public getBgColormode(): number { return this.bg & Attributes.CM_MASK; }
  public isFgRGB(): boolean       { return (this.fg & Attributes.CM_MASK) === Attributes.CM_RGB; }
  public isBgRGB(): boolean       { return (this.bg & Attributes.CM_MASK) === Attributes.CM_RGB; }
  public isFgPalette(): boolean   { return (this.fg & Attributes.CM_MASK) === Attributes.CM_P16 || (this.fg & Attributes.CM_MASK) === Attributes.CM_P256; }
  public isBgPalette(): boolean   { return (this.bg & Attributes.CM_MASK) === Attributes.CM_P16 || (this.bg & Attributes.CM_MASK) === Attributes.CM_P256; }
  public isFgDefault(): boolean   { return (this.fg & Attributes.CM_MASK) === 0; }
  public isBgDefault(): boolean   { return (this.bg & Attributes.CM_MASK) === 0; }

  // colors
  public getFgColor(channels: boolean = false): number | IColorRGB {
    switch (this.fg & Attributes.CM_MASK) {
      case Attributes.CM_P16:
      case Attributes.CM_P256:  return this.fg & Attributes.PCOLOR_MASK;
      case Attributes.CM_RGB:   return (channels) ? AttributeData.toRGB(this.fg & Attributes.RGB_MASK) : this.fg & Attributes.RGB_MASK;
      default:                  return -1;  // CM_DEFAULT defaults to -1
    }
  }
  public getBgColor(channels: boolean = false): number | IColorRGB {
    switch (this.bg & Attributes.CM_MASK) {
      case Attributes.CM_P16:
      case Attributes.CM_P256:  return this.bg & Attributes.PCOLOR_MASK;
      case Attributes.CM_RGB:   return (channels) ? AttributeData.toRGB(this.bg & Attributes.RGB_MASK) : this.bg & Attributes.RGB_MASK;
      default:                  return -1;  // CM_DEFAULT defaults to -1
    }
  }

  public getOldFlags(): number {
    let flags = 0;
    if (this.isBold()) {
      flags |= FLAGS.BOLD;
    }
    if (this.isUnderline()) {
      flags |= FLAGS.UNDERLINE;
    }
    if (this.isBlink()) {
      flags |= FLAGS.BLINK;
    }
    if (this.isDim()) {
      flags |= FLAGS.DIM;
    }
    if (this.isInvisible()) {
      flags |= FLAGS.INVISIBLE;
    }
    if (this.isInverse()) {
      flags |= FLAGS.INVERSE;
    }
    if (this.isItalic()) {
      flags |= FLAGS.ITALIC;
    }
    return flags;
  }
  public getOldFgColor(): number {
    let color = this.getFgColor() as number;
    if (color === -1) {
      return 256;
    }
    if (this.isFgRGB()) {
      color = matchColor(
        (this.fg & Attributes.RED_MASK) >> Attributes.RED_SHIFT,
        (this.fg & Attributes.GREEN_MASK) >> Attributes.GREEN_SHIFT,
        (this.fg & Attributes.BLUE_MASK) >> Attributes.BLUE_SHIFT
      );
      if (color === -1) {
        color = 256;
      }
    }
    return color;
  }
  public getOldBgColor(): number {
    let color = this.getBgColor() as number;
    if (color === -1) {
      return 256;
    }
    if (this.isBgRGB()) {
      color = matchColor(
        (this.bg & Attributes.RED_MASK) >> Attributes.RED_SHIFT,
        (this.bg & Attributes.GREEN_MASK) >> Attributes.GREEN_SHIFT,
        (this.bg & Attributes.BLUE_MASK) >> Attributes.BLUE_SHIFT
      );
      if (color === -1) {
        color = 256;
      }
    }
    return color;
  }
}

/**
 * CellData - represents a single Cell in the terminal buffer.
 *
 * TODO: attr getter
 */
export class CellData extends AttributeData implements ICellData {

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
  public get isCombined(): number {
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

  /** Codepoint of cell (or last charCode of combined string) */
  public get code(): number {
    return ((this.isCombined) ? this.combinedData.charCodeAt(this.combinedData.length - 1) : this.content & Content.CODEPOINT_MASK);
  }

  /** Set data from CharData */
  public setFromCharData(value: CharData): void {
    this.fg = value[CHAR_DATA_ATTR_INDEX];
    this.bg = 0;
    let combined = false;
    if (value[CHAR_DATA_CHAR_INDEX].length > 2) {
      combined = true;
    } else if (value[CHAR_DATA_CHAR_INDEX].length === 2) {
      const code = value[CHAR_DATA_CHAR_INDEX].charCodeAt(0);
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

  public hasWidth(index: number): number {
    return this._data[index * CELL_SIZE + Cell.CONTENT] & Content.WIDTH_MASK;
  }

  public getFG(index: number): number {
    return this._data[index * CELL_SIZE + Cell.FG];
  }

  public getBG(index: number): number {
    return this._data[index * CELL_SIZE + Cell.BG];
  }

  public hasContent(index: number): number {
    return this._data[index * CELL_SIZE + Cell.CONTENT] & Content.HAS_CONTENT;
  }

  public getCodePoint(index: number): number {
    // returns either the single codepoint or the last charCode in combined
    const content = this._data[index * CELL_SIZE + Cell.CONTENT];
    if (content & Content.IS_COMBINED) {
      return this._combined[index].charCodeAt(this._combined[index].length - 1);
    }
    return content & Content.CODEPOINT_MASK;
  }

  public isCombined(index: number): number {
    return this._data[index * CELL_SIZE + Cell.CONTENT] & Content.IS_COMBINED;
  }

  public getString(index: number): string {
    const content = this._data[index * CELL_SIZE + Cell.CONTENT];
    if (content & Content.IS_COMBINED) {
      return this._combined[index];
    }
    if (content & Content.CODEPOINT_MASK) {
      return stringFromCodePoint(content & Content.CODEPOINT_MASK);
    }
    return ''; // return empty string for empty cells
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
      // we also need to clear and set codepoint to index
      cell.content &= ~Content.CODEPOINT_MASK;
      cell.content |= index;
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

  public resize(cols: number, fillCellData: ICellData, shrink: boolean = false): void {
    if (cols === this.length || (!shrink && cols < this.length)) {
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
    } else if (shrink) {
      if (cols) {
        const data = new Uint32Array(cols * CELL_SIZE);
        data.set(this._data.subarray(0, cols * CELL_SIZE));
        this._data = data;
      } else {
        this._data = null;
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
