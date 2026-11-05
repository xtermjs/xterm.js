/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { C0 } from '../../common/data/EscapeSequences';
import { IBufferService } from '../../common/services/Services';

const enum Direction {
  UP = 'A',
  DOWN = 'B',
  RIGHT = 'C',
  LEFT = 'D'
}

/**
 * Concatenates all the arrow sequences together.
 * Resets the starting row to an unwrapped row, moves to the requested row,
 * then moves to requested col.
 */
export function moveToCellSequence(targetX: number, targetY: number, bufferService: IBufferService, applicationCursor: boolean): string {
  const startX = bufferService.buffer.x;
  const startY = bufferService.buffer.y;

  // A click on the trailing cell of a wide character targets the character
  // itself, the same as clicking on its leading cell
  const targetLine = bufferService.buffer.lines.get(bufferService.buffer.ybase + targetY);
  if (targetX > 0 && targetX < bufferService.cols && targetLine?.getWidth(targetX) === 0) {
    targetX--;
  }

  // The alt buffer should try to navigate between rows
  if (!bufferService.buffer.hasScrollback) {
    return resetStartingRow(startX, startY, targetX, targetY, bufferService, applicationCursor) +
      moveToRequestedRow(startY, targetY, bufferService, applicationCursor) +
      moveToRequestedCol(startX, startY, targetX, targetY, bufferService, applicationCursor);
  }

  // Only move horizontally for the normal buffer, wrapping around entire rows
  // when the row differs
  let direction;
  if (startY === targetY) {
    direction = startX > targetX ? Direction.LEFT : Direction.RIGHT;
  } else {
    direction = startY > targetY ? Direction.LEFT : Direction.RIGHT;
  }
  return repeat(charsBetween(startX, startY, targetX, targetY, bufferService), sequence(direction, applicationCursor));
}

/**
 * If the initial position of the cursor is on a row that is wrapped, move the
 * cursor up to the first row that is not wrapped to have accurate vertical
 * positioning.
 */
function resetStartingRow(startX: number, startY: number, targetX: number, targetY: number, bufferService: IBufferService, applicationCursor: boolean): string {
  if (moveToRequestedRow(startY, targetY, bufferService, applicationCursor).length === 0) {
    return '';
  }
  return repeat(charsBetween(
    startX, startY, startX,
    startY - wrappedRowsForRow(startY, bufferService), bufferService
  ), sequence(Direction.LEFT, applicationCursor));
}

/**
 * Using the reset starting and ending row, move to the requested row,
 * ignoring wrapped rows
 */
function moveToRequestedRow(startY: number, targetY: number, bufferService: IBufferService, applicationCursor: boolean): string {
  const startRow = startY - wrappedRowsForRow(startY, bufferService);
  const endRow = targetY - wrappedRowsForRow(targetY, bufferService);

  const rowsToMove = Math.abs(startRow - endRow) - wrappedRowsCount(startY, targetY, bufferService);

  return repeat(rowsToMove, sequence(verticalDirection(startY, targetY), applicationCursor));
}

/**
 * Move to the requested col on the ending row
 */
function moveToRequestedCol(startX: number, startY: number, targetX: number, targetY: number, bufferService: IBufferService, applicationCursor: boolean): string {
  let startRow;
  if (moveToRequestedRow(startY, targetY, bufferService, applicationCursor).length > 0) {
    startRow = targetY - wrappedRowsForRow(targetY, bufferService);
  } else {
    startRow = startY;
  }

  const endRow = targetY;
  const direction = horizontalDirection(startX, startY, targetX, targetY, bufferService, applicationCursor);

  return repeat(charsBetween(
    startX, startRow, targetX, endRow, bufferService
  ), sequence(direction, applicationCursor));
}

/**
 * Utility functions
 */

/**
 * Calculates the number of wrapped rows between the unwrapped starting and
 * ending rows. These rows need to ignored since the cursor skips over them.
 */
function wrappedRowsCount(startY: number, targetY: number, bufferService: IBufferService): number {
  let wrappedRows = 0;
  const startRow = startY - wrappedRowsForRow(startY, bufferService);
  const endRow = targetY - wrappedRowsForRow(targetY, bufferService);

  for (let i = 0; i < Math.abs(startRow - endRow); i++) {
    const direction = verticalDirection(startY, targetY) === Direction.UP ? -1 : 1;
    const line = bufferService.buffer.lines.get(startRow + (direction * i));
    if (line?.isWrapped) {
      wrappedRows++;
    }
  }

  return wrappedRows;
}

/**
 * Calculates the number of wrapped rows that make up a given row.
 * @param currentRow The row to determine how many wrapped rows make it up
 */
function wrappedRowsForRow(currentRow: number, bufferService: IBufferService): number {
  let rowCount = 0;
  let line = bufferService.buffer.lines.get(currentRow);
  let lineWraps = line?.isWrapped;

  while (lineWraps && currentRow >= 0 && currentRow < bufferService.rows) {
    rowCount++;
    line = bufferService.buffer.lines.get(--currentRow);
    lineWraps = line?.isWrapped;
  }

  return rowCount;
}

/**
 * Direction determiners
 */

/**
 * Determines if the right or left arrow is needed
 */
function horizontalDirection(startX: number, startY: number, targetX: number, targetY: number, bufferService: IBufferService, applicationCursor: boolean): Direction {
  let startRow;
  if (moveToRequestedRow(startY, targetY, bufferService, applicationCursor).length > 0) {
    startRow = targetY - wrappedRowsForRow(targetY, bufferService);
  } else {
    startRow = startY;
  }

  if ((startX < targetX &&
    startRow <= targetY) || // down/right or same y/right
    (startX >= targetX &&
    startRow < targetY)) {  // down/left or same y/left
    return Direction.RIGHT;
  }
  return Direction.LEFT;
}

/**
 * Determines if the up or down arrow is needed
 */
function verticalDirection(startY: number, targetY: number): Direction {
  return startY > targetY ? Direction.UP : Direction.DOWN;
}

/**
 * Counts the characters between a starting row and col and an ending row and
 * col, walking the buffer cells in between in either direction. This is the
 * number of arrow key presses a line editor needs to move between the two
 * positions: a wide character occupies 2 cells but is moved over with a single
 * key press, so its width 0 trailing cell is not counted, and neither is the
 * unused last cell of a row that a wide character did not fit in before
 * wrapping to the next row.
 * @param startCol The starting column position
 * @param startRow The starting row position
 * @param endCol The ending column position
 * @param endRow The ending row position
 */
function charsBetween(
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
  bufferService: IBufferService
): number {
  const cols = bufferService.cols;
  const start = Math.min(startRow * cols + startCol, endRow * cols + endCol);
  const end = Math.max(startRow * cols + startCol, endRow * cols + endCol);
  let count = 0;

  for (let i = start; i < end; i++) {
    const col = i % cols;
    const row = bufferService.buffer.ybase + Math.floor(i / cols);
    const line = bufferService.buffer.lines.get(row);
    if (!line) {
      count++;
      continue;
    }
    if (line.getWidth(col) === 0) {
      continue;
    }
    if (col === cols - 1 && !line.hasContent(col)) {
      const nextLine = bufferService.buffer.lines.get(row + 1);
      if (nextLine?.isWrapped && nextLine.getWidth(0) === 2) {
        continue;
      }
    }
    count++;
  }

  return count;
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
 * @param str The string that is to be repeated
 */
function repeat(count: number, str: string): string {
  count = Math.floor(count);
  let rpt = '';
  for (let i = 0; i < count; i++) {
    rpt += str;
  }
  return rpt;
}
