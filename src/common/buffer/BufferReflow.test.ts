/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { BufferLine } from 'common/buffer/BufferLine';
import { BufferLineStringCache } from 'common/buffer/BufferLineStringCache';
import { NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE } from 'common/buffer/Constants';

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
function reflowSmallerGetNewLineLengths(wrappedLines: BufferLine[], oldCols: number, newCols: number): number[] {
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

const TEST_STRING_CACHE = new BufferLineStringCache();

describe('BufferReflow', () => {
  describe('reflowSmallerGetNewLineLengths', () => {
    it('should return correct line lengths for a small line with wide characters', () => {
      const line = new BufferLine(TEST_STRING_CACHE, 4);
      line.set(0, [0, '汉', 2, '汉'.charCodeAt(0)]);
      line.set(1, [0, '', 0, 0]);
      line.set(2, [0, '语', 2, '语'.charCodeAt(0)]);
      line.set(3, [0, '', 0, 0]);
      assert.equal(line.translateToString(true), '汉语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 4, 3), [2, 2], 'line: 汉, 语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 4, 2), [2, 2], 'line: 汉, 语');
    });
    it('should return correct line lengths for a large line with wide characters', () => {
      const line = new BufferLine(TEST_STRING_CACHE, 12);
      for (let i = 0; i < 12; i += 4) {
        line.set(i, [0, '汉', 2, '汉'.charCodeAt(0)]);
        line.set(i + 2, [0, '语', 2, '语'.charCodeAt(0)]);
      }
      for (let i = 1; i < 12; i += 2) {
        line.set(i, [0, '', 0, 0]);
        line.set(i, [0, '', 0, 0]);
      }
      assert.equal(line.translateToString(), '汉语汉语汉语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 12, 11), [10, 2], 'line: 汉语汉语汉, 语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 12, 10), [10, 2], 'line: 汉语汉语汉, 语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 12, 9), [8, 4], 'line: 汉语汉语, 汉语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 12, 8), [8, 4], 'line: 汉语汉语, 汉语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 12, 7), [6, 6], 'line: 汉语汉, 语汉语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 12, 6), [6, 6], 'line: 汉语汉, 语汉语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 12, 5), [4, 4, 4], 'line: 汉语, 汉语, 汉语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 12, 4), [4, 4, 4], 'line: 汉语, 汉语, 汉语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 12, 3), [2, 2, 2, 2, 2, 2], 'line: 汉, 语, 汉, 语, 汉, 语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 12, 2), [2, 2, 2, 2, 2, 2], 'line: 汉, 语, 汉, 语, 汉, 语');
    });
    it('should return correct line lengths for a string with wide and single characters', () => {
      const line = new BufferLine(TEST_STRING_CACHE, 6);
      line.set(0, [0, 'a', 1, 'a'.charCodeAt(0)]);
      line.set(1, [0, '汉', 2, '汉'.charCodeAt(0)]);
      line.set(2, [0, '', 0, 0]);
      line.set(3, [0, '语', 2, '语'.charCodeAt(0)]);
      line.set(4, [0, '', 0, 0]);
      line.set(5, [0, 'b', 1, 'b'.charCodeAt(0)]);
      assert.equal(line.translateToString(), 'a汉语b');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 6, 5), [5, 1], 'line: a汉语b');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 6, 4), [3, 3], 'line: a汉, 语b');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 6, 3), [3, 3], 'line: a汉, 语b');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 6, 2), [1, 2, 2, 1], 'line: a, 汉, 语, b');
    });
    it('should return correct line lengths for a wrapped line with wide and single characters', () => {
      const line1 = new BufferLine(TEST_STRING_CACHE, 6);
      line1.set(0, [0, 'a', 1, 'a'.charCodeAt(0)]);
      line1.set(1, [0, '汉', 2, '汉'.charCodeAt(0)]);
      line1.set(2, [0, '', 0, 0]);
      line1.set(3, [0, '语', 2, '语'.charCodeAt(0)]);
      line1.set(4, [0, '', 0, 0]);
      line1.set(5, [0, 'b', 1, 'b'.charCodeAt(0)]);
      const line2 = new BufferLine(TEST_STRING_CACHE, 6, undefined);
      line2.set(0, [0, 'a', 1, 'a'.charCodeAt(0)]);
      line2.set(1, [0, '汉', 2, '汉'.charCodeAt(0)]);
      line2.set(2, [0, '', 0, 0]);
      line2.set(3, [0, '语', 2, '语'.charCodeAt(0)]);
      line2.set(4, [0, '', 0, 0]);
      line2.set(5, [0, 'b', 1, 'b'.charCodeAt(0)]);
      assert.equal(line1.translateToString(), 'a汉语b');
      assert.equal(line2.translateToString(), 'a汉语b');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line1, line2], 6, 5), [5, 4, 3], 'lines: a汉语, ba汉, 语b');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line1, line2], 6, 4), [3, 4, 4, 1], 'lines: a汉, 语ba, 汉语, b');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line1, line2], 6, 3), [3, 3, 3, 3], 'lines: a汉, 语b, a汉, 语b');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line1, line2], 6, 2), [1, 2, 2, 2, 2, 2, 1], 'lines: a, 汉, 语, ba, 汉, 语, b');
    });
    it('should work on lines ending in null space', () => {
      const line = new BufferLine(TEST_STRING_CACHE, 5);
      line.set(0, [0, '汉', 2, '汉'.charCodeAt(0)]);
      line.set(1, [0, '', 0, 0]);
      line.set(2, [0, '语', 2, '语'.charCodeAt(0)]);
      line.set(3, [0, '', 0, 0]);
      line.set(4, [0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]);
      assert.equal(line.translateToString(true), '汉语');
      assert.equal(line.translateToString(false), '汉语 ');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 4, 3), [2, 2], 'line: 汉, 语');
      assert.deepEqual(reflowSmallerGetNewLineLengths([line], 4, 2), [2, 2], 'line: 汉, 语');
    });
  });
});
