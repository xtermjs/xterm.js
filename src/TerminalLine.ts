/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { CharData } from './Types';

export class TerminalLine {
  private _data: CharData[];
  public isWrapped = false;
  length: number;
  constructor() {
    this._data = [];
    this.length = this._data.length;

    // for debugging purpose:
    // throw Error when something tries to do number index access
    // TODO: remove when done with transition
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
