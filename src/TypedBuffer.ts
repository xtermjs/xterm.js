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
