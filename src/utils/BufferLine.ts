/**
 * @license MIT
 */

// TODO: This module should be merged into a buffer or buffer line class

const LINE_DATA_CHAR_INDEX = 1;
const LINE_DATA_WIDTH_INDEX = 2;

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
export function translateBufferLineToString(line: any, trimRight: boolean, startCol: number = 0, endCol: number = null): string {
  // Get full line
  let lineString = '';
  let widthAdjustedStartCol = startCol;
  let widthAdjustedEndCol = endCol;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    lineString += char[LINE_DATA_CHAR_INDEX];
    // Adjust start and end cols for wide characters if they affect their
    // column indexes
    if (char[LINE_DATA_WIDTH_INDEX] === 0) {
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
