/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { BufferLine } from './BufferLine';

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
 * @param wrappedLines The wrapped lines to evaluate.
 * @param oldCols The columns before resize.
 * @param newCols The columns after resize.
 */
export function reflowSmallerGetNewLineLengths(wrappedLines: BufferLine[], oldCols: number, newCols: number): number[] {
  const newLineLengths: number[] = [];

  const cellsNeeded = wrappedLines.map(l => l.getTrimmedLength()).reduce((p, c) => p + c);

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
    const oldTrimmedLength = wrappedLines[srcLine].getTrimmedLength();
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
