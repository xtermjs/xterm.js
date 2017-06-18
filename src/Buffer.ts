/**
 * @license MIT
 */

import { ITerminal } from './Interfaces';
import { CircularList } from './utils/CircularList';

export class Buffer {
  private _lines: CircularList<any>;
  private _ybase: number;
  private _ydisp: number;
  private _y: number;
  private _x: number;
  private _tabs: any;

  constructor(private terminal: ITerminal) {
    this._lines = new CircularList(this.terminal.scrollback);
  }

  public get lines(): CircularList {
    return this._lines;
  }
}
