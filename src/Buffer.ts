/**
 * @license MIT
 */

import { ITerminal } from './Interfaces';
import { CircularList } from './utils/CircularList';

/**
 * This class represents a terminal buffer (an internal state of the terminal)/
 */
export class Buffer {
  private _lines: CircularList<any>;
  private _tabs: any;

  /**
   * Create a new Buffer.
   * @param {Terminal} terminal - The terminal the buffer will belong to
   * @param {number} ydisp - The scroll position of the buffer in the viewport
   * @param {number} ybase - The scroll position of the y cursor (ybase + y = the y position within the buffer)
   * @param {number} y - The cursor's y position after ybase
   * @param {number} x - The cursor's x position after ybase
   */
  constructor(
    private terminal: ITerminal,
    public ydisp: number = 0,
    public ybase: number = 0,
    public y: number = 0,
    public x: number = 0,
  ) {
    this._lines = new CircularList(this.terminal.scrollback);
  }

  public get lines(): CircularList<any> {
    return this._lines;
  }
}
