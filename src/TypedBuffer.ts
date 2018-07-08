import { StringStorage } from "./StringStorage";

const CELL_DATA_WIDTH = 2;
const CELL_ATTR = 0;
const CELL_DATA = 1;

const enum ResizeMode {
  // xterm mode
  // shrinking will delete content
  DESTRUCTIVE = 0,
  // current xterm.js mode
  // shrinking will not delete the cutted content
  // (hard to do with dense array)
  PRESERVING = 1,
  // to be supported
  // (easier with a dense array)
  REFLOWING = 2
}

/**
 * whole buffer in one typed array.
 * TODO:
 *    - char/line inserts and deletes
 *    - resizing
 */
export class TerminalBuffer {
  public data: Int32Array | number[];
  private _lineWraps: Uint32Array | number[];
  // private _lineLengths: Uint32Array | number[];
  private _startIndex: number;
  constructor(
    public cols: number,
    public rows: number,
    private _cs: StringStorage
  ) {
    if (typeof Int16Array === 'undefined') {
      this.data = [];
      const size = CELL_DATA_WIDTH * cols * rows;
      for (let i = 0; i < size; ++i) this.data.push(0);
      this._lineWraps = [];
      const wrapSize = (rows >> 5) + 1;
      for (let i = 0; i < wrapSize ; ++i) this._lineWraps.push(0);
      // this._lineLengths = [];
      // const lengthSize = (rows >> 1) + 1
      // for (let i = 0; i < lengthSize; ++i) this._lineLengths.push(0);
    } else {
      this.data = new Int32Array(CELL_DATA_WIDTH * cols * rows);
      this._lineWraps = new Uint32Array((rows >> 5) + 1);
      // this._lineLengths = new Uint32Array((rows >> 1) + 1);
    }
    this._startIndex = 0;
  }
  public reset(attr: number, data: number): void {
    this._startIndex = 0;
    // TODO
  }
  public advanceRowIndex(count: number): number {
    // FIXME: handle this inside the class
    this._startIndex = (this._startIndex + count) % this.rows;
    return this._startIndex;
  }
  public getRealRowIndex(index: number): number {
    return (this._startIndex + index) % this.rows;
  }
  public getDataIndex(col: number, row: number): number {
    row = this.getRealRowIndex(row);
    return CELL_DATA_WIDTH * (this.cols * row + col);
  }
  public isWrapped(row: number): number {
    row = this.getRealRowIndex(row);
    return this._lineWraps[row >> 5] >> (row & 31) & 1;
  }
  public setWrap(row: number, value: boolean): void {
    row = this.getRealRowIndex(row);
    if (value) this._lineWraps[row >> 5] |= 1 << (row & 31);
    else this._lineWraps[row >> 5] &= ~(1 << (row & 31));
  }
  // public getLength(row: number): number {
  //   row = this.getRealRowIndex(row);
  //   return this._lineLengths[row >> 1] >> ((row & 1) << 4) & 65535;
  // }
  // public setLength(row: number, value: number): void {
  //   row = this.getRealRowIndex(row);
  //   this._lineLengths[row >> 1] &= ~(65535 << ((row & 1) << 4));
  //   this._lineLengths[row >> 1] |= (value & 65535) << ((row & 1) << 4);
  // }
  // public setLengthIfGreater(row: number, value: number): void {
  //   row = this.getRealRowIndex(row);
  //   if (this.getLength(row) < value) this.setLength(row, value);
  // }
  public get(col: number, row: number): number[] {
    row = this.getRealRowIndex(row);
    let p = CELL_DATA_WIDTH * (this.cols * row + col);
    return [
      this.data[p++],
      this.data[p]
    ]
  }
  public set(col: number, row: number, attr: number, data: number, adjustLength: boolean): void {
    row = this.getRealRowIndex(row);
    let p = CELL_DATA_WIDTH * (this.cols * row + col);
    this.data[p++] = attr;
    this._cs.free(this.data[p]);
    this.data[p] = data;
    // if (adjustLength) this.setLengthIfGreater(row, col);
  }
  public clear(col: number, row: number, attr: number, data: number, adjustLength: boolean): void {
    row = this.getRealRowIndex(row);
    let p = CELL_DATA_WIDTH * (this.cols * row + col);
    this.data[p++] = attr;
    this._cs.free(this.data[p]);
    this.data[p] = data;
    // if (adjustLength && row && this.getLength(row) === col) this.setLength(col, row - 1);
  }
  public clearRow(row: number, attr: number, data: number, adjustLength: boolean): void {
    row = this.getRealRowIndex(row);
    const end = CELL_DATA_WIDTH * (this.cols * row + this.cols);
    for (let i = CELL_DATA_WIDTH * this.cols * row; i < end; i += CELL_DATA_WIDTH) {
      this.data[i] = attr;
      this._cs.free(this.data[i + CELL_DATA]);
      this.data[i + CELL_DATA] = data;
    }
    // if (adjustLength) this.setLength(row, 0);
  }
  public clearInRow(
    row: number, startCol: number, endCol: number,
    attr: number, data: number,
    adjustLength: boolean
  ): void {
    row = this.getRealRowIndex(row);
    const end = CELL_DATA_WIDTH * (this.cols * row + endCol);
    for (let i = CELL_DATA_WIDTH * (this.cols * row + startCol); i < end; i += CELL_DATA_WIDTH) {
      this.data[i] = attr;
      this._cs.free(this.data[i + CELL_DATA]);
      this.data[i + CELL_DATA] = data;
    }
    // if (adjustLength) this.setLength(row, 0);
  }
  public getRowString(row: number, start: number, end: number): string {
    // TODO: set 0 as empty, missing args: rtrim: boolean, fillChar: string
    row = this.getRealRowIndex(row);
    end = CELL_DATA_WIDTH * (this.cols * row + end);
    let s = '';
    for (let i = CELL_DATA_WIDTH * (this.cols * row + start); i < end; i += CELL_DATA_WIDTH) {
      s += this._cs.getString(this.data[i + CELL_DATA]);
    }
    return s;
  }
  public insertChar(col: number, row: number, count: number, attr: number, data: number): void {
    // right shifts row data at col and inserts a new cell
  }
  public deleteChar(col: number, row: number, count: number, attr: number, data: number): void {
    // removes a cell and left shifts remaining row data
  }
  public insertLine(row: number, count: number, attr: number, data: number): void {
    // shifts lines at row down and inserts a blank row
  }
  public deleteLine(row: number, count: number, attr: number, data: number): void {
    // removes a line at row and shifts lines below up
  }
  public panUp(count: number, attr: number, data: number): void {
    // TODO
  }
  public panDown(count: number, attr: number, data: number): void {
    // TODO
  }
  public resize(rows: number, cols: number, height: number, mode: ResizeMode): void {
    // TODO

  }
}
