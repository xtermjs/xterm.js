/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { CharData } from './Types';
import { NULL_CELL_CODE, NULL_CELL_WIDTH, NULL_CELL_CHAR } from './Buffer';

/**
 * Class representing a terminal line.
 * Currently the class is a thin proxy to `CharData[]`.
 * Once the storages are in place it will proxy access to
 * typed array based line data.
 * TODO:
 *    - move Buffer.translateBufferLineToString here?
 *    - next steps towards typed array:
 *        - create ITerminalLine interface w'o length methods
 *        - resize method
 *        - replace all external push/pop/splice accesses
 *        - fixed length
 *        - remove push/pop/splice
 *        - implement typed array alternative once string is removed from CharData
 */
export class TerminalLine {
  static defaultCell: CharData = [0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE];
  static blankLine(cols: number, attr: number, isWrapped?: boolean): TerminalLine {
    const ch: CharData = [attr, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE];
    return new TerminalLine(cols, ch, isWrapped);
  }
  private _data: CharData[];
  public isWrapped = false;
  public length: number;

  constructor(cols?: number, ch?: CharData, isWrapped?: boolean) {
    this._data = [];
    this.length = this._data.length;
    if (cols) {
      if (!ch) ch = TerminalLine.defaultCell;
      for (let i = 0; i < cols; i++) this.push(ch);  // Note: the ctor ch is not cloned
    }
    if (isWrapped) this.isWrapped = true;
  }

  public get(index: number): CharData {
    return this._data[index];
  }

  public set(index: number, data: CharData): void {
    this._data[index] = data;
    // TODO: unref old, ref new
  }

  // to be removed for typed array
  public pop(): CharData | undefined  {
    // TODO: unref here, change CharData to [typeof Attributes, ...]
    const data = this._data.pop();
    this.length = this._data.length;
    return data;
  }

  // to be removed for typed array
  public push(data: CharData): void {
    this._data.push(data);
    this.length = this._data.length;
    // TODO: ref here
  }

  // to be removed for typed array
  public splice(start: number, deleteCount: number, ...items: CharData[]): CharData[] {
    const removed = this._data.splice(start, deleteCount, ...items);
    this.length = this._data.length;
    // TODO: ref new, unref old
    return removed;
  }

  /** to be called when a line gets removed */
  public release(): void {
    // TODO: unref here
  }
  public toArray(): CharData[] {
    return this._data;
  }

  /** insert n cells ch at pos, right cells are lost (stable length)  */
  public insertCells(pos: number, n: number, ch: CharData): void {
    while (n--) {
      this.splice(pos, 0, ch);
      this.pop();
    }
  }

  /** delete n cells at pos, right side is filled with fill (stable length) */
  public deleteCells(pos: number, n: number, fill: CharData): void {
    while (n--) {
      this.splice(pos, 1);
      this.push(fill);
    }
  }
  
  /** replace cells from pos to pos + n - 1 with fill */
  public replaceCells(start: number, end: number, fill: CharData): void {
    while (start < end  && start < this.length) this.set(start++, fill);  // Note: fill is not cloned
  }
}
