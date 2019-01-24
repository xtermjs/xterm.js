/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { BufferLine } from './BufferLine';

/**
 * Determine how many lines need to be inserted at the end. This is done by finding what each
 * wrapping point will be and counting the lines needed This would be a lot simpler but in the case
 * of a line ending with a wide character, the wide character needs to be put on the following line
 * or it would be cut in half.
 * @param wrappedLines The original wrapped lines.
 * @param newCols The new column count.
 */
export function reflowSmallerGetLinesNeeded(wrappedLines: BufferLine[], oldCols: number, newCols: number): number {
  const lastLineLength = wrappedLines[wrappedLines.length - 1].getTrimmedLength();
  // const cellsNeeded = (wrappedLines.length - 1) * this._cols + lastLineLength;

  // TODO: Make faster
  const cellsNeeded = wrappedLines.map(l => l.getTrimmedLength()).reduce((p, c) => p + c);

  // Lines needed needs to take into account what the ending character of each new line is
  let linesNeeded = 0;
  let cellsAvailable = 0;
  // let currentCol = 0;

  // Use srcCol and srcLine to find the new wrapping point, use that to get the cellsAvailable and
  // linesNeeded
  let srcCol = -1;
  let srcLine = 0;
  while (cellsAvailable < cellsNeeded) {
    // if (srcLine === wrappedLines.length - 1) {
    //   cellsAvailable += newCols;
    //   linesNeeded++;
    //   break;
    // }

    srcCol += newCols;
    if (srcCol >= oldCols) {
      srcCol -= oldCols;
      srcLine++;
    }
    if (srcLine >= wrappedLines.length) {
      linesNeeded++;
      break;
    }
    const endsWithWide = wrappedLines[srcLine].getWidth(srcCol) === 2;
    if (endsWithWide) {
      srcCol--;
    }
    cellsAvailable += endsWithWide ? newCols - 1 : newCols;
    linesNeeded++;
  }

  return linesNeeded;
  // return Math.ceil(cellsNeeded / newCols);
}

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

  // TODO: Force cols = 2 to be minimum possible value, this will lock up

  const cellsNeeded = wrappedLines.map(l => l.getTrimmedLength()).reduce((p, c) => p + c);

  // Use srcCol and srcLine to find the new wrapping point, use that to get the cellsAvailable and
  // linesNeeded
  let srcCol = -1;
  let srcLine = 0;
  let cellsAvailable = 0;
  while (cellsAvailable < cellsNeeded) {
    srcCol += newCols;
    if (srcCol >= oldCols) {
      srcCol -= oldCols;
      srcLine++;
    }
    if (srcLine >= wrappedLines.length) {
      // Add the final line and exit the loop
      newLineLengths.push(cellsNeeded - cellsAvailable);
      break;
    }
    const endsWithWide = wrappedLines[srcLine].getWidth(srcCol) === 2;
    if (endsWithWide) {
      srcCol--;
    }
    const lineLength = endsWithWide ? newCols - 1 : newCols;
    newLineLengths.push(lineLength);
    cellsAvailable += lineLength;
  }

  return newLineLengths;
}
