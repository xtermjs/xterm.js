/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { CharData } from './Types';
import { NULL_CELL_CODE, NULL_CELL_WIDTH, NULL_CELL_CHAR } from './Buffer';

/**
 * Class representing a terminal line.
 * Currently the class is a thin proxy to `CharData[]`.
 * Once the storages are in place it will proxy access to
 * typed array based line data.
 * TODO: move typical line actions in `InputHandler` and `Terminal` here:
 *    - create blank line
 *    - insert cells
 *    - remove cells
 */
export class TerminalLine {
  static blankLine(cols: number, attr: number, isWrapped?: boolean): TerminalLine {
    const ch: CharData = [attr, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE];
    const line = new TerminalLine();
    if (isWrapped) line.isWrapped = true;
    for (let i = 0; i < cols; i++) line.push(ch);
    return line;
  }
  private _data: CharData[];
  public isWrapped = false;
  length: number;
  constructor() {
    this._data = [];
    this.length = this._data.length;

    // for debugging purpose:
    // throw Error when something tries to do number index access
    // TODO: remove when done with transition
    /*
    for (let i = 0; i < 100; ++i) {
      Object.defineProperty(this, i.toString(), {
        get: () => {
          throw new Error('get per index access is disabled');
        },
        set: (value: any) => {
          throw new Error('set per index access is disabled');
        }
      });
    }
    */

  }
  get(index: number): CharData {
    return this._data[index];
  }
  set(index: number, data: CharData): void {
    this._data[index] = data;
    // TODO: unref old, ref new
  }
  pop(): CharData | undefined  {
    // TODO: unref here, change CharData to [typeof Attributes, ...]
    const data = this._data.pop();
    this.length = this._data.length;
    return data;
  }
  push(data: CharData): void {
    this._data.push(data);
    this.length = this._data.length;
    // TODO: ref here
  }
  splice(start: number, deleteCount: number, ...items: CharData[]): CharData[] {
    const removed = this._data.splice(start, deleteCount, ...items);
    this.length = this._data.length;
    // TODO: ref new, unref old
    return removed;
  }
  /** to be called when a line gets removed */
  release(): void {
    // TODO: unref here
  }
}
