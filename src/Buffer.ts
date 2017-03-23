import { CircularList } from './utils/CircularList';

export class Buffer extends CircularList<any> {
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
    console.log('setting lines', width);
    let total = 0;
    let len = this.length;
    let i;
    for (i = 0; i < len; i++) {
      total += Math.ceil(this.get(i).length / width);
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
      wrappedRowNum = Math.ceil(lineData.length / width);
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
      wrappedRowNum = Math.ceil(lineData.length / width);
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
}
