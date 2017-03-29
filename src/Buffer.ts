import { CircularList } from './utils/CircularList';

export class Buffer extends CircularList<any> {
  constructor(scrollback: number, private blank: string) {
    super(scrollback);
  }

  /**
   * Faster version of Math.ceil()
   * see https://jsperf.com/math-ceil-vs-bitwise
   *
   * @param {number} n - The value to round up.
   *
   * @return {number} - The rounded value.
   *
   * @example
   *
   * let num = buffer.fastCeil(3.4); // -->  4
   */
  public fastCeil(n: number): number {
    let f = (n << 0);
    return f === n ? f : f + 1;
  }
  /**
   * Number of lines when they are wrapped to fit the terminal width
   */
  private totalLines: number;

  /**
   * Sets and returns the total number of lines when wrapped to the specified width.
   *
   * @param {number} width - The number of cols to calculate the wrap at.
   *
   * @return {number} - The number of lines when they are wrapped to fit the width
   *
   * @example
   *
   * let numLines = buffer.setTotalLinesAtWidth(80); // --> 38
   */
  public setTotalLinesAtWidth(width: number): number {
    let total = 0;
    let len = this.length;
    let i;
    for (i = 0; i < len; i++) {
      total += this.fastCeil(this.trimmedLength(this.get(i), width) / width);
    }

    this.totalLines = total;

    return total;
  }

  /**
   * Returns the totalLines value
   *
   * @return {number} - The number of lines when they are wrapped to fit the width
   *
   * @example
   *
   * let numLines = buffer.getTotalLines(); // --> 38
   */
  public getTotalLines(): number {
    return this.totalLines;
  }

  /**
   * Gets the internal line index based on a wrapped line number.
   * This can then be used to retrieve the unbroken line data using .get()
   *
   * @param {number} line - The wrapped line number to look up
   * @param {width} number - The current number of cols the terminal viewport is set to
   *
   * @return {number} - The index of the line containing the current wrapped line
   *
   * @example
   *
   * const index = buffer.getRowAtLine(3); // --> 1
   * // You can then use the index to retrieve raw line data
   * const rawLineData = buffer.get(index);
   */
  public getRowAtLine(line: number, width: number) {
    let count = 0;
    let len = this.length;
    let wrappedRowNum;
    let lineData;
    let i;
    for (i = 0; i < len; i++) {
      lineData = this.get(i);
      if (count === line) {
        return i;
      }
      wrappedRowNum = this.fastCeil(this.trimmedLength(lineData, width) / width);
      if (!wrappedRowNum) {
        wrappedRowNum = 1;
      }
      if (count + wrappedRowNum > line) {
        return i;
      }
      count += wrappedRowNum;
    }

    return i;
  }

  /**
   * Gets the wrapped line number of an internal line number
   *
   * @param {number} row - The internal line number to find the wrapped line number for
   * @param {width} number - The current number of cols the terminal viewport is set to
   *
   * @return {number} - The wrapped line number
   *
   * @example
   *
   * const index = buffer.getLineAtRow(1); // --> 3
   */
  public getLineAtRow(row: number, width: number) {
    let count = 0;
    let len = this.length;
    let lineData;
    let wrappedRowNum;
    for (let i = 0; i < len; i++) {
      lineData = this.get(i);
      if (count === row) {
        return lineData;
      }
      wrappedRowNum = this.fastCeil(this.trimmedLength(lineData, width) / width);
      if (!wrappedRowNum) {
        wrappedRowNum = 1;
      }
      if (count + wrappedRowNum > row) {
        let offset = (count + wrappedRowNum - row) - 1;
        return lineData.slice(offset * width);
      }
      count += wrappedRowNum;
    }
  }

  /**
   * Gets the length of a line with trailing whitespace stripped, down to a specified minimum length
   * Under the minimum length it will only strip default blank characters, in case they are part of
   * a coloured bg (ie vim).
   * Returns a the length of the line after whitespace has been stripped
   *
   * @param {array} line - A terminal line
   * @param {number} min - The minimum length to trim the line to
   *
   * @return {number} - The length of the trimmed terminal line
   */
  public trimmedLength(line, min) {
    let i = line.length - 1;
    for (i; i >= 0; i--) {
      if (
        (i >= min && line[i][1] !== ' ') ||
        i < min && (line[i][1] !== ' ' || line[i][0] !== this.blank)
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

    return i;
  };

  /**
   * Strips trailing whitespace from line, down to a minimum length
   * Under the minimum length it will only strip default blank characters, in case they are part of
   * a coloured bg (ie vim).
   * Returns a shallow copy of the original array.
   *
   * @param {array} line - A terminal line
   * @param {number} min - The minimum length to trim the line to
   *
   * @return {array} - The trimmed terminal line
   */
  public trimBlank(line, min) {
    return line.slice(0, this.trimmedLength(line, min));
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
  public chunkArray(chunkSize, array) {
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
   *
   * @return {array} - An array of chunks
   */
  public trimThenChunk(line, width) {
    return this.chunkArray(width, this.trimBlank(line, width));
  }
}
