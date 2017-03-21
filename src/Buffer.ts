import { CircularList } from './utils/CircularList';

export class Buffer extends CircularList<any> {
  public totalLinesAtWidth(width: number): number {
    let total = 0;
    let len = this.length;
    for (let i = 0; i < len; i++) {
      total += Math.ceil(this.get(i).length / width);
    }

    return total;
  }

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
