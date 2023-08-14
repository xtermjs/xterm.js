/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

// eslint-disable-next-line
declare const Buffer: any;


export interface IHeaderFields {
  // base-64 encoded filename. Defaults to "Unnamed file".
  name: string;
  // File size in bytes. The file transfer will be canceled if this size is exceeded.
  size: number;
  /**
   * Optional width and height to render:
   * - N: N character cells.
   * - Npx: N pixels.
   * - N%: N percent of the session's width or height.
   * - auto: The image's inherent size will be used to determine an appropriate dimension.
   */
  width?: string;
  height?: string;
  // Optional, defaults to 1 respecting aspect ratio (width takes precedence).
  preserveAspectRatio?: number;
  // Optional, defaults to 0. If set to 1, the file will be displayed inline, else downloaded
  // (download not supported).
  inline?: number;
}

export const enum HeaderState {
  START = 0,
  ABORT = 1,
  KEY = 2,
  VALUE = 3,
  END = 4
}

// field value decoders

// ASCII bytes to string
function toStr(data: Uint32Array): string {
  let s = '';
  for (let i = 0; i < data.length; ++i) {
    s += String.fromCharCode(data[i]);
  }
  return s;
}

// digits to integer
function toInt(data: Uint32Array): number {
  let v = 0;
  for (let i = 0; i < data.length; ++i) {
    if (data[i] < 48 || data[i] > 57) {
      throw new Error('illegal char');
    }
    v = v * 10 + data[i] - 48;
  }
  return v;
}

// check for correct size entry
function toSize(data: Uint32Array): string {
  const v = toStr(data);
  if (!v.match(/^((auto)|(\d+?((px)|(%)){0,1}))$/)) {
    throw new Error('illegal size');
  }
  return v;
}

// name is base64 encoded utf-8
function toName(data: Uint32Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(toStr(data), 'base64').toString();
  }
  const bs = atob(toStr(data));
  const b = new Uint8Array(bs.length);
  for (let i = 0; i < b.length; ++i) {
    b[i] = bs.charCodeAt(i);
  }
  return new TextDecoder().decode(b);
}

const DECODERS: {[key: string]: (v: Uint32Array) => any} = {
  inline: toInt,
  size: toInt,
  name: toName,
  width: toSize,
  height: toSize,
  preserveAspectRatio: toInt
};


const FILE_MARKER = [70, 105, 108, 101];
const MAX_FIELDCHARS = 1024;


export class HeaderParser {
  public state: HeaderState = HeaderState.START;
  private _buffer = new Uint32Array(MAX_FIELDCHARS);
  private _position = 0;
  private _key = '';
  public fields: {[key: string]: any} = {};

  public reset(): void {
    this._buffer.fill(0);
    this.state = HeaderState.START;
    this._position = 0;
    this.fields = {};
    this._key = '';
  }

  public parse(data: Uint32Array, start: number, end: number): number {
    let state = this.state;
    let pos = this._position;
    const buffer = this._buffer;
    if (state === HeaderState.ABORT || state === HeaderState.END) return -1;
    if (state === HeaderState.START && pos > 6) return -1;
    for (let i = start; i < end; ++i) {
      const c = data[i];
      switch (c) {
        case 59: // ;
          if (!this._storeValue(pos)) return this._a();
          state = HeaderState.KEY;
          pos = 0;
          break;
        case 61: // =
          if (state === HeaderState.START) {
            for (let k = 0; k < FILE_MARKER.length; ++k) {
              if (buffer[k] !== FILE_MARKER[k]) return this._a();
            }
            state = HeaderState.KEY;
            pos = 0;
          } else if (state === HeaderState.KEY) {
            if (!this._storeKey(pos)) return this._a();
            state = HeaderState.VALUE;
            pos = 0;
          } else if (state === HeaderState.VALUE) {
            if (pos >= MAX_FIELDCHARS) return this._a();
            buffer[pos++] = c;
          }
          break;
        case 58: // :
          if (state === HeaderState.VALUE) {
            if (!this._storeValue(pos)) return this._a();
          }
          this.state = HeaderState.END;
          return i + 1;
        default:
          if (pos >= MAX_FIELDCHARS) return this._a();
          buffer[pos++] = c;
      }
    }
    this.state = state;
    this._position = pos;
    return -2;
  }

  private _a(): number {
    this.state = HeaderState.ABORT;
    return -1;
  }

  private _storeKey(pos: number): boolean {
    const k = toStr(this._buffer.subarray(0, pos));
    if (k) {
      this._key = k;
      this.fields[k] = null;
      return true;
    }
    return false;
  }

  private _storeValue(pos: number): boolean {
    if (this._key) {
      try {
        const v = this._buffer.slice(0, pos);
        this.fields[this._key] = DECODERS[this._key] ? DECODERS[this._key](v) : v;
      } catch (e) {
        return false;
      }
      return true;
    }
    return false;
  }
}
