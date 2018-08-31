/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { CharData, IBufferLine } from './Types';
import { NULL_CELL_CODE, NULL_CELL_WIDTH, NULL_CELL_CHAR } from './Buffer';

/**
 * Class representing a terminal line.
 */
export class BufferLineOld implements IBufferLine {
  static blankLine(cols: number, attr: number, isWrapped?: boolean): IBufferLine {
    const ch: CharData = [attr, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE];
    return new BufferLineOld(cols, ch, isWrapped);
  }
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
    if (shrink) {
      while (this._data.length > cols) {
        this._data.pop();
      }
    }
    while (this._data.length < cols) {
      this._data.push(fillCharData);
    }
    this.length = cols;
  }
}

const enum Cell {
  FLAGS = 0,
  STRING = 1,
  WIDTH = 2,
  SIZE = 3
}

export class BufferLine implements IBufferLine {
  static blankLine(cols: number, attr: number, isWrapped?: boolean): IBufferLine {
    const ch: CharData = [attr, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE];
    return new BufferLine(cols, ch, isWrapped);
  }
  protected _data: Uint32Array | null = null;
  protected _combined: {[index: number]: string} = {};
  public length: number;

  constructor(cols: number, fillCharData?: CharData, public isWrapped: boolean = false) {
    if (!fillCharData) {
      fillCharData = [0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE];
    }
    this._data = new Uint32Array(cols * Cell.SIZE);
    for (let i = 0; i < cols; ++i) {
      this.set(i, fillCharData);
    }
    this.length = cols || 0;
  }

  public get(index: number): CharData {
    const stringData = this._data[index * Cell.SIZE + Cell.STRING];
    return [
      this._data[index * Cell.SIZE + Cell.FLAGS],
      (stringData & 0x80000000)
        ? this._combined[index]
        : (stringData) ? String.fromCharCode(stringData) : '',
      this._data[index * Cell.SIZE + Cell.WIDTH],
      stringData & ~0x80000000
    ];
  }

  public set(index: number, value: CharData): void {
    this._data[index * Cell.SIZE + Cell.FLAGS] = value[0];
    if (value[1].length > 1) {
      this._combined[index] = value[1];
      this._data[index * Cell.SIZE + Cell.STRING] = index | 0x80000000;
    } else {
      this._data[index * Cell.SIZE + Cell.STRING] = value[1].charCodeAt(0);
    }
    this._data[index * Cell.SIZE + Cell.WIDTH] = value[2];
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
    if (cols === this.length) {
      return;
    }
    if (cols > this.length) {
      const data = new Uint32Array(cols * Cell.SIZE);
      if (this._data) {
        data.set(this._data);
      }
      this._data = data;
      for (let i = this.length; i < cols; ++i) {
        this.set(i, fillCharData);
      }
    } else if (shrink) {
      if (cols) {
        const data = new Uint32Array(cols * Cell.SIZE);
        data.set(this._data.subarray(0, this.length));
        this._data = data;
      } else {
        this._data = null;
      }
    }
    this.length = cols;
  }
}
