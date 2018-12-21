/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { CharData, IBufferLine } from './Types';
import { NULL_CELL_CODE, NULL_CELL_WIDTH, NULL_CELL_CHAR, CHAR_DATA_CHAR_INDEX, CHAR_DATA_WIDTH_INDEX, WHITESPACE_CELL_CHAR, CHAR_DATA_ATTR_INDEX } from './Buffer';

/**
 * Class representing a terminal line.
 *
 * @deprecated to be removed with one of the next releases
 */
export class BufferLineJSArray implements IBufferLine {
  protected _data: CharData[];
  public isWrapped = false;
  public length: number;

  constructor(cols: number, fillCharData?: CharData, isWrapped?: boolean) {
    this._data = [];
    if (!fillCharData) {
      fillCharData = [0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE];
    }
    for (let i = 0; i < cols; i++) {
      this._push(fillCharData);  // Note: the ctor ch is not cloned (resembles old behavior)
    }
    if (isWrapped) {
      this.isWrapped = true;
    }
    this.length = this._data.length;
  }

  private _pop(): CharData | undefined  {
    const data = this._data.pop();
    this.length = this._data.length;
    return data;
  }

  private _push(data: CharData): void {
    this._data.push(data);
    this.length = this._data.length;
  }

  private _splice(start: number, deleteCount: number, ...items: CharData[]): CharData[] {
    const removed = this._data.splice(start, deleteCount, ...items);
    this.length = this._data.length;
    return removed;
  }

  public get(index: number): CharData {
    return this._data[index];
  }

  public set(index: number, data: CharData): void {
    this._data[index] = data;
  }

  /** insert n cells ch at pos, right cells are lost (stable length)  */
  public insertCells(pos: number, n: number, ch: CharData): void {
    while (n--) {
      this._splice(pos, 0, ch);
      this._pop();
    }
  }

  /** delete n cells at pos, right side is filled with fill (stable length) */
  public deleteCells(pos: number, n: number, fillCharData: CharData): void {
    while (n--) {
      this._splice(pos, 1);
      this._push(fillCharData);
    }
  }

  /** replace cells from pos to pos + n - 1 with fill */
  public replaceCells(start: number, end: number, fillCharData: CharData): void {
    while (start < end  && start < this.length) {
      this.set(start++, fillCharData);  // Note: fill is not cloned (resembles old behavior)
    }
  }

  /** resize line to cols filling new cells with fill */
  public resize(cols: number, fillCharData: CharData, shrink: boolean = false): void {
    while (this._data.length < cols) {
      this._data.push(fillCharData);
    }
    if (shrink) {
      while (this._data.length > cols) {
        this._data.pop();
      }
    }
    this.length = this._data.length;
  }

  public fill(fillCharData: CharData): void {
    for (let i = 0; i < this.length; ++i) {
      this.set(i, fillCharData);
    }
  }

  public copyFrom(line: BufferLineJSArray): void {
    this._data = line._data.slice(0);
    this.length = line.length;
    this.isWrapped = line.isWrapped;
  }

  public clone(): IBufferLine {
    const newLine = new BufferLineJSArray(0);
    newLine.copyFrom(this);
    return newLine;
  }

  public getTrimmedLength(): number {
    for (let i = this.length - 1; i >= 0; --i) {
      const ch = this.get(i);
      if (ch[CHAR_DATA_CHAR_INDEX] !== '') {
        return i + ch[CHAR_DATA_WIDTH_INDEX];
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
      result += this.get(startCol)[CHAR_DATA_CHAR_INDEX] || WHITESPACE_CELL_CHAR;
      startCol += this.get(startCol)[CHAR_DATA_WIDTH_INDEX] || 1;
    }
    return result;
  }
}


/**
 *   |              uint16_t               |              uint16_t               |
 *   | attr pointer(13) comb(1) wcwidth(2) |          BMP codepoint(16)          |
 *   |                                  uint32_t                                 |
 *   |                                   cell                                    |
 */


const CELL_SIZE_16 = 1;

const enum Cell {
  codepointMask = 0xFFFF,
  isCombined = 0x40000,
  widthMask = 0x30000,
  widthShift = 16,
  attrMask = 0xFFF80000,
  attrShift = 19
}

export class BufferLine implements IBufferLine {
  protected _data: Uint32Array | null = null;
  protected _combined: {[index: number]: string} = {};
  protected _attrs: number[] = [];
  protected _attrIndex: number = 0;
  public length: number;

  constructor(cols: number, fillCharData?: CharData, public isWrapped: boolean = false) {
    if (!fillCharData) {
      fillCharData = [0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE];
    }
    if (cols) {
      this._data = new Uint32Array(cols * CELL_SIZE_16);
      this._attrs.push(fillCharData[CHAR_DATA_ATTR_INDEX]);
      for (let i = 0; i < cols; ++i) {
        this.set(i, fillCharData);
      }
    }
    this.length = cols;
  }

  public get(index: number): CharData {
    const content = this._data[index];
    const cp = content & Cell.codepointMask;
    return [
      this._attrs[content >> Cell.attrShift],
      (content & Cell.isCombined)
        ? this._combined[index]
        : (cp) ? String.fromCharCode(cp) : '',
        (content & Cell.widthMask) >> Cell.widthShift,
        (content & Cell.isCombined)
        ? this._combined[index].charCodeAt(this._combined[index].length - 1)
        : cp
    ];
  }

  public insertAttr(attr: number): number {
    let attrIndex = this._attrs.indexOf(attr);
    if (attrIndex === -1) {
      this._attrs.push(attr);
      attrIndex = this._attrs.length - 1;
    }
    return attrIndex;
  }

  private _toCellValue(value: CharData): number {
    let result = (value[CHAR_DATA_CHAR_INDEX].length > 1) ? Cell.isCombined : value[CHAR_DATA_CHAR_INDEX].charCodeAt(0);
    return this.insertAttr(value[CHAR_DATA_ATTR_INDEX]) << Cell.attrShift | value[CHAR_DATA_WIDTH_INDEX] << Cell.widthShift | result;
  }

  public set(index: number, value: CharData): void {
    this._data[index] = this._toCellValue(value);
  }

  public insertCells(pos: number, n: number, fillCharData: CharData): void {
    pos %= this.length;
    if (n < this.length - pos) {
      for (let i = this.length - pos - n - 1; i >= 0; --i) {
        this.set(pos + n + i, this.get(pos + i));
      }
      for (let i = 0; i < n; ++i) {
        this.set(pos + i, fillCharData);
      }
    } else {
      for (let i = pos; i < this.length; ++i) {
        this.set(i, fillCharData);
      }
    }
  }

  public deleteCells(pos: number, n: number, fillCharData: CharData): void {
    pos %= this.length;
    if (n < this.length - pos) {
      for (let i = 0; i < this.length - pos - n; ++i) {
        this.set(pos + i, this.get(pos + n + i));
      }
      for (let i = this.length - n; i < this.length; ++i) {
        this.set(i, fillCharData);
      }
    } else {
      for (let i = pos; i < this.length; ++i) {
        this.set(i, fillCharData);
      }
    }
  }

  public replaceCells(start: number, end: number, fillCharData: CharData): void {
    while (start < end  && start < this.length) {
      this.set(start++, fillCharData);
    }
  }

  public resize(cols: number, fillCharData: CharData, shrink: boolean = false): void {
    if (cols === this.length || (!shrink && cols < this.length)) {
      return;
    }
    if (cols > this.length) {
      const data = new Uint32Array(cols);
      if (this.length) {
        if (cols < this._data.length) {
          data.set(this._data.subarray(0, cols));
        } else {
          data.set(this._data);
        }
      }
      this._data = data;
      for (let i = this.length; i < cols; ++i) {
        this.set(i, fillCharData);
      }
    } else if (shrink) {
      if (cols) {
        const data = new Uint32Array(cols);
        data.set(this._data.subarray(0, cols));
        this._data = data;
      } else {
        this._data = null;
      }
    }
    this.length = cols;
  }

  /** fill a line with fillCharData */
  public fill(fillCharData: CharData): void {
    this._combined = {};
    for (let i = 0; i < this.length; ++i) {
      this.set(i, fillCharData);
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
    this._attrs = line._attrs.slice(0);
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
    newLine._attrs = this._attrs.slice(0);
    newLine.isWrapped = this.isWrapped;
    return newLine;
  }

  public getTrimmedLength(): number {
    for (let i = this.length - 1; i >= 0; --i) {
      if ((this._data[i] & Cell.codepointMask) !== 0) {
        return i + ((this._data[i] & Cell.widthMask) >> Cell.widthShift);
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
      const content = this._data[startCol];
      const cp = content & Cell.codepointMask;
      result += (content & Cell.isCombined) ? this._combined[startCol] : (cp) ? String.fromCharCode(cp) : WHITESPACE_CELL_CHAR;
      startCol += ((content & Cell.widthMask) >> Cell.widthShift) || 1; // always advance by 1
    }
    return result;
  }
}

