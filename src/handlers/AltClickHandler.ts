/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ITerminal } from '../Types';
import { IBufferLine, ICircularList } from 'common/Types';
import { C0 } from 'common/data/EscapeSequences';
import { IMouseService } from 'browser/services/Services';
import { IBufferService } from 'common/services/Services';

const enum Direction {
  UP = 'A',
  DOWN = 'B',
  RIGHT = 'C',
  LEFT = 'D'
}

export class AltClickHandler {
  private _startRow: number;
  private _startCol: number;
  private _endRow: number;
  private _endCol: number;
  private _lines: ICircularList<IBufferLine>;

  constructor(
    private _mouseEvent: MouseEvent,
    private _terminal: ITerminal,
    private readonly _mouseService: IMouseService
  ) {
    this._lines = this._terminal.buffer.lines;
    this._startCol = this._terminal.buffer.x;
    this._startRow = this._terminal.buffer.y;

    const coordinates = this._mouseService.getCoords(
      this._mouseEvent,
      this._terminal.element,
      this._terminal.cols,
      this._terminal.rows,
      false
    );

    if (coordinates) {
      [this._endCol, this._endRow] = coordinates.map((coordinate: number) => {
        return coordinate - 1;
      });
    }
  }

  /**
   * Writes the escape sequences of arrows to the terminal
   */
  public move(bufferService: IBufferService, applicationCursor: boolean): void {
    if (this._mouseEvent.altKey && this._endCol !== undefined && this._endRow !== undefined) {
      this._terminal.handler(this._arrowSequences(bufferService, applicationCursor));
    }
  }

  /**
   * Concatenates all the arrow sequences together.
   * Resets the starting row to an unwrapped row, moves to the requested row,
   * then moves to requested col.
   */
  private _arrowSequences(bufferService: IBufferService, applicationCursor: boolean): string {
    // The alt buffer should try to navigate between rows
    if (!bufferService.buffer.hasScrollback) {
      return this._resetStartingRow(bufferService, applicationCursor) +
        this._moveToRequestedRow(bufferService, applicationCursor) +
        this._moveToRequestedCol(bufferService, applicationCursor);
    }

    // Only move horizontally for the normal buffer
    return this._moveHorizontallyOnly(bufferService, applicationCursor);
  }

  /**
   * If the initial position of the cursor is on a row that is wrapped, move the
   * cursor up to the first row that is not wrapped to have accurate vertical
   * positioning.
   */
  private _resetStartingRow(bufferService: IBufferService, applicationCursor: boolean): string {
    if (this._moveToRequestedRow(bufferService, applicationCursor).length === 0) {
      return '';
    }
    return repeat(bufferLine(
      this._startCol, this._startRow, this._startCol,
      this._startRow - this._wrappedRowsForRow(bufferService, this._startRow), false, bufferService
    ).length, sequence(Direction.LEFT, applicationCursor));
  }

  /**
   * Using the reset starting and ending row, move to the requested row,
   * ignoring wrapped rows
   */
  private _moveToRequestedRow(bufferService: IBufferService, applicationCursor: boolean): string {
    const startRow = this._startRow - this._wrappedRowsForRow(bufferService, this._startRow);
    const endRow = this._endRow - this._wrappedRowsForRow(bufferService, this._endRow);

    const rowsToMove = Math.abs(startRow - endRow) - this._wrappedRowsCount(bufferService);

    return repeat(rowsToMove, sequence(this._verticalDirection(), applicationCursor));
  }

  /**
   * Move to the requested col on the ending row
   */
  private _moveToRequestedCol(bufferService: IBufferService, applicationCursor: boolean): string {
    let startRow;
    if (this._moveToRequestedRow(bufferService, applicationCursor).length > 0) {
      startRow = this._endRow - this._wrappedRowsForRow(bufferService, this._endRow);
    } else {
      startRow = this._startRow;
    }

    const endRow = this._endRow;
    const direction = this._horizontalDirection(bufferService, applicationCursor);

    return repeat(bufferLine(
      this._startCol, startRow, this._endCol, endRow,
      direction === Direction.RIGHT, bufferService
    ).length, sequence(direction, applicationCursor));
  }

  private _moveHorizontallyOnly(bufferService: IBufferService, applicationCursor: boolean): string {
    const direction = this._horizontalDirection(bufferService, applicationCursor);
    return repeat(Math.abs(this._startCol - this._endCol), sequence(direction, applicationCursor));
  }

  /**
   * Utility functions
   */

  /**
   * Calculates the number of wrapped rows between the unwrapped starting and
   * ending rows. These rows need to ignored since the cursor skips over them.
   */
  private _wrappedRowsCount(bufferService: IBufferService): number {
    let wrappedRows = 0;
    const startRow = this._startRow - this._wrappedRowsForRow(bufferService, this._startRow);
    const endRow = this._endRow - this._wrappedRowsForRow(bufferService, this._endRow);

    for (let i = 0; i < Math.abs(startRow - endRow); i++) {
      const direction = this._verticalDirection() === Direction.UP ? -1 : 1;

      if (this._lines.get(startRow + (direction * i)).isWrapped) {
        wrappedRows++;
      }
    }

    return wrappedRows;
  }

  /**
   * Calculates the number of wrapped rows that make up a given row.
   * @param currentRow The row to determine how many wrapped rows make it up
   */
  private _wrappedRowsForRow(bufferService: IBufferService, currentRow: number): number {
    let rowCount = 0;
    let lineWraps = bufferService.buffer.lines.get(currentRow).isWrapped;

    while (lineWraps && currentRow >= 0 && currentRow < bufferService.rows) {
      rowCount++;
      currentRow--;
      lineWraps = bufferService.buffer.lines.get(currentRow).isWrapped;
    }

    return rowCount;
  }

  /**
   * Direction determiners
   */

  /**
   * Determines if the right or left arrow is needed
   */
  private _horizontalDirection(bufferService: IBufferService, applicationCursor: boolean): Direction {
    let startRow;
    if (this._moveToRequestedRow(bufferService, applicationCursor).length > 0) {
      startRow = this._endRow - this._wrappedRowsForRow(bufferService, this._endRow);
    } else {
      startRow = this._startRow;
    }

    if ((this._startCol < this._endCol &&
      startRow <= this._endRow) || // down/right or same y/right
      (this._startCol >= this._endCol &&
      startRow < this._endRow)) {  // down/left or same y/left
      return Direction.RIGHT;
    }
    return Direction.LEFT;
  }

  /**
   * Determines if the up or down arrow is needed
   */
  private _verticalDirection(): Direction {
    if (this._startRow > this._endRow) {
      return Direction.UP;
    }
    return Direction.DOWN;
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
function bufferLine(
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
  forward: boolean,
  bufferService: IBufferService
): string {
  let currentCol = startCol;
  let currentRow = startRow;
  let bufferStr = '';

  while (currentCol !== endCol || currentRow !== endRow) {
    currentCol += forward ? 1 : -1;

    if (forward && currentCol > bufferService.cols - 1) {
      bufferStr += bufferService.buffer.translateBufferLineToString(
        currentRow, false, startCol, currentCol
      );
      currentCol = 0;
      startCol = 0;
      currentRow++;
    } else if (!forward && currentCol < 0) {
      bufferStr += bufferService.buffer.translateBufferLineToString(
        currentRow, false, 0, startCol + 1
      );
      currentCol = bufferService.cols - 1;
      startCol = currentCol;
      currentRow--;
    }
  }

  return bufferStr + bufferService.buffer.translateBufferLineToString(
    currentRow, false, startCol, currentCol
  );
}

/**
 * Constructs the escape sequence for clicking an arrow
 * @param direction The direction to move
 */
function sequence(direction: Direction, applicationCursor: boolean): string {
  const mod =  applicationCursor ? 'O' : '[';
  return C0.ESC + mod + direction;
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
