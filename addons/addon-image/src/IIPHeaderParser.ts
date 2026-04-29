/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

// eslint-disable-next-line
declare const Buffer: any;

export const enum HeaderState {
  START = 0,
  ABORT = 1,
  KEY = 2,
  VALUE = 3,
  END = 4
}

export const enum SequenceType {
  INVALID = 0,
  FILE = 1,
  MULTIPARTFILE = 2,
  FILEPART = 3,
  FILEEND = 4,
  REPORTCELLSIZE = 5
}

export interface IHeaderFields {
  [key: string]: number | string | Uint32Array | null | undefined;
  // sequence type
  type: SequenceType;
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

const DECODERS: {[key: string]: (v: Uint32Array) => number | string} = {
  inline: toInt,
  size: toInt,
  name: toName,
  width: toSize,
  height: toSize,
  preserveAspectRatio: toInt
};


// sequence type markers
// File
const FILE_MARKER = [70, 105, 108, 101];
// MultipartFile
const MULTIPARTFILE_MARKER = [77, 117, 108, 116, 105, 112, 97, 114, 116, 70, 105, 108, 101];
// FilePart
const FILEPART_MARKER = [70, 105, 108, 101, 80, 97, 114, 116];
// FileEnd
const FILEEND_MARKER = [70, 105, 108, 101, 69, 110, 100];
// ReportCellSize
const REPORTCELLSIZE_MARKER = [82, 101, 112, 111, 114, 116, 67, 101, 108, 108, 83, 105, 122, 101];

// max allowed chars for sequence header
const MAX_FIELDCHARS = 1024;


export class HeaderParser {
  public state: HeaderState = HeaderState.START;
  private _buffer = new Uint32Array(MAX_FIELDCHARS);
  private _position = 0;
  private _key = '';
  public fields: {[key: string]: number | string | Uint32Array | null | undefined} = {};

  public reset(): void {
    this._buffer.fill(0);
    this.state = HeaderState.START;
    this._position = 0;
    this.fields = {};
    this._key = '';
  }

  public end(): number {
    if (this.state === HeaderState.START) {
      if (this._position === FILEEND_MARKER.length) {
        for (let k = 0; k < FILEEND_MARKER.length; ++k) {
          if (this._buffer[k] !== FILEEND_MARKER[k]) return this._a();
        }
        this.fields['type'] = SequenceType.FILEEND;
        this.state = HeaderState.END;
        return 0;
      }
      if (this._position === REPORTCELLSIZE_MARKER.length) {
        for (let k = 0; k < REPORTCELLSIZE_MARKER.length; ++k) {
          if (this._buffer[k] !== REPORTCELLSIZE_MARKER[k]) return this._a();
        }
        this.fields['type'] = SequenceType.REPORTCELLSIZE;
        this.state = HeaderState.END;
        return 0;
      }
      return this._a();
    }
    if (this.state === HeaderState.END) return 0;
    if (this.state === HeaderState.VALUE
      && this.fields.type === SequenceType.MULTIPARTFILE
    ) {
      if (!this._storeValue(this._position)) return this._a();
      this.state = HeaderState.END;
      return 0;
    }
    return this._a();
  }

  public parse(data: Uint32Array, start: number, end: number): number {
    let state = this.state;
    let pos = this._position;
    const buffer = this._buffer;
    if (state === HeaderState.ABORT || state === HeaderState.END) return -1;
    if (state === HeaderState.START && pos > 14) return -1;
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
            if (buffer[0] === 70) {
              // 'File' or 'FilePart'
              let k = 0;
              for (; k < FILE_MARKER.length; ++k) {
                if (buffer[k] !== FILE_MARKER[k]) return this._a();
              }
              this.fields['type'] = SequenceType.FILE;
              if (pos === FILEPART_MARKER.length) {
                for (; k < FILEPART_MARKER.length; ++k) {
                  if (buffer[k] !== FILEPART_MARKER[k]) return this._a();
                }
                this.fields['type'] = SequenceType.FILEPART;
                this.state = HeaderState.END;
                return i + 1;
              }
            } else if (buffer[0] === 77) {
              // 'MultipartFile'
              for (let k = 0; k < MULTIPARTFILE_MARKER.length; ++k) {
                if (buffer[k] !== MULTIPARTFILE_MARKER[k]) return this._a();
              }
              this.fields['type'] = SequenceType.MULTIPARTFILE;
            } else {
              return this._a();
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
    this.fields.type = SequenceType.INVALID;
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
      } catch {
        return false;
      }
      return true;
    }
    return false;
  }
}
