/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { CharData, IBufferLine } from './Types';
import { NULL_CELL_CODE, NULL_CELL_WIDTH, NULL_CELL_CHAR } from './Buffer';

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
}

/** typed array slots taken by one cell */
const CELL_SIZE = 3;

/** cell member indices */
const enum Cell {
  FLAGS = 0,
  STRING = 1,
  WIDTH = 2
}

/**
 * Typed array based bufferline implementation.
 */
export class BufferLine implements IBufferLine {
  protected _data: Uint32Array | null = null;
  protected _combined: {[index: number]: string} = {};
  public length: number;

  constructor(cols: number, fillCharData?: CharData, public isWrapped: boolean = false) {
    if (!fillCharData) {
      fillCharData = [0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE];
    }
    if (cols) {
      this._data = new Uint32Array(cols * CELL_SIZE);
      for (let i = 0; i < cols; ++i) {
        this.set(i, fillCharData);
      }
    }
    this.length = cols;
  }

  public get(index: number): CharData {
    const stringData = this._data[index * CELL_SIZE + Cell.STRING];
    return [
      this._data[index * CELL_SIZE + Cell.FLAGS],
      (stringData & 0x80000000)
        ? this._combined[index]
        : (stringData) ? String.fromCharCode(stringData) : '',
      this._data[index * CELL_SIZE + Cell.WIDTH],
      (stringData & 0x80000000)
        ? this._combined[index].charCodeAt(this._combined[index].length - 1)
        : stringData
    ];
  }

  public set(index: number, value: CharData): void {
    this._data[index * CELL_SIZE + Cell.FLAGS] = value[0];
    if (value[1].length > 1) {
      this._combined[index] = value[1];
      this._data[index * CELL_SIZE + Cell.STRING] = index | 0x80000000;
    } else {
      this._data[index * CELL_SIZE + Cell.STRING] = value[1].charCodeAt(0);
    }
    this._data[index * CELL_SIZE + Cell.WIDTH] = value[2];
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
        this.set(i, fillCharData);
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
    this.isWrapped = line.isWrapped;
  }

  /** create a new clone */
  public clone(): IBufferLine {
    const newLine = new BufferLine(0);
    // creation of new typed array from another is actually pretty slow :(
    // still faster than copying values one by one
    newLine._data = new Uint32Array(this._data);
    newLine.length = this.length;
    for (const el in this._combined) {
      newLine._combined[el] = this._combined[el];
    }
    newLine.isWrapped = this.isWrapped;
    return newLine;
  }
}
