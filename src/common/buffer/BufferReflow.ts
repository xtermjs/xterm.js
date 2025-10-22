/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { BufferLine } from 'common/buffer/BufferLine';
import { CircularList } from 'common/CircularList';
import { IBufferLine, ICellData } from 'common/Types';

/**
 * Gets the new line lengths for a given wrapped line. The purpose of this function it to pre-
 * compute the wrapping points since wide characters may need to be wrapped onto the following line.
 * This function will return an array of numbers of where each line wraps to, the resulting array
 * will only contain the values `newCols` (when the line does not end with a wide character) and
 * `newCols - 1` (when the line does end with a wide character), except for the last value which
 * will contain the remaining items to fill the line.
 *
 * Calling this with a `newCols` value of `1` will lock up.
 *
 * This function is now only used for testing.
 *
 * @param wrappedLines The wrapped lines to evaluate.
 * @param oldCols The columns before resize.
 * @param newCols The columns after resize.
 */
export function reflowSmallerGetNewLineLengths(wrappedLines: BufferLine[], oldCols: number, newCols: number): number[] {
  const newLineLengths: number[] = [];
  const cellsNeeded = wrappedLines.map((l, i) => getWrappedLineTrimmedLength(wrappedLines, i, oldCols)).reduce((p, c) => p + c);

  // Use srcCol and srcLine to find the new wrapping point, use that to get the cellsAvailable and
  // linesNeeded
  let srcCol = 0;
  let srcLine = 0;
  let cellsAvailable = 0;
  while (cellsAvailable < cellsNeeded) {
    if (cellsNeeded - cellsAvailable < newCols) {
      // Add the final line and exit the loop
      newLineLengths.push(cellsNeeded - cellsAvailable);
      break;
    }
    srcCol += newCols;
    const oldTrimmedLength = getWrappedLineTrimmedLength(wrappedLines, srcLine, oldCols);
    if (srcCol > oldTrimmedLength) {
      srcCol -= oldTrimmedLength;
      srcLine++;
    }
    const endsWithWide = wrappedLines[srcLine].getWidth(srcCol - 1) === 2;
    if (endsWithWide) {
      srcCol--;
    }
    const lineLength = endsWithWide ? newCols - 1 : newCols;
    newLineLengths.push(lineLength);
    cellsAvailable += lineLength;
  }

  return newLineLengths;
}

function getWrappedLineTrimmedLength(lines: BufferLine[], i: number, cols: number): number {
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
