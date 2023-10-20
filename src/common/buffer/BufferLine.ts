/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { CharData, IInputHandler, IAttributeData, IBufferLine, ICellData, IExtendedAttrs } from 'common/Types';
import { AttributeData } from 'common/buffer/AttributeData';
import { CellData } from 'common/buffer/CellData';
import { Attributes, BgFlags, CHAR_DATA_ATTR_INDEX, CHAR_DATA_CHAR_INDEX, CHAR_DATA_WIDTH_INDEX, Content, StyleFlags, NULL_CELL_CHAR, NULL_CELL_CODE, NULL_CELL_WIDTH, WHITESPACE_CELL_CHAR } from 'common/buffer/Constants';
import { stringFromCodePoint, utf32ToString } from 'common/input/TextDecoder';
import { UnicodeService } from 'common/services/UnicodeService';

export const DEFAULT_ATTR_DATA = Object.freeze(new AttributeData());

const EMPTY_DATA = new Uint32Array(0);

// Work variables to avoid garbage collection
let $startIndex = 0;

/** Factor when to cleanup underlying array buffer after shrinking. */
const CLEANUP_THRESHOLD = 2;

export abstract class AbstractBufferLine implements IBufferLine {
  /** Number of logical columns */
  length: number = 0;
  isWrapped: boolean = false;

  scanInit(cursor: ICellData): void {
  }

  abstract scanNext(cursor: ICellData, n: number, flags: number): number;
  abstract eraseAll(bg: number): void;
  abstract insertCells(pos: number, n: number, fillCellData: ICellData, eraseAttr?: IAttributeData): void;
  abstract addCodepointToCell(index: number, codePoint: number, width: number): void;
  abstract resize(cols: number, fillCellData: ICellData): boolean;
  abstract fill(fillCellData: ICellData, respectProtect: boolean): void;
  abstract copyFrom(line: BufferLine): void;
  abstract clone(): IBufferLine;
  abstract translateToString(trimRight: boolean, startCol: number, endCol: number): string;
  abstract getTrimmedLength(): number;
  abstract getNoBgTrimmedLength(): number;
  abstract cleanupMemory(): number;

  abstract loadCell(index: number, cell: ICellData): ICellData;

  public replaceCells(start: number, end: number, fillCellData: ICellData, respectProtect: boolean = false): void {
    // full branching on respectProtect==true, hopefully getting fast JIT for standard case
    if (respectProtect) {
      if (start && this.getWidth(start - 1) === 2 && !this.isProtected(start - 1)) {
        this.setCellFromCodepoint(start - 1, 0, 1, fillCellData);
      }
      if (end < this.length && this.getWidth(end - 1) === 2 && !this.isProtected(end)) {
        this.setCellFromCodepoint(end, 0, 1, fillCellData);
      }
      while (start < end  && start < this.length) {
        if (!this.isProtected(start)) {
          this.setCell(start, fillCellData);
        }
        start++;
      }
      return;
    }

    // handle fullwidth at start: reset cell one to the left if start is second cell of a wide char
    if (start && this.getWidth(start - 1) === 2) {
      this.setCellFromCodepoint(start - 1, 0, 1, fillCellData);
    }
    // handle fullwidth at last cell + 1: reset to empty cell if it is second part of a wide char
    if (end < this.length && this.getWidth(end - 1) === 2) {
      this.setCellFromCodepoint(end, 0, 1, fillCellData);
    }

    while (start < end  && start < this.length) {
      this.setCell(start++, fillCellData);
    }
  }

 /**
   * Get cell data CharData.
   * @deprecated
   */
  get(index: number): CharData {
    let cell = new CellData();
    this.loadCell(index, cell);
    return cell.getAsCharData();
  }

 /**
   * Set cell data from CharData.
   * @deprecated
   */
  public set(index: number, value: CharData): void {
      this.setCell(index, CellData.fromCharData(value));
  }

  /**
   * primitive getters
   * use these when only one value is needed, otherwise use `loadCell`
   */
  public getWidth(index: number): number {
    return this.loadCell(index, new CellData()).content >>> Content.WIDTH_SHIFT;
  }

  /** Test whether content has width. */
  public hasWidth(index: number): number {
    return this.loadCell(index, new CellData()).content & Content.WIDTH_MASK;
  }

  /** Get FG cell component. */
  public getFg(index: number): number {
    return this.loadCell(index, new CellData()).fg;
  }

  /** Get BG cell component. @deprecated */
  public getBg(index: number): number {
    return this.loadCell(index, new CellData()).bg;
  }

  /**
   * Test whether contains any chars. @deprecated
   * Basically an empty has no content, but other cells might differ in FG/BG
   * from real empty cells.
   */
  public hasContent(index: number): number {
    return this.loadCell(index, new CellData()).content & Content.HAS_CONTENT_MASK;
  }

  abstract setCellFromCodepoint(index: number, codePoint: number, width: number,  attrs: IAttributeData): void;
  /**
   * Set data at `index` to `cell`.
   */
  public setCell(index: number, cell: ICellData): void {
    this.setCellFromCodepoint(index, cell.content, cell.getWidth(), cell);
  }

  /**
   * Get codepoint of the cell. @deprecated
   * To be in line with `code` in CharData this either returns
   * a single UTF32 codepoint or the last codepoint of a combined string.
   */
  public getCodePoint(index: number): number {
    return this.loadCell(index, new CellData()).getCode();
  }

  /** Test whether the cell contains a combined string. */
  public isCombined(index: number): number {
    return this.loadCell(index, new CellData()).isCombined();
  }

  abstract deleteCells(pos: number, n: number, fillCellData: ICellData): void;

  /** Returns the string content of the cell. @deprecated  */
  public getString(index: number): string {
    const cell = new CellData();
    this.loadCell(index, cell);
    return cell.getChars();
  }

  /** Get state of protected flag. @deprecated */
  public isProtected(index: number): number {
    return this.loadCell(index, new CellData()).bg & BgFlags.PROTECTED;
  }

  public fixSplitWide(cursor: ICellData): void { /* do nothing */ }

}

const enum DataKind { // 4 bits
  FG = 1, // lower 26 bits is RGB foreground color and CM_MASK
  BG = 2, // lower 26 bits is RGB background color and CM_MASK
  STYLE_FLAGS = 3, // lower 26 bits is StyleFlags

  SKIP_COLUMNS = 7, // empty ("null") columns (28 bit count)
  // The following have a 21-bit codepoint value in the low-order bits
  CHAR_w1 = 8, // single-non-compound, 1 column wide
  CHAR_w2 = 9, // single-non-compound, 2 columns wide
  // CLUSTER_START_xx have a 7=bit for number of CONTINUED entries
  CLUSTER_START_w1 = 10, // start of non-trivial cluster, 1 column wide
  CLUSTER_START_w2 = 11, // start of non-trivial cluster, 2 columns wide
  CLUSTER_CONTINUED = 12 // continuation of cluster
}

const NULL_DATA_WORD = DataKind.SKIP_COLUMNS << 28;

export class BufferLine extends AbstractBufferLine implements IBufferLine {
  // Each item in _data is a 4-bit DataKind and 28 bits data.
  protected _data: Uint32Array;
  protected _dataLength: number; // active length of _data array
  // Key is index in _data array that has STYLE_FLAGS kind with HAS_EXTENDED.
  protected _extendedAttrs: {[index: number]: IExtendedAttrs | undefined} = {};
  public length: number;
  /** Used if this a continuation line (WORK-IN-PROGRESS) */
  continuationStart: CellData | undefined;

  /** Color for "rest of line" background, following _dataLength. */
  lineEndBg: number;

  private _cache1: number = 0;
  private _cache2: number = 0;
  private _cache3: number = 0;
  private _cache4: number = 0;

  /** The "current" index into the _data array.
   * The index must be either _dataLength or wKindIsTextOrSkip must be true.
   * (The index never points to a CLUSTER_CONTINUED item.)
   */
  private _cachedDataIndex(): number { return this._cache1 >>> 16; }
  /** The column number corresponding to _cachedDataIndex(). */
  private _cachedColumn(): number { return this._cache1 & 0xFFFF; }
  //private _cachedColOffset(): number { return this._cache3 >> 24; } // UNUSED
  private _cachedBg(): number { return this._cache2; }
  private _cachedFg(): number { return this._cache3; }
  // One more than index (in _data) of STYLE_FLAGS; 0 if none.
  private _cachedStyleFlagsIndex(): number { return this._cache4; }
  private _cacheReset(): void { this._cache1 = 0; this._cache2 = 0; this._cache3 = 0; this._cache4 = 0; }
  private _cacheSetFgBg(fg: number, bg: number): void { this._cache2 = bg; this._cache3 = fg; }
  private _cacheSetStyleFlagsIndex(index: number): void { this._cache4 = index; }
  private _cacheSetColumnDataIndex(column: number, dataIndex: number): void { this._cache1 = (dataIndex << 16) | (column & 0xFFFF); }

  /** Index in _data of "current chunk". */
  private static dataIndex(cell: CellData): number { return cell._stateM; }

  /** The "current position" is this many columns into the current chunk.
   * 0..1 (if CHAR_w1); 0..1 (if CHAR_w2); 0..1 (if CLUSTER_stART_w1);
   * 0..2 (if CLUSTER_START_w2). (Odd values of CHAR_w2 or CLUSTER_START_w2 are only
   * allowed as temporary intermediate positions; except for appending, it is
   * an error to try modify *part* of a cluster or a wide character,
   * the effect will that the entire cluster or wide character is cleared.)
   * Normally non-zero except right after initialization or backwards movement.
   * I.e. when at the end of a N-column chunk, column offset should be N,
   * rather than offset 0 in the next chunk.
   */
  private static columnOffset(cell: CellData): number { return cell._stateA; }

  private static setPosition(cell: CellData, idata: number, itext: number, columnOffset: number): void {
    cell._stateM = idata;
    cell._stateN = itext;
    cell._stateA = columnOffset; // See note at columnOffset
  }

  /** From a Uint23 in _data, extract the DataKind bits. */
  private static wKind(word: number): DataKind { return word >>> 28; }
  private static wKindIsText(kind: DataKind): boolean { return kind >= DataKind.CHAR_w1 && kind <= DataKind.CLUSTER_CONTINUED; }
  private static wKindIsTextOrSkip(kind: DataKind): boolean { return kind >= DataKind.SKIP_COLUMNS && kind <= DataKind.CLUSTER_CONTINUED; }
  /** From a Uint23 in _data, extract length of string within _text.
    * Only for SKIP_COLUMNS. */
  private static wSkipCount(word: number): number { return word & 0xfffff; }
  private static wSet1(kind: DataKind, value: number): number {
    return (kind << 28) | (value & 0x0fffffff);
  }
  //private static wSet2(kind: DataKind, start: number, len: number): number { return (kind << 28) | (start & 0x3ffff) | ((len & 0x3dd) << 18); }

  scanInit(cursor: ICellData): void {
    const cell = cursor as CellData;
    if (this.continuationStart) {
      cell.copyFrom(this.continuationStart);
    } else {
      cell.fg = 0;
      cell.bg = 0;
      BufferLine.setPosition(cell, 0, 0, 0);
    }
  }

  constructor(cols: number, fillCellData?: ICellData, public isWrapped: boolean = false) {
    super();
    // MAYBE: const buffer = new ArrayBuffer(0, { maxByteLength: 6 * cols });
    //const buffer = new ArrayBuffer(4 * cols, { maxByteLength: 6 * cols });
    this._data = new Uint32Array(cols);
    this._dataLength = 0;
    this.lineEndBg = 0;
    this.length = cols;
  }

  resizeData(size: number): void {
      if (size > this._data.length) {
        //buffer = new ArrayBuffer(buffer.byteLength, { maxByteLength: 6 * size });
        const new_data = new Uint32Array((3 * size) >> 1);
        new_data.set(this._data);
        this._data = new_data;
      }
  }

  // count can be negative
  addEmptyDataElements(position: number, count: number): void {
    // FIXME also adjust _extendedAttr indexes
    this.resizeData(this._dataLength + count);
    this._data.copyWithin(position + count, position, this._dataLength);
    this._dataLength += count;
  }

  /**
   * primitive getters
   * use these when only one value is needed, otherwise use `loadCell`
   */
  public getWidth(index: number): number {
    return this.moveToColumn(index) >>> Content.WIDTH_SHIFT;
  }

  /** Test whether content has width. */
  public hasWidth(index: number): number {
    return this.moveToColumn(index) & Content.WIDTH_MASK;
  }

  /** Get FG cell component. */
  public getFg(index: number): number {
    this.moveToColumn(index);
    const styleIndex = this._cachedStyleFlagsIndex();
    const styleWord = styleIndex > 0 ? this._data[styleIndex - 1] : 0;
    return this._cachedFg() | ((styleWord << 24) & Attributes.STYLE_BITS_MASK);
  }

  /** Get BG cell component. @deprecated */
  public getBg(index: number): number {
    this.moveToColumn(index);
    const styleIndex = this._cachedStyleFlagsIndex();
    const styleWord = styleIndex > 0 ? this._data[styleIndex - 1] : 0;
    return this._cachedBg() | ((styleWord << 16) & Attributes.STYLE_BITS_MASK);
  }

  /**
   * Test whether contains any chars. @deprecated
   * Basically an empty has no content, but other cells might differ in FG/BG
   * from real empty cells.
   */
  public hasContent(index: number): number {
    return this.moveToColumn(index) & Content.HAS_CONTENT_MASK;
  }

  /** Test whether the cell contains a combined string. */
  public isCombined(index: number): number {
    return this.moveToColumn(index) & Content.IS_COMBINED_MASK;
  }

  /** for debugging */
  getText(skipReplace: string = ' '): string {
    return this.translateToString(true, 0, this.length, skipReplace);
  }

  /* Human-readable display of _data array, for debugging */
  _showData(start = 0, end = this._dataLength) {
    let s = '[';
    let toffset = 0;
    for (let i = 0; i < end; i++) {
      const word = this._data[i];
      const kind = BufferLine.wKind(word);
      let code: string | number = kind;
      const wnum = word & 0xfffffff;
      switch (kind) {
        case DataKind.FG: code = 'FG'; break;
        case DataKind.BG: code = 'BG'; break;
        case DataKind.STYLE_FLAGS: code = 'STYLE'; break;
        case DataKind.SKIP_COLUMNS: code = 'SKIP'; break;
        case DataKind.CLUSTER_START_w1: code = 'CL1'; break;
        case DataKind.CLUSTER_START_w2: code = 'CL2'; break;
        case DataKind.CLUSTER_CONTINUED: code = 'CL_CONT'; break;
        case DataKind.CHAR_w1: code = 'C1'; break;
        case DataKind.CHAR_w2: code = 'C2'; break;
      }
      if (i >= start) {
        if (i !== start) {
          s += ', ';
        }
        let value;
        if (kind === DataKind.CHAR_w1 || kind === DataKind.CHAR_w2) {
            let count = 1;
            while (i + count < end && BufferLine.wKind(this._data[i + count]) === kind) {
                count++;
            }
            let str;
            if (count === 1) {
              str = stringFromCodePoint(word & 0x1fffff);
            } else {
                str = utf32ToString(this._data, i, i + count);
                code = code + '*' + count;
                i += count - 1;
            }
            value = JSON.stringify(str);
        } else if (kind === DataKind.CLUSTER_START_w1
            || DataKind.CLUSTER_START_w2) {
          // FIXME extract cluster as string
          value = '#' + (word & 0x1fffff).toString(16);
        } else if (kind === DataKind.CLUSTER_CONTINUED) {
          value = '#' + (word & 0x1fffff).toString(16);
        } else if (kind === DataKind.BG || kind === DataKind.FG) {
          value = (wnum >> 24) + '#' + (wnum & 0xffffff).toString(16);
        } else if (kind !== DataKind.SKIP_COLUMNS) {
          value = '#' + wnum.toString(16);
        } else {
          value = wnum.toString();
        }
        s += code + ': ' + value;
      }
    }
    return s + ']';
  }

  /** Check invariants. Useful for debugging. */
  _check(): void {
    function error(str: string) {
      console.log("ERROR: "+str);
    }
    let itext = 0;
    let icol = 0;
    if (this._dataLength < 0 || this._dataLength > this._data.length)
      error("bad _dataLength");
    const incrementText = (wlen: number) => {
    };
    for (let idata = 0; idata < this._dataLength; idata++) {
      const word = this._data[idata];
      const kind = BufferLine.wKind(word);
      switch (kind) {
        case DataKind.FG:
        case DataKind.BG:
          break;
        case DataKind.STYLE_FLAGS:
          break;
        case DataKind.SKIP_COLUMNS:
          break;
        case DataKind.CHAR_w1:
        case DataKind.CHAR_w2:
        case DataKind.CLUSTER_START_w1:
        case DataKind.CLUSTER_START_w2:
        case DataKind.CLUSTER_CONTINUED:
          break;
        default:
          error("invalid _dataKind");
      }
    }
  }

  _checkCursor(cell: CellData): void {
    function error(str: string) {
      console.log("ERROR: "+str);
    }
    let idata = BufferLine.dataIndex(cell);
    if (! (idata >= 0) || idata > this._dataLength)
      error("bad data index");
    if (idata < this._dataLength) {
      let word = this._data[idata];
      let kind = BufferLine.wKind(word);
      /*
      const wlen = BufferLine.wSkipCount(word);
      let colOffset = BufferLine.columnOffset(cell);
      if (BufferLine.wKindIsTextOrSkip(kind)) {
        if (colOffset > wwidth * wlen)
          error("bad columnOffset");
      } else {
        error("cursor points to style word");
      }
      */
    }
  }

  public atLineEnd(cursor: CellData): boolean {
    let idata = BufferLine.dataIndex(cursor);
    if (idata === this._dataLength)
      return true;
    if (idata < this._dataLength - 1)
      return false;
    const word = this._data[idata];
    const kind = BufferLine.wKind(word);
    if (kind <= DataKind.SKIP_COLUMNS)
        return true;
    return false;
  }

  /**
   * Get cell data CharData.
   * @deprecated
   */
  public get(index: number): CharData {
    return this.loadCell(index, new CellData()).getAsCharData();
  }

  public clusterEnd(idata: number): number {
    // FIXME do we need to handle more than 7 bits of CLUSTED_CONTINUED?
    return idata + 1 + ((this._data[idata] >> 21) & 0x3F);
  }

  public insertCells(pos: number, n: number, fillCellData: ICellData): void {
    alert("insertCells");
    /*
    pos %= this.length;

    // handle fullwidth at pos: reset cell one to the left if pos is second cell of a wide char
    if (pos && this.getWidth(pos - 1) === 2) {
      this.setCellFromCodepoint(pos - 1, 0, 1, fillCellData);
    }

    if (n < this.length - pos) {
      const cell = new CellData();
      for (let i = this.length - pos - n - 1; i >= 0; --i) {
        this.setCell(pos + n + i, this.loadCell(pos + i, cell));
      }
      for (let i = 0; i < n; ++i) {
        this.setCell(pos + i, fillCellData);
      }
    } else {
      for (let i = pos; i < this.length; ++i) {
        this.setCell(i, fillCellData);
      }
    }

    // handle fullwidth at line end: reset last cell if it is first cell of a wide char
    if (this.getWidth(this.length - 1) === 2) {
      this.setCellFromCodepoint(this.length - 1, 0, 1, fillCellData);
    }
    */
  }

 /** Split the the word referenced by 'cell' at the current colOffset.
   * Assumes wKindIsTextOrSkip(kind).
   */
  splitWord(cell: CellData, extraWordsToAdd: number): void {
    let idata = BufferLine.dataIndex(cell);
    const colOffset = BufferLine.columnOffset(cell);
    let add = extraWordsToAdd;
    if (colOffset === 0) {
      if (extraWordsToAdd) {
        this.addEmptyDataElements(idata, add);
        BufferLine.setPosition(cell, idata, -1, colOffset);
      }
    } else if (idata === this._dataLength) {
      this.addEmptyDataElements(idata, add + 1);
      this._data[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, colOffset);
      BufferLine.setPosition(cell, idata + 1, -1, 0);
    } else {
      const word = this._data[idata];
      const kind = BufferLine.wKind(word);
      // FIXME use atLineEnd
      // FIXME handle new DataKind types
      const atEnd = (kind | 1) === DataKind.CHAR_w2
            ? colOffset === (kind - DataKind.CHAR_w1 + 1)
            : (kind | 1) === DataKind.CLUSTER_START_w2
            ? colOffset === (kind & 1) + 1
            : false;
      if (atEnd) {
        if ((kind | 1) === DataKind.CLUSTER_START_w2)
            idata = this.clusterEnd(idata);
        else
          idata++;
        if (extraWordsToAdd) { // always true?
          this.addEmptyDataElements(idata, add);
        }
      } else {
        const kind = BufferLine.wKind(word);
        this._data[idata] = BufferLine.wSet1(kind, colOffset);
        idata++;
        this.addEmptyDataElements(idata, add + 1);
        this._data[idata+add] = BufferLine.wSet1(kind, 1 - colOffset); // ???
      }
      BufferLine.setPosition(cell, idata, -1, 0);
    }
  }

  public moveToColumn(index: number): number {
    let curColumn = this._cachedColumn();
    if (index < curColumn) {
      // FIXME can sometimes do better
      this._cacheReset();
      curColumn = 0;
    }
    let idata = this._cachedDataIndex();
    let fg = this._cachedFg();
    let bg = this._cachedBg();
    let styleFlagsIndex = this._cachedStyleFlagsIndex();
    let todo = index - curColumn;
    let word;
    let kind;
    let content = 0;
    while (todo >= 0) {
      if (idata >= this._dataLength) {
        word = NULL_DATA_WORD;
        kind = DataKind.SKIP_COLUMNS;
        content = (NULL_CELL_WIDTH << Content.WIDTH_SHIFT) | NULL_CELL_CODE;
        break;
      }
      word = this._data[idata];
      kind = BufferLine.wKind(word);
      let w;
      switch (kind) {
        case DataKind.FG:
          fg = word & 0x3FFFFFF;
          idata++;
          break;
        case DataKind.BG:
          bg = word & 0x3FFFFFF;
          idata++;
          break;
        case DataKind.STYLE_FLAGS:
          idata++;
          styleFlagsIndex = idata;
          break;
        case DataKind.SKIP_COLUMNS:
          let wlen = BufferLine.wSkipCount(word);
          if (todo >= wlen) {
            todo -= wlen;
            idata++;
            curColumn += wlen;
          } else {
            content = (NULL_CELL_WIDTH << Content.WIDTH_SHIFT) | NULL_CELL_CODE;
            todo = -1;
          }
          break;
        case DataKind.CLUSTER_START_w1:
        case DataKind.CLUSTER_START_w2:
          w = kind + 1 - DataKind.CLUSTER_START_w1;
          if (todo >= w) {
            const clEnd = this.clusterEnd(idata);
            todo -= w;
            curColumn += w;
            idata = clEnd;
          } else {
            content = index !== curColumn ? 0
              : (w << Content.WIDTH_SHIFT) | Content.IS_COMBINED_MASK;
            todo = -1;
          }
          break;
        case DataKind.CHAR_w1:
        case DataKind.CHAR_w2:
          w = kind + 1 - DataKind.CHAR_w1; // 1, or 2 if wide characters
          if (todo >= w) {
            todo -= w;
            idata++;
            curColumn += w;
          } else {
            todo = -1;
            content = index !== curColumn ? 0
              : (w << Content.WIDTH_SHIFT) | (word & 0x1fffff);
          }
          break;
      }
    }
    this._cacheSetColumnDataIndex(curColumn, idata);
    this._cacheSetFgBg(fg, bg);
    this._cacheSetStyleFlagsIndex(styleFlagsIndex);
    return content;
  }

  /**
   * Load data at `index` into `cell`. This is used to access cells in a way that's more friendly
   * to GC as it significantly reduced the amount of new objects/references needed. @deprecated
   */
  public loadCell(index: number, cell: ICellData): ICellData {
    const cursor = cell as CellData;
    const content = this.moveToColumn(index);
    cursor.content = content;
    cursor.setFg(this._cachedFg());
    cursor.setBg(this._cachedBg());
    let styleFlagsIndex = this._cachedStyleFlagsIndex();
    const word = styleFlagsIndex > 0 ? this._data[styleFlagsIndex - 1] : 0;
    cursor.setStyleFlags(word);
    if (word & StyleFlags.HAS_EXTENDED) {
      cursor.extended = this._extendedAttrs[styleFlagsIndex - 1]!;
    }
    if (content & Content.IS_COMBINED_MASK) {
      // FIXME do this lazily, in CellData.getChars
      let idata = this._cachedDataIndex();
      const str = utf32ToString(this._data, idata, this.clusterEnd(idata));
      cursor.combinedData = str;
    }
    return cell;
  }

  public deleteCells(pos: number, n: number, fillCellData: ICellData): void {
    const content = this.moveToColumn(pos);
    let idata = this._cachedDataIndex();
    let curColumn = this._cachedColumn();
    this.deleteCellsOnly(idata, 0, n);
    // FIXME
    this.lineEndBg = fillCellData.bg;
  }

  // FIXME doesn't properly handle if delete range starts or ends in middle
  // of wide character
  /** Internal - delete n columns, with adjust at end of line. */
  public deleteCellsOnly(idata0: number, colOffset0: number, n: number): void {
    let todo = n;
    let idata = idata0;
    let colOffset = colOffset0;
    let word0 = this._data[idata];
    let dskip_first = idata, dskip_last = -1, tskip_first = -1, tskip_last = -1, w;
    let fgValue = -1; //cursor.getFg();
    let bgValue = -1; //cursor.getBg();
    let styleValue = -1; //cursor.getStyleFlags(); // FIXME handle extendedattrs
    /*
    if (colOffset === 0) {
      while (idata > 0) {
        let skipItem = true;
        switch (BufferLine.wKind(this._data[idata-1])) {
          case DataKind.BG: cursor.setBg(-1); break;
          case DataKind.FG: cursor.setFg(-1); break;
          case DataKind.STYLE_FLAGS: cursor.setStyleFlags(-1 as StyleFlags); break;
          default: skipItem = false;
        }
        if (skipItem) {
          idata--;
          dskip_first = idata;
          dskip_last = idata0-1;
        } else {
          break;
        }
      }
    }
    */
    for (; todo > 0 && idata < this._dataLength; idata++) {
      let word = this._data[idata];
      const kind = BufferLine.wKind(word);
      switch (kind) {
        case DataKind.FG: fgValue = word; break;
        case DataKind.BG: bgValue = word; break;
        case DataKind.STYLE_FLAGS:
          styleValue = word;
          // handle ExtendedAttrs FIXME
          break;
        case DataKind.SKIP_COLUMNS:
          let wlen = BufferLine.wSkipCount(word);
          if (colOffset === 0 && wlen <= todo) {
            dskip_last = idata;
            todo -= wlen;
          } else {
            let delta = Math.min(todo,  wlen - colOffset);
            this._data[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, wlen - delta);
            dskip_first = idata + 1;
            todo -= delta;
          }
          colOffset = 0;
          break;
        case DataKind.CHAR_w1:
        case DataKind.CHAR_w2:
          w = kind - DataKind.CHAR_w1; // 0, or 1 if wide characters
          if (colOffset === 0 && (1 << w) <= todo) {
            dskip_last = idata;
            todo -= 1 << w;
          } else {
            dskip_first = idata + 1;
            /*
            const delta = tend - tstart;
            this._data[idata] = BufferLine.wSet1(kind, wlen - delta);
            todo -= delta << w;
            */
          }
          break;
        case DataKind.CLUSTER_START_w1:
        case DataKind.CLUSTER_START_w2:
          w = kind - DataKind.CLUSTER_START_w1; // 0, or 1 if wide characters
          const clEnd = this.clusterEnd(idata);
          if (colOffset < (1 << w)) {
            idata = clEnd;
            dskip_last = idata;
            todo -= (1 << w);
          } else {
            dskip_first = idata + 1;
          }
          colOffset = 0;
          break;
      }
    }
    idata0 = dskip_first;
    if (bgValue >= 0) {
      this._data[idata0++] = BufferLine.wSet1(DataKind.BG, bgValue);
    }
    if (fgValue >= 0) {
      this._data[idata0++] = BufferLine.wSet1(DataKind.FG, fgValue);
    }
    if (styleValue >= 0) {
      this._data[idata0++] = BufferLine.wSet1(DataKind.STYLE_FLAGS, styleValue);
    }
    if (dskip_last >= 0) {
      // FIXME maybe use addEmptyDataElements with negative count
      this._data.copyWithin(idata0, dskip_last + 1, this._dataLength);
      // FIXME also adjust _extendedAttr indexes
      this._dataLength -= dskip_last + 1 - idata0;
    }
  }

  /**
   * Move cursor forward the specified number of columns.
   * After, getChars() is the last character whose start edge is traversed.
   */
  scanNext(cell: ICellData, n: number = 1, flags: number = 0): number {
    const cursor = cell as CellData;
    let idata = BufferLine.dataIndex(cursor);
    let col = BufferLine.columnOffset(cursor);
    let todo = n;
    while (idata < this._dataLength) {
      const word = this._data[idata];
      const kind = BufferLine.wKind(word);
      let w;
      switch (kind) {
        case DataKind.FG:
          cursor.setFg(word);
          idata++;
          break;
        case DataKind.BG:
          cursor.setBg(word);
          idata++;
          break;
        case DataKind.STYLE_FLAGS:
          cursor.setStyleFlags(word);
          if (word & StyleFlags.HAS_EXTENDED) {
            cursor.extended = this._extendedAttrs[idata]!;
          }
          idata++;
          break;
        case DataKind.SKIP_COLUMNS:
          let wlen = BufferLine.wSkipCount(word);
          if (col + todo > wlen) {
            todo -= wlen - col;
            col = 0;
            idata++;
          } else {
            //this._setChars(cursor, 0, 0, 1);
            BufferLine.setPosition(cursor, idata, -1, col + todo);
            return 0;
          }
          break;
        case DataKind.CLUSTER_START_w1:
        case DataKind.CLUSTER_START_w2:
          w = kind + 1 - DataKind.CLUSTER_START_w1;
          let clEnd = this.clusterEnd(idata);
          if (col + todo > w) {
            todo -= w - col;
            col = 0;
            idata = clEnd;
          } else {
            // FIXME do this lazily, in CellData.getChars
            const str = utf32ToString(this._data, idata, clEnd);
            cursor.combinedData = str;
            BufferLine.setPosition(cursor, clEnd, -1, col + todo);
            cursor.content = col !== 0 ? 0
              : (w << Content.WIDTH_SHIFT) | Content.IS_COMBINED_MASK;
            return 0;
          }
          break;
        case DataKind.CHAR_w1:
        case DataKind.CHAR_w2:
          w = kind + 1 - DataKind.CHAR_w1; // 1, or 2 if wide characters
          if (col + todo > w) {
            todo -= w - col;
            idata++;
            col = 0;
          } else {
            const wshift = w > 1 ? 1 : 0;
            cell.content = col !== 0 ? 0
              : w << Content.WIDTH_SHIFT | (word & 0x1fffff);
            col += todo;
            BufferLine.setPosition(cursor, idata, -1, col);
            return 0;
          }
          break;
      }
    }
    cursor.content = (NULL_CELL_WIDTH << Content.WIDTH_SHIFT) | NULL_CELL_CODE;
    BufferLine.setPosition(cursor, idata, -1, todo);
    cursor.setBg(this.lineEndBg);
    return todo;
  }

  private preInsert(index: number, attrs: IAttributeData): boolean {
    let content = this.moveToColumn(index);
    let curColumn = this._cachedColumn();
    const startColumn = curColumn;
    let idata = this._cachedDataIndex();

    // CASES:
    // 1. idata === _dataLength - easy.
    // 2. _data[idata] is SKIP_COLUMNS
    // -- split if curColumnn > 0 && curColumn < wlen
    // 3. kind is wKindIsText:
    // a. curColumn===index
    // b. index === curColumn + width
    // c. otherwise - in middle of wide char

    // split if in middle of wide FIXME
    if ((content >> Content.WIDTH_SHIFT) === 2
      && index === curColumn + 1) {
      // In the middle of a wide character. Well-behaved applications are
      // unlikely to do this, so it's not worth optimizing.
      const clEnd = this.clusterEnd(idata);
      this.addEmptyDataElements(idata, idata - clEnd - 1);
      this._data[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, 2);
    }
    // FIXME handle after _dataLength or in SKIP_COILUMNS

    // set attributes
    const newFg = attrs.getFg();
    const newBg = attrs.getBg();
    const newStyle = attrs.getStyleFlags();
    const oldFg = this._cachedFg();
    const oldBg = this._cachedBg();
    let styleFlagsIndex = this._cachedStyleFlagsIndex();
    const oldStyle = styleFlagsIndex > 0 ? this._data[styleFlagsIndex - 1] : 0;
    const needFg = newFg !== oldFg;
    const needBg = newBg !== oldBg
    // FIXME let oldExt = (oldStyle & StyleFlags.HAS_EXTENDED) && cell.extended;
    //let newExt = (newStyle & StyleFlags.HAS_EXTENDED) && attrs.extended;
    const needStyle = newStyle !== oldStyle // FIXME || oldExt !== newExt;
    const atEnd = idata === this._dataLength;
    let add1 = atEnd ? 1 : 2;
    let add = (needBg?add1:0) + (needFg?add1:0) + (needStyle?add1:0);

    if (add) {
      this.addEmptyDataElements(idata, add);
      if (needFg) {
        this._data[idata++] = BufferLine.wSet1(DataKind.FG, newFg);
      }
      if (needBg) {
        this._data[idata++] = BufferLine.wSet1(DataKind.BG, newBg);
      }
      if (needStyle) {
        if (newStyle & StyleFlags.HAS_EXTENDED)
          this._extendedAttrs[idata] = attrs.extended;
        this._cacheSetStyleFlagsIndex(idata);
        this._data[idata++] = BufferLine.wSet1(DataKind.STYLE_FLAGS, newStyle);
      }
      this._cacheSetColumnDataIndex(index, idata);
      let xdata = idata; // FIXME
      if (! atEnd) {
        if (needFg) {
          this._data[xdata++] = BufferLine.wSet1(DataKind.FG, oldFg);
        }
        if (needStyle) {
          this._data[xdata++] = BufferLine.wSet1(DataKind.STYLE_FLAGS, oldStyle);
        }
        if (needBg) {
          this._data[xdata++] = BufferLine.wSet1(DataKind.BG, oldBg);
        }
      }
      this._cacheSetFgBg(newFg, newBg);
    }
    return add > 0;
  }

  public insertText(index: number, data: Uint32Array, start: number, end: number, attrs: IAttributeData, inputHandler: IInputHandler, insertMode: boolean): number {
    const add = this.preInsert(index, attrs);
    let curColumn = this._cachedColumn();
    const startColumn = curColumn;
    let idata = this._cachedDataIndex();
    let precedingJoinState = inputHandler.precedingJoinState;
    let inext;
    if (add || idata === this._dataLength || index === curColumn)
        inext = idata;
    else {
        const kind = BufferLine.wKind(this._data[idata]);
        if (BufferLine.wKindIsText(kind))
            inext = this.clusterEnd(idata);
        else
            inext = idata;
    }
    // FIXME optimize of overwriting simple text in-place
    this.addEmptyDataElements(inext, end - start);

    let cellColumn = curColumn;
    for (let i = start; i < end; i++) {
      // inext is the insertion point for the current codepoint
      // idata is the start of the most recent character or cluster,
      // assuming all codepoints from idata until inext are the same cluster.
      // If there is no preceding character/cluster that can be added to,
      // then idata === inext.
      const code = data[i];
      const currentInfo = inputHandler.unicodeService.charProperties(code, precedingJoinState);
      const chWidth = UnicodeService.extractWidth(currentInfo);
      const shouldJoin = UnicodeService.extractShouldJoin(currentInfo);
      const oldWidth = shouldJoin ? UnicodeService.extractWidth(precedingJoinState) : 0;
      precedingJoinState = currentInfo;
      let kind;
      if (shouldJoin) {
        kind = chWidth === 2 ? DataKind.CLUSTER_START_w2 : DataKind.CLUSTER_START_w1;
        const oldCount = (this._data[idata] >> 21) & 0x3F;
        const startChar = this._data[idata] & 0x1FFFFF;
        // FIXME check for count overflow;
        this._data[idata] = BufferLine.wSet1(kind,
          startChar + ((oldCount + 1) << 21));
        kind = DataKind.CLUSTER_CONTINUED;
        curColumn += chWidth - oldWidth;
      } else {
        kind = chWidth === 2 ? DataKind.CHAR_w2 : DataKind.CHAR_w1;
        idata = inext;
        cellColumn = curColumn;
        curColumn += chWidth;
      }
      this._data[inext++] = BufferLine.wSet1(kind, code);
    }
    inputHandler.precedingJoinState = precedingJoinState;
    this._cacheSetColumnDataIndex(cellColumn, idata);
    if (! insertMode && idata < this._dataLength) {
      this.deleteCellsOnly(inext, 0, curColumn - startColumn);
    }
    return curColumn;
  }

  public setCellFromCodepoint(index: number, codePoint: number, width: number,  attrs: IAttributeData): void {
    if (codePoint === NULL_CELL_CODE) {
      if (width === 0) { // i.e. combining character
        // FIXME - usually a no-open
      } else { // width === 1 - i.e spacing
        // FIXME
      }
      return;
    }
    const add = this.preInsert(index, attrs);
    let curColumn = this._cachedColumn();
    const startColumn = curColumn;
    let idata = this._cachedDataIndex();
    let inext;
    if (add || idata === this._dataLength || index === curColumn)
        inext = idata;
    else {
        const kind = BufferLine.wKind(this._data[idata]);
        if (BufferLine.wKindIsText(kind))
            inext = this.clusterEnd(idata);
        else
            inext = idata;
    }
    // FIXME optimize of overwriting simple text in-place
    this.addEmptyDataElements(inext, 1);

    let cellColumn = curColumn;
    let kind = width === 2 ? DataKind.CHAR_w2 : DataKind.CHAR_w1;
    idata = inext;
    cellColumn = curColumn;
    curColumn += width;
    this._data[inext++] = BufferLine.wSet1(kind, codePoint);
    this._cacheSetColumnDataIndex(cellColumn, idata);
    if (idata < this._dataLength) {
      this.deleteCellsOnly(inext, 0, curColumn - startColumn);
    }
  }

  public replaceCells(start: number, end: number, fillCellData: ICellData, respectProtect: boolean = false): void {
    if (! respectProtect && fillCellData.getCode() === 0) {
      // FIXME optimize
    }
    super.replaceCells(start, end, fillCellData, respectProtect);
  }

  // DEPRECATED
  public addCodepointToCell(index: number, codePoint: number, width: number): void {
    const content = this.moveToColumn(index);
    const idata = this._cachedDataIndex();
    const clEnd = this.clusterEnd(idata);
    this.addEmptyDataElements(clEnd, 1);
    const nContinued = clEnd - idata;
    const startChar = this._data[idata] & 0x1FFFFF;
    const kind = width === 2 ? DataKind.CLUSTER_START_w2 : DataKind.CLUSTER_START_w1;
    this._data[idata] = BufferLine.wSet1(kind,
                                         startChar + (nContinued << 21));
    this._data[clEnd] = BufferLine.wSet1(DataKind.CLUSTER_CONTINUED, codePoint);
  }

  public eraseAll(bg: number): void {
    // FIXME sometimes better to reuse old _data.
    this._data = EMPTY_DATA;
    this._dataLength = 0;
    this.lineEndBg = bg;
  }

  // deprecated
  public deleteCols(cursor: CellData, n: number, bg: number, endCol: number): void {
    this.fixSplitWide(cursor);
    let todo = n;
    /*
    const save_stateA = cursor._stateA;
    const save_stateB = cursor._stateB;
    const save_stateM = cursor._stateM;
    const save_stateN = cursor._stateN;
    this.scanNext(cursor, n, 0);
    this.fixSplitWide(cursor);
    */

    let idata0 = BufferLine.dataIndex(cursor);
    let idata = idata0;
    const colOffset0 = BufferLine.columnOffset(cursor);
    let colOffset = colOffset0;
    let word0 = this._data[idata];
    let dskip_first = idata, dskip_last = -1, tskip_first = -1, tskip_last = -1, w;
    let fgValue = -1; //cursor.getFg();
    let bgValue = -1; //cursor.getBg();
    let styleValue = -1; //cursor.getStyleFlags(); // FIXME handle extendedattrs
    /*
    if (colOffset === 0) {
      while (idata > 0) {
        let skipItem = true;
        switch (BufferLine.wKind(this._data[idata-1])) {
          case DataKind.BG: cursor.setBg(-1); break;
          case DataKind.FG: cursor.setFg(-1); break;
          case DataKind.STYLE_FLAGS: cursor.setStyleFlags(-1 as StyleFlags); break;
          default: skipItem = false;
        }
        if (skipItem) {
          idata--;
          dskip_first = idata;
          dskip_last = idata0-1;
        } else {
          break;
        }
      }
    }
    */
    for (; todo > 0 && idata < this._dataLength; idata++) {
      let word = this._data[idata];
      const kind = BufferLine.wKind(word);
      switch (kind) {
        case DataKind.FG: fgValue = word; break;
        case DataKind.BG: bgValue = word; break;
        case DataKind.STYLE_FLAGS:
          styleValue = word;
          // handle ExtendedAttrs FIXME
          break;
        case DataKind.SKIP_COLUMNS:
          let wlen = BufferLine.wSkipCount(word);
          if (colOffset === 0 && wlen <= todo) {
            dskip_last = idata;
            todo -= wlen;
          } else {
            let delta = Math.min(todo,  wlen - colOffset);
            this._data[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, wlen - delta);
            dskip_first = idata + 1;
            todo -= delta;
          }
          colOffset = 0;
          break;
        case DataKind.CHAR_w1:
        case DataKind.CHAR_w2:
          w = kind - DataKind.CHAR_w1; // 0, or 1 if wide characters
          if (colOffset === 0 && (1 << w) <= todo) {
            dskip_last = idata;
            todo -= 1 << w;
          } else {
            dskip_first = idata + 1;
            /*
            const delta = tend - tstart;
            this._data[idata] = BufferLine.wSet1(kind, wlen - delta);
            todo -= delta << w;
            */
          }
          /*
          const tstart = (colOffset >> w);
          const tend = Math.min((colOffset + todo) >> w,  wlen);
          if (tskip_first < 0)
            tskip_first = itext + tstart;
          tskip_last = itext + tend;
          itext += wlen;
          colOffset = 0;
          */
          break;
        case DataKind.CLUSTER_START_w1:
        case DataKind.CLUSTER_START_w2:
          w = kind - DataKind.CLUSTER_START_w1; // 0, or 1 if wide characters
          const clEnd = this.clusterEnd(idata);
          if (colOffset < (1 << w)) {
            idata = clEnd;
            dskip_last = idata;
            todo -= (1 << w);
          } else {
            dskip_first = idata + 1;
          }
          /*
          if (colOffset === 0 && wlen << w <= todo) {
            dskip_first = dskip_first < 0 ? idata : dskip_first;
            dskip_last = idata;
            tskip_last = itext + wlen;
          } else {
            // FIXME - deleting part of grapheme
            wlen = Math.min((colOffset + todo) >> w,  wlen);
            tskip_last = itext + wlen;
            this._data[idata] = BufferLine.wSet1(kind, wlen);
          }
          if (tskip_first < 0)
            tskip_first = itext + (colOffset >> w);
          todo -= wlen << w;
          */
          colOffset = 0;
          break;
      }
    }
    //if (dskip_first >= 0) {
    idata0 = dskip_first;
    if (bgValue >= 0) {
      this._data[idata0++] = BufferLine.wSet1(DataKind.BG, bgValue);
    }
    if (fgValue >= 0) {
      this._data[idata0++] = BufferLine.wSet1(DataKind.FG, fgValue);
    }
    if (styleValue >= 0) {
      this._data[idata0++] = BufferLine.wSet1(DataKind.STYLE_FLAGS, styleValue);
    }
    if (dskip_last >= 0) {
      this._data.copyWithin(idata0, dskip_last + 1, this._dataLength);
      this._dataLength -= dskip_last + 1 - idata0;
    }
    const deleted = n - todo;
    idata = idata0;
    colOffset = colOffset0;
      //idata = BufferLine.dataIndex(cursor);
    /*
    if (idata !== this._dataLength && deleted > 0) {
      let word0 = this._data[idata];
        let kind0 = BufferLine.wKind(word0);

      //const wlen = BufferLine.wSkipCount(word0);
      // if kind of idata is SKIP_COLUMN, add deleted
      // if kind of idata-1 is SKIP_COLUMN, add deleted, adjust coloffset.
      if (kind0 === DataKind.SKIP_COLUMNS) {
        this._data[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS,
                                             BufferLine.wSkipCount(word0) + deleted);
      } else {
        this.splitWord(cursor, 1);
        idata = BufferLine.dataIndex(cursor);
        this._data[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, deleted)
      }
    }
    if (n === -1) {
      // deleted an extra column because we ended up inside a wide char
      // FIXME insert a SKIP_COLUMNS to compensate
    }
    */
    const atEnd = this.atLineEnd(cursor);
    if (endCol < 0) {
      this.lineEndBg = bg;
    } else {
        // save position; move to (endCol - n)
        // insert n blanks, with bg set (and fg/style otherwise clear)
        // restore position
    }
    /*
    if (bg !== cursor.getBg()) {
      this.splitWord(cursor, 1);
      idata = BufferLine.dataIndex(cursor);
      this._data[idata] = BufferLine.wSet1(DataKind.BG, bg);
      BufferLine.setPosition(cursor, idata + 1, itext, 0);
      cursor.bg = (bg & 0x3ffffff) | (cursor.bg & 0xfc000000);
      }
    */
    /*
    // handle fullwidth at pos:
    // - reset pos-1 if wide char
    // - reset pos if width==0 (previous second cell of a wide char)
    if (pos && this.getWidth(pos - 1) === 2) {
      this.setCellFromCodePoint(pos - 1, 0, 1, eraseAttr?.fg || 0, eraseAttr?.bg || 0, eraseAttr?.extended || new ExtendedAttrs());
    }
    if (this.getWidth(pos) === 0 && !this.hasContent(pos)) {
      this.setCellFromCodePoint(pos, 0, 1, eraseAttr?.fg || 0, eraseAttr?.bg || 0, eraseAttr?.extended || new ExtendedAttrs());
    }
    */
  }

  /** Fix if cursor is in the middle of a wide character or glyph.
   * Replace wide glyph by SKIP_COLUMNS.
   */
  public fixSplitWide(cell: ICellData): void {
    const cursor = cell as CellData;
    const colOffset = BufferLine.columnOffset(cursor);
    if ((colOffset & 1) === 0)
      return;
    let idata = BufferLine.dataIndex(cursor);
    const word = this._data[idata];
    const wkind = BufferLine.wKind(word);
    // replace wide character by SKIP_COLUMNS for 2 columns
    if (wkind === DataKind.CHAR_w2) {
      this._data[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, 2);
    } else if (wkind === DataKind.CLUSTER_START_w2) {
      this._data[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, 2);
      const clEnd = this.clusterEnd(idata);
      const shrink = clEnd - idata - 1;
      this.addEmptyDataElements(idata + 1, - shrink);
    }
    // Ideally, if _data[idata-1] or _data[idata+1] is also SKIP_COLUMNS
    // we should merge the SKIP_COLUMNS ("normalize").
  }

  /**
   * Resize BufferLine to `cols` filling excess cells with `fillCellData`.
   * The underlying array buffer will not change if there is still enough space
   * to hold the new buffer line data.
   * Returns a boolean indicating, whether a `cleanupMemory` call would free
   * excess memory (true after shrinking > CLEANUP_THRESHOLD).
   */
  public resize(cols: number, fillCellData: ICellData): boolean {
    /*
    if (cols === this.length) {
      return this._data.length * 4 * CLEANUP_THRESHOLD < this._data.buffer.byteLength;
    }
    const uint32Cells = cols * CELL_SIZE;
    if (cols > this.length) {
      if (this._data.buffer.byteLength >= uint32Cells * 4) {
        // optimization: avoid alloc and data copy if buffer has enough room
        this._data = new Uint32Array(this._data.buffer, 0, uint32Cells);
      } else {
        // slow path: new alloc and full data copy
        const data = new Uint32Array(uint32Cells);
        data.set(this._data);
        this._data = data;
      }
      for (let i = this.length; i < cols; ++i) {
        this.setCell(i, fillCellData);
      }
    } else {
      // optimization: just shrink the view on existing buffer
      this._data = this._data.subarray(0, uint32Cells);
      / *
      // Remove any cut off combined data
      const keys = Object.keys(this._combined);
      for (let i = 0; i < keys.length; i++) {
        const key = parseInt(keys[i], 10);
        if (key >= cols) {
          delete this._combined[key];
        }
      }
      // remove any cut off extended attributes
      const extKeys = Object.keys(this._extendedAttrs);
      for (let i = 0; i < extKeys.length; i++) {
        const key = parseInt(extKeys[i], 10);
        if (key >= cols) {
          delete this._extendedAttrs[key];
        }
        }
      * /
    }
    */
    this.length = cols;
    return this._dataLength * CLEANUP_THRESHOLD < this._data.length;
  }

  /**
   * Cleanup underlying array buffer.
   * A cleanup will be triggered if the array buffer exceeds the actual used
   * memory by a factor of CLEANUP_THRESHOLD.
   * Returns 0 or 1 indicating whether a cleanup happened.
   */
  public cleanupMemory(): number {
    if (this._dataLength * CLEANUP_THRESHOLD < this._data.length) {
      const data = new Uint32Array(this._data.length);
      data.set(this._data);
      this._data = data;
      return 1;
    }
    return 0;
  }

  /** fill a line with fillCharData */
  public fill(fillCellData: ICellData, respectProtect: boolean = false): void {
    this.replaceCells(0, this.length, fillCellData, respectProtect);
  }

  /** alter to a full copy of line  */
  public copyFrom(line: BufferLine): void {
    if (this.length !== line.length) {
      this._data = new Uint32Array(line._data);
    } else {
      // use high speed copy if lengths are equal
      this._data.set(line._data);
    }
    this._dataLength = line._dataLength;
    this.length = line.length;
    this._extendedAttrs = {};
    for (const el in line._extendedAttrs) {
      this._extendedAttrs[el] = line._extendedAttrs[el];
    }
    this.isWrapped = line.isWrapped;
  }

  /** create a new clone */
  public clone(): IBufferLine {
    const newLine = new BufferLine(0);
    newLine._data = new Uint32Array(this._data);
    newLine.length = this.length;
    newLine.isWrapped = this.isWrapped;
    return newLine;
  }

  public getTrimmedLength(): number {
    let cols = 0;
    let skipped = 0;
    for (let idata = 0; idata < this._dataLength; idata++) {
      const word = this._data[idata];
      const kind = BufferLine.wKind(word);
      const w = kind === DataKind.CHAR_w2 || kind === DataKind.CLUSTER_START_w2 ? 2 : 1;
      let wcols = 0;
      switch (kind) {
        case DataKind.FG:
        case DataKind.BG:
        case DataKind.STYLE_FLAGS:
          break;
        case DataKind.SKIP_COLUMNS:
          skipped += BufferLine.wSkipCount(word);
          break;
        case DataKind.CLUSTER_START_w1:
        case DataKind.CLUSTER_START_w2:
          wcols = w;
          break;
        case DataKind.CHAR_w1:
        case DataKind.CHAR_w2:
          wcols = w * 1;
          break;
        case DataKind.CLUSTER_CONTINUED:
          break;
      }
      if (wcols) {
        cols += skipped + wcols;
        skipped = 0;
      }
    }
    return cols;
  }

  public getNoBgTrimmedLength(): number {
    return this.getTrimmedLength(); // FIXME
    /*
    for (let i = this.length - 1; i >= 0; --i) {
      if ((this._data[i * CELL_SIZE + Cell.CONTENT] & Content.HAS_CONTENT_MASK) || (this._data[i * CELL_SIZE + Cell.BG] & Attributes.CM_MASK)) {
        return i + (this._data[i * CELL_SIZE + Cell.CONTENT] >> Content.WIDTH_SHIFT);
      }
    }
    return 0;
    */
  }

  public copyCellsFrom(src: BufferLine, srcCol: number, destCol: number, length: number, applyInReverse: boolean): void {
    // This is used by reflow (window resize). FUTURE: Integrate with pretty-printing.
    console.log('NOT IMPLEMENTED copyCellsFrom');
    /*
    const srcData = src._data;
    if (applyInReverse) {
      for (let cell = length - 1; cell >= 0; cell--) {
        for (let i = 0; i < CELL_SIZE; i++) {
          this._data[(destCol + cell) * CELL_SIZE + i] = srcData[(srcCol + cell) * CELL_SIZE + i];
        }
        if (srcData[(srcCol + cell) * CELL_SIZE + Cell.BG] & BgFlags.HAS_EXTENDED) {
          this._extendedAttrs[destCol + cell] = src._extendedAttrs[srcCol + cell];
        }
      }
    } else {
      for (let cell = 0; cell < length; cell++) {
        for (let i = 0; i < CELL_SIZE; i++) {
          this._data[(destCol + cell) * CELL_SIZE + i] = srcData[(srcCol + cell) * CELL_SIZE + i];
        }
        if (srcData[(srcCol + cell) * CELL_SIZE + Cell.BG] & BgFlags.HAS_EXTENDED) {
          this._extendedAttrs[destCol + cell] = src._extendedAttrs[srcCol + cell];
        }
      }
    }

    // Move any combined data over as needed, FIXME: repeat for extended attrs
    const srcCombinedKeys = Object.keys(src._combined);
    for (let i = 0; i < srcCombinedKeys.length; i++) {
      const key = parseInt(srcCombinedKeys[i], 10);
      if (key >= srcCol) {
        this._combined[key - srcCol + destCol] = src._combined[key];
      }
    }
  */
  }

  public translateToString(trimRight: boolean = false, startCol: number = 0, endCol: number = this.length, skipReplace: string = WHITESPACE_CELL_CHAR): string {
    let s = '';
    let col = 0;
    let pendingStart = -1;
    let pendingLength = 0;
    let pendingSkip = 0;
    //const text = this._text;
    const data = this._data;
    function pendingForce(handleSkip = ! trimRight): void {
      if (pendingStart >= 0 && pendingLength > 0) {
        s += utf32ToString(data, pendingStart, pendingStart + pendingLength);
        pendingLength = 0;
      } else if (handleSkip && pendingLength > 0) {
        s += skipReplace.repeat(pendingLength);
        pendingLength = 0;
      }
      pendingStart = -1;
    }
    function addPendingString(start: number, length: number): void {
      if (pendingStart >= 0 && pendingStart + pendingLength === start) {
        pendingLength += length;
      } else {
        pendingForce(true);
        pendingStart = start;
        pendingLength = length;
      }
    }
    function addPendingSkip(length: number): void {
      if (pendingStart >= 0) {
        pendingForce();
      }
      pendingLength += length;
    }
    for (let idata = 0; idata < this._dataLength && col < endCol; idata++) {
      const word = this._data[idata];
      const kind = BufferLine.wKind(word);
      const wide = kind === DataKind.CHAR_w2 || kind === DataKind.CLUSTER_START_w2 ? 1 : 0;
      let wcols;
      switch (kind) {
        case DataKind.FG:
        case DataKind.BG:
        case DataKind.STYLE_FLAGS:
          break;
        case DataKind.SKIP_COLUMNS:
          let wlen = BufferLine.wSkipCount(word);
          if (col + wlen > startCol) {
            if (col < startCol) {
              wlen -= startCol - col;
              col = startCol;
            }
            if (col + wlen > endCol) {
              wlen = endCol - col;
            }
            addPendingSkip(wlen);
          }
          col += wlen;
          break;
        case DataKind.CLUSTER_START_w1:
        case DataKind.CLUSTER_START_w2:
          let clEnd = this.clusterEnd(idata);
          wcols = 1 << wide;
          if (col >= startCol && col + wcols <= endCol) {
            addPendingString(idata, clEnd - idata);
          }
          idata = clEnd - 1;
          col += wcols;
          break;
        case DataKind.CHAR_w1:
        case DataKind.CHAR_w2:
          wcols = 1 << wide;
          if (col >= startCol && col + wcols <= endCol) {
            addPendingString(idata, 1);
          }
          col += wcols;
          break;
      }
    }
    if (! trimRight && col < endCol) {
      addPendingSkip(endCol - col);
    }
    pendingForce();
    return s;
  }
}
