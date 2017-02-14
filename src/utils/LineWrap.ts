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
    this._rowIndices = []
    for (let i = 0; i <= maxLength; i += 1) {
      this._rowIndices[i] = {lineIndex: i, startIndex: i, endIndex: i}
    }
  }
  public getLines (lines: any): any { // TODO: rmeove this debug method
    return lines.lines.filter((line, ind) => ind < 36).map((l, ind) => `${ind}:` + l.map(c => c[1]).join('')).join('\n')
  }
  public printLineIndices (lines, width) { // TODO: remove this debug method
    console.log('printing line indices')
    console.log(
      this._rowIndices
      .filter(r => r.lineIndex < 50)
      .map(r => {
        const line = lines.get(r.lineIndex)
        if (line) {
          const fullLine = line.map(c => c[1])
          const stringifiedLines = Array.apply(null, Array(r.endIndex - r.startIndex + 1))
          .map((q, ind) => {
            const startIndexInLine = ind * width
            const endIndexInLine = startIndexInLine + width
            return fullLine.slice(startIndexInLine, endIndexInLine).join('')
          })
          return `${r.lineIndex}, ${r.startIndex}, ${r.endIndex}, ${fullLine.join('')}, \n ${stringifiedLines.join('|\n')}`
        }
      })
      .filter(t => t)
      .join('\n')
    )
  }
  public printLines (lines: any): any { // TODO: rmeove this debug method
    console.log('lines:', lines.lines.filter((line, ind) => ind < 100).map((l, ind) => `${ind}:` + l.map(c => c[1]).join('')).join('\n'))
  }
  public getRowIndex(index: number): any {
    const lineContainingRowIndex = this._rowIndices.filter(r => {
      return (
        r.startIndex <= index &&
        r.endIndex >= index
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
  public push(value: T): void { // TODO: fix this
//    const lineIndex = this._rowIndices.length
//      ? this._rowIndices[this._rowIndices.length - 1].lineIndex + 1
//      : 0
//    const startIndex = this._rowIndices.length
//      ? this._rowIndices[this._rowIndices.length - 1].endIndex + 1
//      : 0
//    const endIndex = startIndex
//    this._rowIndices.push({lineIndex, startIndex, endIndex})
  }
  public changeLineLength (lines: any, length: number) {
    this._rowIndices = this._rowIndices.reduce((memo, lineStats) => {
      const prevLine = memo.length > 0 ? memo[memo.length - 1] : false
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
        memo.push({lineIndex, startIndex, endIndex})
      } else {
        const lineIndex = lineStats.lineIndex
        const startIndex = prevLine ? prevLine.endIndex + 1 : lineStats.startIndex
        const endIndex = startIndex + (lineStats.endIndex - lineStats.startIndex)
        memo.push({lineIndex, startIndex, endIndex})
      }
      return memo
    }, [])
  }
  public get rowCount(): number {
    let count = 0
    for (let i = 0; i < this._rowIndices.length; i++) {
      const lineStats = this._rowIndices[i]
      const numRows = lineStats.endIndex - lineStats.startIndex + 1
      count += numRows
    }
    return count
  }
  public lineIndex: number // the index of this.lines
  public startIndex: number // The start index in this.lines[lineIndex]
  public endIndex: number // The end index in this.lines[lineIndex]
}
