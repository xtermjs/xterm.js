/**
 * @license MIT
 */

import { ITerminal } from './Interfaces';
import { CircularList } from './utils/CircularList';

/**
 * This class represents a terminal buffer (an internal state of the terminal)/
 */
export class Buffer {
  public lines: CircularList<[string, number, string]>;

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
    public scrollBottom: number = 0,
    public scrollTop: number = 0,
    public tabs: any = {},
  ) {
    this.lines = new CircularList<[string, number, string]>(this.terminal.scrollback);
    this.scrollBottom = this.terminal.rows - 1;
  }
}
