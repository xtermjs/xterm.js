/**
 * Stores multiple line indices to allow interpreting them as line wraps
 * @module xterm/utils/RowIndex
 * @license MIT
 */

import { RowIndex } from '../utils/RowIndex'
import { CircularList } from '../utils/CircularList.js';

interface IRowIndex {
  startIndex: number
  endIndex: number
  index: number
}
export class LineWrap<T> {
  private _rowIndices
  constructor(maxLength: number) {
    this._rowIndices = new CircularList(maxLength)
  }
  public getRowIndex(index: number): any {
    const lineContainingRowIndex = this._rowIndices.filter(r => {
      return (
        index >= r.startIndex &&
        index <= r.endIndex
      )
    })[0]
    return lineContainingRowIndex;
  }
  public addRowToLine(index: number): any {
    const lineContainingRowIndex = this._rowIndices.filter(r => {
      return index >= r.startIndex && index <= r.endIndex
    })[0]
    lineContainingRowIndex.endIndex++
    for (let i = lineContainingRowIndex.lineIndex + 1; i < this._rowIndices.length; i++) {
      const lineContainingRowIndex = this._rowIndices.filter(r => {
        return r.lineIndex === i
      })[0] // TODO: remove duplicate logic
      if (lineContainingRowIndex) {
        lineContainingRowIndex.startIndex++
        lineContainingRowIndex.endIndex++
      }
    }
  }
  public getRow(index: number): any {
    return this._rowIndices[index]
  }
  public relativeCharPosition(charIndex: number, lineIndex: number, width: number): any {
    const lineStats = this.getRowIndex(lineIndex)
    const charIndexDifference = (lineIndex - lineStats.startIndex) * width + charIndex
    return charIndexDifference
  }
  public pop(): any {
    return this._rowIndices.pop()
  }
  public push(value: T): void {
    const lineIndex = this._rowIndices.length
      ? this._rowIndices.get(this._rowIndices.length - 1).lineIndex + 1
      : 0
    const startIndex = this._rowIndices.length
      ? this._rowIndices.get(this._rowIndices.length - 1).endIndex + 1
      : 0
    const endIndex = startIndex
    // TODO: wrap according to width
    this._rowIndices.push({lineIndex, startIndex, endIndex})
  }
  public changeLineLength (lines: any, length: number) {
    let prevLine
    for (let i = 0; i < this._rowIndices.length; i += 1) {
      let lineStats = this._rowIndices.get(i)
      const line = lines.get(lineStats.lineIndex)
      if (line) {
        const lineWithoutTrailingSpaces = line
        .map(c => c[1])
        .join('')
        .replace(/\s\s+$/, '') // TODO: fix this
        const lineLength = lineWithoutTrailingSpaces.length
        const newRowCountInLine = Math.ceil(lineLength / length) > 0
          ? Math.ceil(lineLength / length)
          : 1
        const lineIndex = lineStats.lineIndex
        const startIndex = prevLine ? prevLine.endIndex + 1 : lineStats.startIndex
        const endIndex = startIndex + newRowCountInLine - 1
        lineStats.lineIndex = lineIndex
        lineStats.startIndex = startIndex
        lineStats.endIndex = endIndex
        prevLine = lineStats
      } else {
        const lineIndex = lineStats.lineIndex
        const startIndex = prevLine ? prevLine.endIndex + 1 : lineStats.startIndex
        const endIndex = startIndex + (lineStats.endIndex - lineStats.startIndex)
        lineStats.lineIndex = lineIndex
        lineStats.startIndex = startIndex
        lineStats.endIndex = endIndex
        prevLine = lineStats
      }
    }
  }
  public get rowCount(): number {
    let count = 0
    for (let i = 0; i < this._rowIndices.length; i++) {
      const lineStats = this._rowIndices.get(i)
      const numRows = lineStats.endIndex - lineStats.startIndex + 1
      count += numRows
    }
    return count
  }
  public lineIndex: number // the index of this.lines
  public startIndex: number // The start index in this.lines[lineIndex]
  public endIndex: number // The end index in this.lines[lineIndex]
}
