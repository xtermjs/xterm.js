/**
 * @license MIT
 */

import { ITerminal, IBuffer } from './Interfaces';
import { CircularList } from './utils/CircularList';
import { LineData } from './Types';
import { CharAttributes } from './CharAttributes';

export const CHAR_DATA_CHAR_INDEX = 0;
export const CHAR_DATA_WIDTH_INDEX = 1;

/**
 * This class represents a terminal buffer (an internal state of the terminal), where the
 * following information is stored (in high-level):
 *   - text content of this particular buffer
 *   - cursor position
 *   - scroll position
 */
export class Buffer implements IBuffer {
  public lines: CircularList<LineData>;
  public charAttributes: CharAttributes[];

  private _currentCharAttributes: CharAttributes;
  // linesIndexOffset usage should be encapsulated
  private _linesIndexOffset: number;

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
    this.lines = new CircularList<LineData>(this.terminal.scrollback);
    this.charAttributes = [];
    this._linesIndexOffset = 0;
    this.scrollBottom = this.terminal.rows - 1;

    // TODO: Listen to line's trim and adjust char attributes
    this.lines.on('trim', (amount: number) => this._onTrim(amount));
  }

  /**
   * Starts a new character attributes at the cursor.
   */
  public startCharAttributes(flags: number, fgColor: number, bgColor: number): void {
    // TODO: Move current* variables into the buffer?
    this._currentCharAttributes = new CharAttributes(this.x, this.ybase + this.y + this._linesIndexOffset, null, null, [flags, fgColor, bgColor]);
    this.charAttributes.push(this._currentCharAttributes);
  }

  /**
   * Finishes the current character attributes at the cursor. Do nothing if
   * there is not a current character attributes.
   */
  public finishCharAttributes(): void {
    if (!this._currentCharAttributes) {
      return;
    }
    this._currentCharAttributes.x2 = this.x;
    this._currentCharAttributes.y2 = this._linesIndexOffset + this.ybase + this.y;
    this._currentCharAttributes = null;
  }

  private _onTrim(amount: number): void {
    // Trim the top of charAttributes to ensure it never points at trimmed rows
    this._linesIndexOffset += amount;
    while (this.charAttributes.length > 0 && this.charAttributes[0].y1 < this._linesIndexOffset) {
      this.charAttributes.shift();
    }
  }

  /**
   * Translates a buffer line to a string, with optional start and end columns.
   * Wide characters will count as two columns in the resulting string. This
   * function is useful for getting the actual text underneath the raw selection
   * position.
   * @param line The line being translated.
   * @param trimRight Whether to trim whitespace to the right.
   * @param startCol The column to start at.
   * @param endCol The column to end at.
   */
  public translateBufferLineToString(lineIndex: number, trimRight: boolean, startCol: number = 0, endCol: number = null): string {
    // Get full line
    let lineString = '';
    let widthAdjustedStartCol = startCol;
    let widthAdjustedEndCol = endCol;
    const line = this.lines.get(lineIndex);
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      lineString += char[CHAR_DATA_CHAR_INDEX];
      // Adjust start and end cols for wide characters if they affect their
      // column indexes
      if (char[CHAR_DATA_WIDTH_INDEX] === 0) {
        if (startCol >= i) {
          widthAdjustedStartCol--;
        }
        if (endCol >= i) {
          widthAdjustedEndCol--;
        }
      }
    }

    // Calculate the final end col by trimming whitespace on the right of the
    // line if needed.
    let finalEndCol = widthAdjustedEndCol || line.length;
    if (trimRight) {
      const rightWhitespaceIndex = lineString.search(/\s+$/);
      if (rightWhitespaceIndex !== -1) {
        finalEndCol = Math.min(finalEndCol, rightWhitespaceIndex);
      }
      // Return the empty string if only trimmed whitespace is selected
      if (finalEndCol <= widthAdjustedStartCol) {
        return '';
      }
    }

    return lineString.substring(widthAdjustedStartCol, finalEndCol);
  }
}
