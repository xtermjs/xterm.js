/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { CharData, IBufferLine } from './Types';
import { NULL_CELL_CODE, NULL_CELL_WIDTH, NULL_CELL_CHAR, WHITESPACE_CELL_CHAR } from './Buffer';


/** typed array slots taken by one cell */
const CELL_SIZE = 3;

/** cell member indices */
const enum Cell {
  FLAGS = 0,
  STRING = 1,
  WIDTH = 2
}

/** single vs. combined char distinction */
const IS_COMBINED_BIT_MASK = 0x80000000;

/**
 * Typed array based bufferline implementation.
 */
export class BufferLine implements IBufferLine {
  protected _data: Uint32Array | null = null;
  protected _combined: {[index: number]: string} = {};
  public length: number;

  constructor(cols: number, fillCharData?: CharData, public isWrapped: boolean = false) {
    if (!fillCharData) {
      fillCharData = [0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE];
    }
    if (cols) {
      this._data = new Uint32Array(cols * CELL_SIZE);
      for (let i = 0; i < cols; ++i) {
        this.set(i, fillCharData);
      }
    }
    this.length = cols;
  }

  public get(index: number): CharData {
    const stringData = this._data[index * CELL_SIZE + Cell.STRING];
    return [
      this._data[index * CELL_SIZE + Cell.FLAGS],
      (stringData & IS_COMBINED_BIT_MASK)
        ? this._combined[index]
        : (stringData) ? String.fromCharCode(stringData) : '',
      this._data[index * CELL_SIZE + Cell.WIDTH],
      (stringData & IS_COMBINED_BIT_MASK)
        ? this._combined[index].charCodeAt(this._combined[index].length - 1)
        : stringData
    ];
  }

  public getWidth(index: number): number {
    return this._data[index * CELL_SIZE + Cell.WIDTH];
  }

  public set(index: number, value: CharData): void {
    this._data[index * CELL_SIZE + Cell.FLAGS] = value[0];
    if (value[1].length > 1) {
      this._combined[index] = value[1];
      this._data[index * CELL_SIZE + Cell.STRING] = index | IS_COMBINED_BIT_MASK;
    } else {
      this._data[index * CELL_SIZE + Cell.STRING] = value[1].charCodeAt(0);
    }
    this._data[index * CELL_SIZE + Cell.WIDTH] = value[2];
  }

  public insertCells(pos: number, n: number, fillCharData: CharData): void {
    pos %= this.length;
    if (n < this.length - pos) {
      for (let i = this.length - pos - n - 1; i >= 0; --i) {
        this.set(pos + n + i, this.get(pos + i));
      }
      for (let i = 0; i < n; ++i) {
        this.set(pos + i, fillCharData);
      }
    } else {
      for (let i = pos; i < this.length; ++i) {
        this.set(i, fillCharData);
      }
    }
  }

  public deleteCells(pos: number, n: number, fillCharData: CharData): void {
    pos %= this.length;
    if (n < this.length - pos) {
      for (let i = 0; i < this.length - pos - n; ++i) {
        this.set(pos + i, this.get(pos + n + i));
      }
      for (let i = this.length - n; i < this.length; ++i) {
        this.set(i, fillCharData);
      }
    } else {
      for (let i = pos; i < this.length; ++i) {
        this.set(i, fillCharData);
      }
    }
  }

  public replaceCells(start: number, end: number, fillCharData: CharData): void {
    while (start < end  && start < this.length) {
      this.set(start++, fillCharData);
    }
  }

  public resize(cols: number, fillCharData: CharData): void {
    if (cols === this.length) {
      return;
    }
    if (cols > this.length) {
      const data = new Uint32Array(cols * CELL_SIZE);
      if (this.length) {
        if (cols * CELL_SIZE < this._data.length) {
          data.set(this._data.subarray(0, cols * CELL_SIZE));
        } else {
          data.set(this._data);
        }
      }
      this._data = data;
      for (let i = this.length; i < cols; ++i) {
        this.set(i, fillCharData);
      }
    } else {
      if (cols) {
        const data = new Uint32Array(cols * CELL_SIZE);
        data.set(this._data.subarray(0, cols * CELL_SIZE));
        this._data = data;
        // Remove any cut off combined data
        const keys = Object.keys(this._combined);
        for (let i = 0; i < keys.length; i++) {
          const key = parseInt(keys[i], 10);
          if (key >= cols) {
            delete this._combined[key];
          }
        }
      } else {
        this._data = null;
        this._combined = {};
      }
    }
    this.length = cols;
  }

  /** fill a line with fillCharData */
  public fill(fillCharData: CharData): void {
    this._combined = {};
    for (let i = 0; i < this.length; ++i) {
      this.set(i, fillCharData);
    }
  }

  /** alter to a full copy of line  */
  public copyFrom(line: BufferLine): void {
    if (this.length !== line.length) {
      this._data = new Uint32Array(line._data);
    } else {
      // use high speed copy if lengths are equal
      this._data.set(line._data);
    }
    this.length = line.length;
    this._combined = {};
    for (const el in line._combined) {
      this._combined[el] = line._combined[el];
    }
    this.isWrapped = line.isWrapped;
  }

  /** create a new clone */
  public clone(): IBufferLine {
    const newLine = new BufferLine(0);
    // creation of new typed array from another is actually pretty slow :(
    // still faster than copying values one by one
    newLine._data = new Uint32Array(this._data);
    newLine.length = this.length;
    for (const el in this._combined) {
      newLine._combined[el] = this._combined[el];
    }
    newLine.isWrapped = this.isWrapped;
    return newLine;
  }

  public getTrimmedLength(): number {
    for (let i = this.length - 1; i >= 0; --i) {
      if (this._data[i * CELL_SIZE + Cell.STRING] !== 0) {  // 0 ==> ''.charCodeAt(0) ==> NaN ==> 0
        return i + this._data[i * CELL_SIZE + Cell.WIDTH];
      }
    }
    return 0;
  }

  public copyCellsFrom(src: BufferLine, srcCol: number, destCol: number, length: number, applyInReverse: boolean): void {
    const srcData = src._data;
    if (applyInReverse) {
      for (let cell = length - 1; cell >= 0; cell--) {
        for (let i = 0; i < CELL_SIZE; i++) {
          this._data[(destCol + cell) * CELL_SIZE + i] = srcData[(srcCol + cell) * CELL_SIZE + i];
        }
      }
    } else {
      for (let cell = 0; cell < length; cell++) {
        for (let i = 0; i < CELL_SIZE; i++) {
          this._data[(destCol + cell) * CELL_SIZE + i] = srcData[(srcCol + cell) * CELL_SIZE + i];
        }
      }
    }

    // Move any combined data over as needed
    const srcCombinedKeys = Object.keys(src._combined);
    for (let i = 0; i < srcCombinedKeys.length; i++) {
      const key = parseInt(srcCombinedKeys[i], 10);
      if (key >= srcCol) {
        this._combined[key - srcCol + destCol] = src._combined[key];
      }
    }
  }

  public translateToString(trimRight: boolean = false, startCol: number = 0, endCol: number = this.length): string {
    if (trimRight) {
      endCol = Math.min(endCol, this.getTrimmedLength());
    }
    let result = '';
    while (startCol < endCol) {
      const stringData = this._data[startCol * CELL_SIZE + Cell.STRING];
      result += (stringData & IS_COMBINED_BIT_MASK) ? this._combined[startCol] : (stringData) ? String.fromCharCode(stringData) : WHITESPACE_CELL_CHAR;
      startCol += this._data[startCol * CELL_SIZE + Cell.WIDTH] || 1;
    }
    return result;
  }
}
