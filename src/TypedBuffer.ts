import { StringStorage } from "./StringStorage";

const CELL_DATA_WIDTH = 2;
const CELL_ATTR = 0;
const CELL_DATA = 1;

export class LineBuffer {
  private _data: Int32Array;
  constructor(private _cols: number, private _cs: StringStorage) {
    this._data = new Int32Array(_cols * CELL_DATA_WIDTH);
  }

  public get maxLength(): number {
    return this._cols;
  }

  public set maxLength(maxLength: number) {
    if (maxLength === this._cols) return;
    
    const data = new Int32Array(maxLength * CELL_DATA_WIDTH);
    const end = (this._cols < maxLength) ? this._cols : maxLength;
    for (let i = 0; i < end; ++i) data[i] = this._data[i];
    this._data = data;
    this._cols = maxLength;
  }

  public getOffset(col: number): number {
    return col * CELL_DATA_WIDTH;
  }

  public setLine(attr: number, data: number) {
    let start = 0;
    while (start < this._data.length) {
      this._data[start++] = attr;
      this._cs.free(this._data[start]);  // free data pointer
      this._data[start++] = data;
    }
  }

  public get(col: number): any {
    if (col >= this._cols) return;
    const offset = col * CELL_DATA_WIDTH;
    return [
      this._data[offset + CELL_ATTR],
      this._data[offset + CELL_DATA]
    ]
  }

  public set(col: number, attr: number, data: number) {
    if (col >= this._cols) return;
    let start = col * CELL_DATA_WIDTH;
    this._data[start++] = attr;
    this._cs.free(this._data[start]);  // free data pointer
    this._data[start++] = data;
  }

  public insert(col: number, attr: number, data: number) {
    if (col >= this._cols) return;

    // free pointers in last cell
    // data pointer
    this._cs.free(this._data[this._cols * CELL_DATA_WIDTH - CELL_DATA_WIDTH + CELL_DATA]);

    // move content by one cell
    let start = col * CELL_DATA_WIDTH;
    const end = this._cols * CELL_DATA_WIDTH - CELL_DATA_WIDTH;
    for (let i = end; i >= start; --i) this._data[i + CELL_DATA_WIDTH] = this._data[i];


    // insert new data
    this._data[start++] = attr;
    this._data[start++] = data;
  }

  public getString(start: number, end: number) {
    if (start >= this._cols) return;
    let s = '';
    end = Math.min(this._cols, end) * CELL_DATA_WIDTH;
    for (let i = start * CELL_DATA_WIDTH; i < end; i += CELL_DATA_WIDTH) {
      s += this._cs.getString(this._data[i + CELL_DATA]);
    }
    return s;
  }
}

/**
 * Stub class to see memory usage
 */
export class TerminalBuffer {
  private _data: LineBuffer[];
  constructor(private _cols: number, private _rows: number, private _cs: StringStorage) {
    this._data = [];
    for (let i = 0; i < this._rows; ++i) this._data.push(new LineBuffer(this._cols, this._cs));
  }
  public get(idx: number): LineBuffer {
    return this._data[idx];
  }
}

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
 *    - ringbuffer logic on row level
 *    - char/line inserts and deletes
 *    - resizing
 */
export class TerminalBufferWhole {
  public data: Int32Array | number[];
  private _lineWraps: Uint32Array | number[];
  private _lineLengths: Uint32Array | number[];
  constructor(public cols: number, public rows: number, private _cs: StringStorage) {
    if (typeof Int16Array === 'undefined') {
      this.data = [];
      const size = CELL_DATA_WIDTH * cols * rows;
      for (let i = 0; i < size; ++i) this.data.push(0);
      this._lineWraps = [];
      const wrapSize = (rows >> 5) + 1;
      for (let i = 0; i < wrapSize ; ++i) this._lineWraps.push(0);
      this._lineLengths = [];
      const lengthSize = (rows >> 1) + 1
      for (let i = 0; i < lengthSize; ++i) this._lineLengths.push(0);
    } else {
      this.data = new Int32Array(CELL_DATA_WIDTH * cols * rows);
      this._lineWraps = new Uint32Array((rows >> 5) + 1);
      this._lineLengths = new Uint32Array((rows >> 1) + 1);
    }
  }
  public isWrapped(row: number): number {
    return this._lineWraps[row >> 5] >> (row & 31) & 1;
  }
  public setWrap(row: number, value: boolean): void {
    if (value) this._lineWraps[row >> 5] |= 1 << (row & 31);
    else this._lineWraps[row >> 5] &= ~(1 << (row & 31));
  }
  public getLength(row: number): number {
    return this._lineLengths[row >> 1] >> ((row & 1) << 4) & 65535;
  }
  public setLength(row: number, value: number): void {
    this._lineLengths[row >> 1] &= ~(65535 << ((row & 1) << 4));
    this._lineLengths[row >> 1] |= (value & 65535) << ((row & 1) << 4);
  }
  public setLengthIfGreater(row: number, value: number): void {
    if (this.getLength(row) < value) this.setLength(row, value);
  }
  public getIndex(col: number, row: number): number {
    return CELL_DATA_WIDTH * (this.cols * row + col);
  }
  public get(col: number, row: number): number[] {
    let p = CELL_DATA_WIDTH * (this.cols * row + col);
    return [
      this.data[p++],
      this.data[p]
    ]
  }
  public set(col: number, row: number, attr: number, data: number): void {
    let p = CELL_DATA_WIDTH * (this.cols * row + col);
    this.data[p++] = attr;
    this._cs.free(this.data[p]);
    this.data[p] = data;
    // FIXME: should we adjust length here at all?
    this.setLengthIfGreater(row, col);
  }
  public clear(col: number, row: number, attr: number, data: number): void {
    let p = CELL_DATA_WIDTH * (this.cols * row + col);
    this.data[p++] = attr;
    this._cs.free(this.data[p]);
    this.data[p] = data;
    // FIXME: should we adjust length here at all?
    if (row && this.getLength(row) === col) this.setLength(col, row - 1);
  }
  public clearRow(row: number, attr: number, data: number): void {
    const end = CELL_DATA_WIDTH * (this.cols * row + this.cols);
    for (let i = CELL_DATA_WIDTH * this.cols * row; i < end; i += CELL_DATA_WIDTH) {
      this.data[i] = attr;
      this._cs.free(this.data[i + CELL_DATA]);
      this.data[i + CELL_DATA] = data;
    }
  }
  public clearRange(
    startRow: number, startCol: number,
    endRow: number, endCol: number,
    attr: number, data: number
  ): void {
    const end = CELL_DATA_WIDTH * (this.cols * endRow + endCol);
    for (let i = CELL_DATA_WIDTH * (this.cols * startRow + startCol); i < end; i += CELL_DATA_WIDTH) {
      this.data[i] = attr;
      this._cs.free(this.data[i + CELL_DATA]);
      this.data[i + CELL_DATA] = data;
    }
  }
  public getRowString(row: number, start: number, end: number): string {
    // TODO: set 0 as empty, missing args: rtrim: boolean, fillChar: string
    end = CELL_DATA_WIDTH * (this.cols * row + end);
    let s = '';
    for (let i = CELL_DATA_WIDTH * (this.cols * row + start); i < end; i += CELL_DATA_WIDTH) {
      s += this._cs.getString(this.data[i + CELL_DATA]);
    }
    return s;
  }
  public insertChar(col: number, row: number, count: number, attr: number, data: number): void {
    // right shifts row data at col and inserts a new cell
    // free pointers of last cells

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
  public resize(rows: number, cols: number, mode: ResizeMode): void {
    // TODO

  }
}
