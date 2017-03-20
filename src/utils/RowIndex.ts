/**
 * Stores indices of a line that can span multiple rows
 * @module xterm/utils/RowIndex
 * @license MIT
 */
export class RowIndex<T> {
  constructor (lineIndex: number, startIndex: number, endIndex: number) {
    this.lineIndex = lineIndex
    this.startIndex = startIndex
    this.endIndex = endIndex
  }
  public lineIndex: number // the index of this.lines
  public startIndex: number // The start index in this.lines[lineIndex]
  public endIndex: number // The end index in this.lines[lineIndex]
}
