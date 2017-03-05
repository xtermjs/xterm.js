/**
 * LineWrap utilities module with methods that are used for supporting line wrap
 * @module xterm/utils/Generic
 * @license MIT
 */

/**
 * Strips trailing whitespace from line, down to a minimum length
 * Under the minimum length it will only strip default blank characters, in case they are part of
 * a coloured bg (ie vim).
 * Returns a shallow copy of the original array.
 *
 * @param {array} line - A terminal line
 * @param {number} min - The minimum length to trim the line to
 * @param {number} blank - The code for a default blank character
 *
 * @return {array} - The trimmed terminal line
 */
export const trimBlank = (line, min, blank) => {
  let i = line.length - 1;
  for (i; i >= 0; i--) {
    if (
      (i >= min && line[i][1] !== ' ') ||
      i < min && (line[i][1] !== ' ' || line[i][0] !== blank)
    ) {
      break;
    }
  }

  if (i < min) {
    i = min;
  } else {
    // 2 extra blank chars allows for cursor and ensures at least one element is in array (in case
    // of intentional blank rows)
    i += 2;
  }

  return line.slice(0, i);
};

/**
 * Splits an array into N sized chunks.
 *
 * @param {number} chunkSize - the size of each chunk
 * @param {array} array - the array to chunk
 *
 * @return {array} - An array of chunks
 *
 * @example
 * let array = [1, 2, 3, 4, 5, 6, 7];
 * chunkArray(3, array); //--> [[1, 2, 3], [4, 5, 6], [7]]
 */
export const chunkArray = (chunkSize, array) => {
  let temparray = [];
  let i = 0;
  let j = array.length;
  for (i; i < j; i += chunkSize) {
    temparray.push(array.slice(i, i + chunkSize));
  }

  return temparray;
};

/**
 * Utility function for trimming and then chunking a line.
 *
 * @param {array} line - A terminal line
 * @param {number} width - the size of each chunk
 * @param {number} blank - The code for a default blank character
 *
 * @return {array} - An array of chunks
 */
export const trimThenChunk = (line, width, blank) => {
  return chunkArray(width, trimBlank(line, width, blank));
};

