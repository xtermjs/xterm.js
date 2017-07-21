/**
 * @license MIT
 */

import { ITerminal } from './Interfaces';
import { CircularList } from './utils/CircularList';

/**
 * This class represents a terminal buffer (an internal state of the terminal), where the
 * following information is stored (in high-level):
 *   - text content of this particular buffer
 *   - cursor position
 *   - scroll position
 */
export class Buffer {
  public lines: CircularList<[number, string, number][]>;

  /**
   * Create a new Buffer.
   * @param {Terminal} terminal - The terminal the Buffer will belong to
   * @param {number} ydisp - The scroll position of the Buffer in the viewport
   * @param {number} ybase - The scroll position of the y cursor (ybase + y = the y position within the Buffer)
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
    this.reset(); // todo ensure rows...
  }

  /**
   * Reset buffer to initial state.
   */
  public reset(): void {
      this.ydisp = 0;
      this.ybase = 0;
      this.y = 0;
      this.x = 0;
      this.scrollBottom = this.terminal.rows - 1;
      this.tabs = {};

      this.lines = new CircularList<[number, string, number][]>(this.terminal.scrollback);
      if (this.lines.length === 0) {
        let i = this.terminal.rows;
        while (i--) {
          this.lines.push(this.terminal.blankLine());
        }
      }
  }
}
