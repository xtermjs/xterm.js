/**
 * @license MIT
 */

import { ITerminal, IBuffer } from './Interfaces';
import { CircularList } from './utils/CircularList';
import { LineData, CharData } from './Types';

/**
 * This class represents a terminal buffer (an internal state of the terminal), where the
 * following information is stored (in high-level):
 *   - text content of this particular buffer
 *   - cursor position
 *   - scroll position
 */
export class Buffer implements IBuffer {
  private _lines: CircularList<LineData>;

  public ydisp: number;
  public ybase: number;
  public y: number;
  public x: number;
  public scrollBottom: number;
  public scrollTop: number;
  public tabs: any;
  public savedY: number;
  public savedX: number;

  /**
   * Create a new Buffer.
   * @param _terminal The terminal the Buffer will belong to.
   * @param _isAltBuffer Whether the buffer is the alt buffer.
   */
  constructor(
    private _terminal: ITerminal,
    private _isAltBuffer: boolean
  ) {
    this.clear();
  }

  public get lines(): CircularList<LineData> {
    return this._lines;
  }

  /**
   * Gets the correct buffer length based on the rows provided, the terminal's
   * scrollback and whether this is an alt buffer.
   * @param rows The terminal rows to use in the calculation.
   */
  private _getCorrectBufferLength(rows: number): number {
    // The alt buffer should never have scrollback.
    // See http://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-The-Alternate-Screen-Buffer
    if (this._isAltBuffer) {
      return rows;
    }
    return rows + this._terminal.options.scrollback;
  }

  /**
   * Fills the buffer's viewport with blank lines.
   */
  public fillViewportRows(): void {
    if (this._lines.length === 0) {
      let i = this._terminal.rows;
      while (i--) {
        this.lines.push(this._terminal.blankLine());
      }
    }
  }

  /**
   * Clears the buffer to it's initial state, discarding all previous data.
   */
  public clear(): void {
    this.ydisp = 0;
    this.ybase = 0;
    this.y = 0;
    this.x = 0;
    this.scrollBottom = 0;
    this.scrollTop = 0;
    this.tabs = {};
    this._lines = new CircularList<LineData>(this._getCorrectBufferLength(this._terminal.rows));
    this.scrollBottom = this._terminal.rows - 1;
  }

  /**
   * Resizes the buffer, adjusting its data accordingly.
   * @param newCols The new number of columns.
   * @param newRows The new number of rows.
   */
  public resize(newCols: number, newRows: number): void {
    // Don't resize the buffer if it's empty and hasn't been used yet.
    if (this._lines.length === 0) {
      return;
    }

    // Increase max length if needed before adjustments to allow space to fill
    // as required.
    const newMaxLength = this._getCorrectBufferLength(newRows);
    if (newMaxLength > this._lines.maxLength) {
      this._lines.maxLength = newMaxLength;
    }

    // Deal with columns increasing (we don't do anything when columns reduce)
    if (this._terminal.cols < newCols) {
      const ch: CharData = [this._terminal.defAttr, ' ', 1]; // does xterm use the default attr?
      for (let i = 0; i < this._lines.length; i++) {
        if (this._lines.get(i) === undefined) {
          this._lines.set(i, this._terminal.blankLine());
        }
        while (this._lines.get(i).length < newCols) {
          this._lines.get(i).push(ch);
        }
      }
    }

    // Resize rows in both directions as needed
    let addToY = 0;
    if (this._terminal.rows < newRows) {
      for (let y = this._terminal.rows; y < newRows; y++) {
        if (this._lines.length < newRows + this.ybase) {
          if (this.ybase > 0 && this._lines.length <= this.ybase + this.y + addToY + 1) {
            // There is room above the buffer and there are no empty elements below the line,
            // scroll up
            this.ybase--;
            addToY++;
            if (this.ydisp > 0) {
              // Viewport is at the top of the buffer, must increase downwards
              this.ydisp--;
            }
          } else {
            // Add a blank line if there is no buffer left at the top to scroll to, or if there
            // are blank lines after the cursor
            this._lines.push(this._terminal.blankLine());
          }
        }
      }
    } else { // (this._terminal.rows >= newRows)
      for (let y = this._terminal.rows; y > newRows; y--) {
        if (this._lines.length > newRows + this.ybase) {
          if (this._lines.length > this.ybase + this.y + 1) {
            // The line is a blank line below the cursor, remove it
            this._lines.pop();
          } else {
            // The line is the cursor, scroll down
            this.ybase++;
            this.ydisp++;
          }
        }
      }
    }

    // Reduce max length if needed after adjustments, this is done after as it
    // would otherwise cut data from the bottom of the buffer.
    if (newMaxLength < this._lines.maxLength) {
      // Trim from the top of the buffer and adjust ybase and ydisp.
      const amountToTrim = this._lines.length - newMaxLength;
      if (amountToTrim > 0) {
        this._lines.trimStart(amountToTrim);
        this.ybase = Math.max(this.ybase - amountToTrim, 0);
        this.ydisp = Math.max(this.ydisp - amountToTrim, 0);
      }
      this._lines.maxLength = newMaxLength;
    }

    // Make sure that the cursor stays on screen
    if (this.y >= newRows) {
      this.y = newRows - 1;
    }
    if (addToY) {
      this.y += addToY;
    }

    if (this.x >= newCols) {
      this.x = newCols - 1;
    }

    this.scrollTop = 0;
    this.scrollBottom = newRows - 1;
  }
}
