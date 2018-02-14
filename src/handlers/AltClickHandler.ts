/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ITerminal, ICircularList, LineData } from '../Types';
import { C0 } from '../EscapeSequences';

enum Direction {
  Up = 'A',
  Down = 'B',
  Right = 'C',
  Left = 'D'
}

export class AltClickHandler {
  private _startRow: number;
  private _startCol: number;
  private _endRow: number;
  private _endCol: number;
  private _lines: ICircularList<LineData>;

  constructor(
    private _mouseEvent: MouseEvent,
    private _terminal: ITerminal
  ) {
    this._lines = this._terminal.buffer.lines;
    this._startCol = this._terminal.buffer.x;
    this._startRow = this._terminal.buffer.y;

    [this._endCol, this._endRow] = this._terminal.mouseHelper.getCoords(
      this._mouseEvent,
      this._terminal.element,
      this._terminal.charMeasure,
      this._terminal.options.lineHeight,
      this._terminal.cols,
      this._terminal.rows,
      false
    ).map((coordinate: number) => {
      return coordinate - 1;
    });
  }

  /**
   * Writes the escape sequences of arrows to the terminal
   */
  public move(): void {
    if (this._mouseEvent.altKey) {
      this._terminal.send(this._arrowSequences());
    }
  }

  /**
   * Concatenates all the arrow sequences together.
   * Resets the starting row to an unwrapped row, moves to the requested row,
   * then moves to requested col.
   */
  private _arrowSequences(): string {
    return this._resetStartingRow() +
      this._moveToRequestedRow() +
      this._moveToRequestedCol();
  }

  /**
   * If the initial position of the cursor is on a row that is wrapped, move the
   * cursor up to the first row that is not wrapped to have accurate vertical
   * positioning.
   */
  private _resetStartingRow(): string {
    let startRow = this._endRow - this._wrappedRowsForRow(this._endRow);
    let endRow = this._endRow;

    if (this._moveToRequestedRow().length === 0) {
      return '';
    } else {
      return repeat(this._bufferLine(
        this._startCol, this._startRow, this._startCol,
        this._startRow - this._wrappedRowsForRow(this._startRow), false
      ).length, this._sequence(Direction.Left));
    }
  }

  /**
   * Using the reset starting and ending row, move to the requested row,
   * ignoring wrapped rows
   */
  private _moveToRequestedRow(): string {
    let startRow = this._startRow - this._wrappedRowsForRow(this._startRow);
    let endRow = this._endRow - this._wrappedRowsForRow(this._endRow);

    let rowsToMove = Math.abs(startRow - endRow) - this._wrappedRowsCount();

    return repeat(rowsToMove, this._sequence(this._verticalDirection()));
  }

  /**
   * Move to the requested col on the ending row
   */
  private _moveToRequestedCol(): string {
    let startRow;
    if (this._moveToRequestedRow().length > 0) {
      startRow = this._endRow - this._wrappedRowsForRow(this._endRow);
    } else {
      startRow = this._startRow;
    }

    let endRow = this._endRow;
    let direction = this._horizontalDirection();

    return repeat(this._bufferLine(
      this._startCol, startRow, this._endCol, endRow,
      direction === Direction.Right
    ).length, this._sequence(direction));
  }

  /**
   * Utility functions
   */

  /**
   * Calculates the number of wrapped rows between the unwrapped starting and
   * ending rows. These rows need to ignored since the cursor skips over them.
   */
  private _wrappedRowsCount(): number {
    let wrappedRows = 0;
    let startRow = this._startRow - this._wrappedRowsForRow(this._startRow);
    let endRow = this._endRow - this._wrappedRowsForRow(this._endRow);

    for (let i = 0; i < Math.abs(startRow - endRow); i++) {
      let direction = this._verticalDirection() === Direction.Up ? -1 : 1;

      if ((<any>this._lines.get(startRow + (direction * i))).isWrapped) {
        wrappedRows++;
      }
    }

    return wrappedRows;
  }

  /**
   * Calculates the number of wrapped rows that make up a given row.
   * @param currentRow The row to determine how many wrapped rows make it up
   */
  private _wrappedRowsForRow(currentRow: number): number {
    let rowCount = 0;
    let lineWraps = (<any>this._lines.get(currentRow)).isWrapped;

    while (lineWraps && currentRow >= 0 && currentRow < this._terminal.rows) {
      rowCount++;
      currentRow--;
      lineWraps = (<any>this._lines.get(currentRow)).isWrapped;
    }

    return rowCount;
  }

  /**
   * Direction determiners
   */

  /**
   * Determines if the right or left arrow is needed
   */
  private _horizontalDirection(): Direction {
    let startRow;
    if (this._moveToRequestedRow().length > 0) {
      startRow = this._endRow - this._wrappedRowsForRow(this._endRow);
    } else {
      startRow = this._startRow;
    }

    if ((this._startCol < this._endCol &&
      startRow <= this._endRow) || // down/right or same y/right
      (this._startCol >= this._endCol &&
      startRow < this._endRow)) {  // down/left or same y/left
      return Direction.Right;
    } else {
      return Direction.Left;
    }
  }

  /**
   * Determines if the up or down arrow is needed
   */
  private _verticalDirection(): Direction {
    if (this._startRow > this._endRow) {
      return Direction.Up;
    } else {
      return Direction.Down;
    }
  }

  /**
   * Constructs the string of chars in the buffer from a starting row and col
   * to an ending row and col
   * @param startCol The starting column position
   * @param startRow The starting row position
   * @param endCol The ending column position
   * @param endRow The ending row position
   * @param forward Direction to move
   */
  private _bufferLine(
    startCol: number,
    startRow: number,
    endCol: number,
    endRow: number,
    forward: boolean
  ): string {
    let currentCol = startCol;
    let currentRow = startRow;
    let bufferStr = '';

    while (currentCol !== endCol || currentRow !== endRow) {
      currentCol += forward ? 1 : -1;

      if (forward && currentCol > this._terminal.cols - 1) {
        bufferStr += this._terminal.buffer.translateBufferLineToString(
          currentRow, false, startCol, currentCol
        );
        currentCol = 0;
        startCol = 0;
        currentRow++;
      } else if (!forward && currentCol < 0) {
        bufferStr += this._terminal.buffer.translateBufferLineToString(
          currentRow, false, 0, startCol + 1
        );
        currentCol = this._terminal.cols - 1;
        startCol = currentCol;
        currentRow--;
      }
    }

    return bufferStr + this._terminal.buffer.translateBufferLineToString(
      currentRow, false, startCol, currentCol
    );
  }

  /**
   * Constructs the escape sequence for clicking an arrow
   * @param direction The direction to move
   */
  private _sequence(direction: Direction): string {
    const mod = this._terminal.applicationCursor ? 'O' : '[';
    return C0.ESC + mod + direction;
  }
}

/**
 * Returns a string repeated a given number of times
 * Polyfill from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/repeat
 * @param count The number of times to repeat the string
 * @param string The string that is to be repeated
 */
function repeat(count: number, str: string): string {
  count = Math.floor(count);
  let rpt = '';
  for (let i = 0; i < count; i++) {
    rpt += str;
  }
  return rpt;
}
