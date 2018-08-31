/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { CharData, IBufferLine } from './Types';
import { NULL_CELL_CODE, NULL_CELL_WIDTH, NULL_CELL_CHAR } from './Buffer';

/**
 * Class representing a terminal line.
 */
export class BufferLine implements IBufferLine {
  static blankLine(cols: number, attr: number, isWrapped?: boolean): IBufferLine {
    const ch: CharData = [attr, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE];
    return new BufferLine(cols, ch, isWrapped);
  }
  protected _data: CharData[];
  public isWrapped = false;
  public length: number;

  constructor(cols?: number, ch?: CharData, isWrapped?: boolean) {
    this._data = [];
    this.length = this._data.length;
    if (cols) {
      if (!ch) {
        ch = [0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE];
      }
      for (let i = 0; i < cols; i++) {
        this._push(ch);  // Note: the ctor ch is not cloned (resembles old behavior)
      }
    }
    if (isWrapped) {
      this.isWrapped = true;
    }
  }

  public get(index: number): CharData {
    return this._data[index];
  }

  public set(index: number, data: CharData): void {
    this._data[index] = data;
  }

  /**
   * @deprecated
   */
  private _pop(): CharData | undefined  {
    const data = this._data.pop();
    this.length = this._data.length;
    return data;
  }

  /**
   * @deprecated
   * @param data
   */
  private _push(data: CharData): void {
    this._data.push(data);
    this.length = this._data.length;
  }

  /**
   * @deprecated
   * @param start
   * @param deleteCount
   * @param items
   */
  private _splice(start: number, deleteCount: number, ...items: CharData[]): CharData[] {
    const removed = this._data.splice(start, deleteCount, ...items);
    this.length = this._data.length;
    return removed;
  }

  /** insert n cells ch at pos, right cells are lost (stable length)  */
  public insertCells(pos: number, n: number, ch: CharData): void {
    while (n--) {
      this._splice(pos, 0, ch);
      this._pop();
    }
  }

  /** delete n cells at pos, right side is filled with fill (stable length) */
  public deleteCells(pos: number, n: number, fill: CharData): void {
    while (n--) {
      this._splice(pos, 1);
      this._push(fill);
    }
  }

  /** replace cells from pos to pos + n - 1 with fill */
  public replaceCells(start: number, end: number, fill: CharData): void {
    while (start < end  && start < this.length) {
      this.set(start++, fill);  // Note: fill is not cloned (resembles old behavior)
    }
  }

  /** resize line to cols filling new cells with fill */
  public resize(cols: number, fill: CharData, shrink: boolean = false): void {
    if (shrink) {
      while (this._data.length > cols) {
        this._data.pop();
      }
    }
    while (this._data.length < cols) {
      this._data.push(fill);
    }
    this.length = cols;
  }
}
