/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { BufferLine } from 'common/buffer/BufferLine';
import { CircularList } from 'common/CircularList';
import { IBufferLine } from 'common/Types';

export interface INewLayoutResult {
  layout: number[];
  countRemoved: number;
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
