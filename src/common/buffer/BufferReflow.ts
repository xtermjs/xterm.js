/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { BufferLine } from './BufferLine';
import { CircularList } from '../CircularList';
import { IBufferLine, ICellData } from './Types';

export interface INewLayoutResult {
  layout: number[];
  countRemoved: number;
}

export function reflowLine(wrappedLines: BufferLine[], newCols: number): BufferLine[] {
  const newLines: BufferLine[] = [];
  let startCol = 0;
  let curRow = 1;
  let curLine = wrappedLines[0];
  const logical = curLine.logical();
  for (;;) {
    const endCol = logical.charStart(startCol + newCols);
    if (endCol >= logical.length) {
      curLine.nextBufferLine = undefined;
      curLine.startColumn = startCol;
      break;
    }
    let newLine;
    if (curRow < wrappedLines.length) {
      newLine = wrappedLines[curRow];
      newLine.length = newCols;
    } else {
      newLine = new BufferLine(curLine._stringCache, newCols, logical);
      newLines.push(newLine);
    }
    curRow++;
    newLine.startColumn = endCol;
    startCol = endCol;
    curLine.nextBufferLine = newLine;
    curLine = newLine;
  }
  if (curRow < wrappedLines.length) {
    wrappedLines.length = curRow;
  }
  return newLines;
}

/**
 * Evaluates and returns indexes to be removed after a reflow larger occurs. Lines will be removed
 * when a wrapped line unwraps.
 * @param lines The buffer lines.
 * @param oldCols The columns before resize
 * @param newCols The columns after resize.
 * @param bufferAbsoluteY The absolute y position of the cursor (baseY + cursorY).
 * @param nullCell The cell data to use when filling in empty cells.
 * @param reflowCursorLine Whether to reflow the line containing the cursor.
 */
export function reflowLargerGetLinesToRemove(lines: CircularList<IBufferLine>, oldCols: number, newCols: number, bufferAbsoluteY: number, nullCell: ICellData, reflowCursorLine: boolean): number[] {
  // Gather all BufferLines that need to be removed from the Buffer here so that they can be
  // batched up and only committed once
  const toRemove: number[] = [];

  for (let y = 0; y < lines.length - 1; y++) {
    // Check if this row is wrapped
    let i = y;
    let nextLine = lines.get(++i) as BufferLine;
    if (!nextLine.isWrapped) {
      continue;
    }

    // Check how many lines it's wrapped for
    const wrappedLines: BufferLine[] = [lines.get(y) as BufferLine];
    while (i < lines.length && nextLine.isWrapped) {
      wrappedLines.push(nextLine);
      nextLine = lines.get(++i) as BufferLine;
    }

    if (!reflowCursorLine) {
      // If these lines contain the cursor don't touch them, the program will handle fixing up
      // wrapped lines with the cursor
      if (bufferAbsoluteY >= y && bufferAbsoluteY < i) {
        y += wrappedLines.length - 1;
        continue;
      }
    }
    const oldWrapped = wrappedLines.length;
    reflowLine(wrappedLines, newCols);

    // Work backwards and remove any rows at the end that only contain null cells
    const countToRemove = oldWrapped - wrappedLines.length;
    if (countToRemove > 0) {
      toRemove.push(y + oldWrapped - countToRemove); // index
      toRemove.push(countToRemove);
    }

    y += oldWrapped - 1;
  }
  return toRemove;
}

/**
 * Creates and return the new layout for lines given an array of indexes to be removed.
 * @param lines The buffer lines.
 * @param toRemove The indexes to remove.
 */
export function reflowLargerCreateNewLayout(lines: CircularList<IBufferLine>, toRemove: number[]): INewLayoutResult {
  const layout: number[] = [];
  // First iterate through the list and get the actual indexes to use for rows
  let nextToRemoveIndex = 0;
  let nextToRemoveStart = toRemove[nextToRemoveIndex];
  let countRemovedSoFar = 0;
  for (let i = 0; i < lines.length; i++) {
    if (nextToRemoveStart === i) {
      const countToRemove = toRemove[++nextToRemoveIndex];

      // Tell markers that there was a deletion
      lines.onDeleteEmitter.fire({
        index: i - countRemovedSoFar,
        amount: countToRemove
      });

      i += countToRemove - 1;
      countRemovedSoFar += countToRemove;
      nextToRemoveStart = toRemove[++nextToRemoveIndex];
    } else {
      layout.push(i);
    }
  }
  return {
    layout,
    countRemoved: countRemovedSoFar
  };
}

/**
 * Applies a new layout to the buffer. This essentially does the same as many splice calls but it's
 * done all at once in a single iteration through the list since splice is very expensive.
 * @param lines The buffer lines.
 * @param newLayout The new layout to apply.
 */
export function reflowLargerApplyNewLayout(lines: CircularList<IBufferLine>, newLayout: number[]): void {
  // Record original lines so they don't get overridden when we rearrange the list
  const newLayoutLines: BufferLine[] = [];
  for (let i = 0; i < newLayout.length; i++) {
    newLayoutLines.push(lines.get(newLayout[i]) as BufferLine);
  }

  // Rearrange the list
  for (let i = 0; i < newLayoutLines.length; i++) {
    lines.set(i, newLayoutLines[i]);
  }
  lines.length = newLayout.length;
}

export function getWrappedLineTrimmedLength(lines: BufferLine[], i: number, cols: number): number {
  // If this is the last row in the wrapped line, get the actual trimmed length
  if (i === lines.length - 1) {
    return lines[i].getTrimmedLength();
  }
  // Detect whether the following line starts with a wide character and the end of the current line
  // is null, if so then we can be pretty sure the null character should be excluded from the line
  // length]
  const endsInNull = !(lines[i].hasContent(cols - 1)) && lines[i].getWidth(cols - 1) === 1;
  const followingLineStartsWithWide = lines[i + 1].getWidth(0) === 2;
  if (endsInNull && followingLineStartsWithWide) {
    return cols - 1;
  }
  return cols;
}
