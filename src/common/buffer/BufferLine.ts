/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { CharData, IBufferLine, ICellData, IAttributeData, IExtendedAttrs } from 'common/Types';
import { stringFromCodePoint } from 'common/input/TextDecoder';
import { CHAR_DATA_CHAR_INDEX, CHAR_DATA_WIDTH_INDEX, CHAR_DATA_ATTR_INDEX, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE, WHITESPACE_CELL_CHAR, Content, StyleFlags, BgFlags, FgFlags, Attributes } from 'common/buffer/Constants';
import { CellData } from 'common/buffer/CellData';
import { AttributeData, ExtendedAttrs } from 'common/buffer/AttributeData';

export const DEFAULT_ATTR_DATA = Object.freeze(new AttributeData());

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
  abstract deleteCols(cursor: CellData, n: number, bg: number): void;
  abstract insertCells(pos: number, n: number, fillCellData: ICellData, eraseAttr?: IAttributeData): void;
  abstract replaceCols(cursor: ICellData, count: number, fillCellData: ICellData, respectProtect?: boolean): void;
  // abstract addCodepointToCell(index: number, codePoint: number): void;
  abstract addToPrecedingGrapheme(cursor: ICellData, newText: string, width: number): void;
  abstract previousCodePoint(cell: ICellData): number;
  abstract resize(cols: number, fillCellData: ICellData): boolean;
  abstract fill(fillCellData: ICellData, respectProtect: boolean): void;
  abstract copyFrom(line: BufferLine): void;
  abstract clone(): IBufferLine;
  abstract translateToString(trimRight: boolean, startCol: number, endCol: number): string;
  abstract getTrimmedLength(): number;
  abstract getNoBgTrimmedLength(): number;
  abstract _getChars(cursor: CellData): string;
  abstract cleanupMemory(): number;

  scanMove(cursor: ICellData, column: number): void {
    // FUTURE - optimize to reuse cursor position.
    // However, have to deal with invalidation, perhaps using DirtyTracker.
    // if (cursor.lineBuffer === this && column >= cursor.column ) ... scanNext(cursor, cursor - cursor.column)
    this.scanInit(cursor);
    this.scanNext(cursor, column, 0);
  }

  /**
   * Load data at `index` into `cell`. This is used to access cells in a way that's more friendly
   * to GC as it significantly reduced the amount of new objects/references needed. @deprecated
   */
  public loadCell(index: number, cell: ICellData): ICellData {
    this.scanInit(cell);
    this.scanNext(cell, index + 1, 0);
    return cell;
  }

  replaceCells(start: number, end: number, fillCellData: ICellData, respectProtect: boolean = false): void {
    let cursor = new CellData();
    this.scanInit(cursor);
    this.scanNext(cursor, start, 0);
    this.replaceCols(cursor, end - start, fillCellData, respectProtect);
  }

 /**
   * Get cell data CharData.
   * @deprecated
   */
  get(index: number): CharData {
    let cursor = new CellData();
    this.scanInit(cursor);
    this.scanNext(cursor, index, 0);
    return cursor.getAsCharData();
  }

 /**
   * Set cell data from CharData.
   * @deprecated
   */
  public set(index: number, value: CharData): void {
    // ???
    this.setCellFromCodePoint(index,
                              value[CHAR_DATA_CHAR_INDEX].charCodeAt(0),
                              value[CHAR_DATA_WIDTH_INDEX],
                              value[CHAR_DATA_ATTR_INDEX],
                              0, new ExtendedAttrs());
    /*
    this._data[index * CELL_SIZE + Cell.FG] = value[CHAR_DATA_ATTR_INDEX];
    if (value[CHAR_DATA_CHAR_INDEX].length > 1) {
      //this._combined[index] = value[1]; FIXME
      this._data[index * CELL_SIZE + Cell.CONTENT] = index | Content.IS_COMBINED_MASK | (value[CHAR_DATA_WIDTH_INDEX] << Content.WIDTH_SHIFT);
    } else {
      this._data[index * CELL_SIZE + Cell.CONTENT] = value[CHAR_DATA_CHAR_INDEX].charCodeAt(0) | (value[CHAR_DATA_WIDTH_INDEX] << Content.WIDTH_SHIFT);
    }
    */
  }

  /**
   * primitive getters
   * @deprecated use these when only one value is needed, otherwise use `loadCell`
   */
  public getWidth(index: number): number {
    return this.loadCell(index, new CellData()).content >>> Content.WIDTH_SHIFT;
  }

  /** Test whether content has width. @deprecated */
  public hasWidth(index: number): number {
    return this.loadCell(index, new CellData()).content & Content.WIDTH_MASK;
  }

  /** Get FG cell component. @deprecated */
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

  public setCellFromCodePoint(index: number, codePoint: number, width: number, fg: number, bg: number, eAttrs: IExtendedAttrs): void {
    const cursor = new CellData();
    this.scanInit(cursor);
    this.scanNext(cursor, index, 0);
    this.setFromCodePoint(cursor, codePoint, width, fg, bg, eAttrs);
  }

  /**
   * Set data at `index` to `cell`.
   */
  public setCell(index: number, cell: ICellData): void {
      this.setCellFromCodePoint(index, cell.content, cell.getWidth(), cell.fg, cell.bg, cell.extended);
  }

  /**
   * Set cell data from input handler.
   * Since the input handler see the incoming chars as UTF32 codepoints,
   * it gets an optimized access method.
   */
    public setFromCodePoint(cursor: ICellData, codePoint: number, width: number, fg: number, bg: number, eAttrs: IExtendedAttrs): void {
    this.setAttributes(cursor, fg, bg, eAttrs);
    this.setCodePoint(cursor, codePoint, width);
  }

  abstract setAttributes(cursor: ICellData, fg: number, bg: number, eAttrs: IExtendedAttrs): void;
  abstract setCodePoint(cursor: ICellData, codePoint: number, width: number): void;

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

  public deleteCells(pos: number, n: number, fillCellData: ICellData): void {
    pos %= this.length;
    let cursor = new CellData();
    this.scanInit(cursor);
    this.scanNext(cursor, pos, 0);
    this.deleteCols(cursor, n, fillCellData.bg);
  }

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
  SKIP_COLUMNS = 4, // empty ("null") columns (20 bit count)

  // The following have 20 bits length (number of 16-bit code units).
  // Narrow vs wide assumes a monospace font.
  // Future: maybe support variable-width fonts; then treat all as narrow.
  TEXT_w1 = 5, // Text in basic plane, narrow, 1 character per grapheme
  TEXT_w2 = 6, // Text in basic plane, wide, 1 character per grapheme
  // The following have 20 bits length and 8 bits (high-order)
  // Grapheme-Cluster-Break Property Value (of the last codepoint).
  CLUSTER_w1 = 7, // single grapheme cluster, narrow (1 column)
  CLUSTER_w2 = 8, // single grapheme cluster, wide (2 columns)
  //GENERIC_TEXT = 4, // Text has not been checked for wide or clusters MAYBE UNNEEDED
}

const NULL_DATA_WORD = DataKind.SKIP_COLUMNS << 28;

export class BufferLine extends AbstractBufferLine implements IBufferLine {
  // Each item in _data is a 4-bit DataKind and 28 bits data.
  protected _data: Uint32Array;
  protected _dataLength: number; // active length of _data array
  protected _text: string;
  protected _extendedAttrs: {[index: number]: IExtendedAttrs | undefined} = {};
  public length: number;

  /** Index in _data of "current chunk". */
  private static dataIndex(cell: CellData): number { return cell._stateM; }
  /** Index in _text of start of string for "current chunk". */
  private static textIndex(cell: CellData): number { return cell._stateN; }

  /** The "current position" is this many columns into the current chunk.
   * If W is the wStrLen of the chunk, then valid values are:
   * 0..W (if TEXT_w1); 0..2*W (if TEXT_w2); 0..1 (if CLUSTER_w1);
   * 0..2 (if CLUSTER_w2). (Odd values of TEXT_w2 or CLUSTER_w2 are only
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
  private static wKindIsText(kind: DataKind): boolean { return kind >= DataKind.TEXT_w1 && kind <= DataKind.CLUSTER_w2; }
  private static wKindIsTextOrSkip(kind: DataKind): boolean { return kind >= DataKind.SKIP_COLUMNS && kind <= DataKind.CLUSTER_w2; }
  /** From a Uint23 in _data, extract length of string within _text.
    * Assumes kind is TEXT_w1, TEXT_w2, CLUSTER_w1, CLUSTER W2. */
  private static wStrLen(word: number): number { return word & 0xfffff; }
  private static wSet1(kind: DataKind, value: number): number {
    return (kind << 28) | (value & 0x0fffffff);
  }
  //private static wSet2(kind: DataKind, start: number, len: number): number { return (kind << 28) | (start & 0x3ffff) | ((len & 0x3dd) << 18); }

  scanInit(cursor: ICellData): void {
    const cell = cursor as CellData;
    cell.bufferLine = this;
    cell.fg = 0;
    cell.bg = 0;
    BufferLine.setPosition(cell, 0, 0, 0);
  }

  public _getChars(cursor: CellData): string {
    if (cursor.textStart === cursor.textEnd)
      return '';
    return this._text.substring(cursor.textStart, cursor.textEnd);
  }
  public _setChars(cell: CellData, textStart: number, textEnd: number, width: number): void {
    cell.textStart = textStart;
    cell.textEnd = textEnd;
    cell.content = width << Content.WIDTH_SHIFT;
    const numUnits = textEnd - textStart;
    if (numUnits === 1 || numUnits === 2) {
      const ch = this._text.codePointAt(textStart);
      if (ch && (numUnits === 1) === (ch <= 0xffff)) // single-character cluster
        cell.content |= ch;
    }
  }

  constructor(cols: number, fillCellData?: ICellData, public isWrapped: boolean = false) {
    super();
    // MAYBE: const buffer = new ArrayBuffer(0, { maxByteLength: 6 * cols });
    //const buffer = new ArrayBuffer(4 * cols, { maxByteLength: 6 * cols });
    this._data = new Uint32Array(cols);
    this._text = '';
    this._dataLength = 0;
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

  addEmptyDataElements(position: number, count: number): void {
    this.resizeData(this._dataLength + count);
    this._data.copyWithin(position + count, position, this._dataLength);
    this._dataLength += count;
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
      itext += wlen;
      if (itext > this._text.length)
         error("text length too big");
    };
    for (let idata = 0; idata < this._dataLength; idata++) {
      const word = this._data[idata];
      const wlen = BufferLine.wStrLen(word);
      const kind = BufferLine.wKind(word);
      switch (kind) {
        case DataKind.FG:
        case DataKind.BG:
          break;
        case DataKind.STYLE_FLAGS:
          break;
        case DataKind.SKIP_COLUMNS:
          break;
        case DataKind.CLUSTER_w1:
        case DataKind.CLUSTER_w2:
          incrementText(wlen);
          break;
        case DataKind.TEXT_w1:
        case DataKind.TEXT_w2:
          incrementText(wlen);
          break;
        default:
          error("invalid _dataKind");
      }
    }
    if (itext < this._text.length)
      error("text length too small");
  }

  _checkCursor(cell: CellData): void {
    function error(str: string) {
      console.log("ERROR: "+str);
    }
    let itext = BufferLine.textIndex(cell);
    let idata = BufferLine.dataIndex(cell);
    if (! (idata >= 0) || idata > this._dataLength)
      error("bad data index");
    if (! (itext >= 0) || itext > this._text.length)
      error("bad text index");
    if (idata < this._dataLength) {
      let word = this._data[idata];
      let kind = BufferLine.wKind(word);
      let wwidth = kind === DataKind.CLUSTER_w2 || kind === DataKind.TEXT_w2 ? 2 : 1;
      const wlen = BufferLine.wStrLen(word);
      let colOffset = BufferLine.columnOffset(cell);
      if (BufferLine.wKindIsTextOrSkip(kind)) {
        if (colOffset > wwidth * wlen)
          error("bad columnOffset");
      } else {
        error("cursor points to style word");
      }
    }
  }

  /**
   * Get cell data CharData.
   * @deprecated
   */
  public get(index: number): CharData {
    return this.loadCell(index, new CellData()).getAsCharData();
  }

  public setAttributes(cursor: ICellData, fg: number, bg: number, eAttrs: IExtendedAttrs): void {
    const cell = cursor as CellData;
    this.fixSplitWide(cell);
    let fg_flags = fg & 0xFC000000;
    let bg_flags = bg & 0xFC000000;
    let style_flags = (fg_flags >> 24) | (bg_flags >> 16);
    fg -= fg_flags;
    bg -= bg_flags;
    const needFg = fg !== cell.getFg();
    const needBg = bg !== cell.getBg();
    let oldExt = cell.hasExtendedAttrs() && cell.extended;
    let newExt = (style_flags & StyleFlags.HAS_EXTENDED) && eAttrs;
    const needStyle = style_flags !== cell.getStyleFlags() || oldExt !== newExt;
    let add = (needBg?1:0) + (needFg?1:0) + (needStyle?1:0);
    let idata = BufferLine.dataIndex(cell);

    if (add) {
      this.splitWord(cell, add);
      idata = BufferLine.dataIndex(cell);
      if (needFg) {
        this._data[idata++] = BufferLine.wSet1(DataKind.FG, fg);
        cell.fg = fg;
      }
      if (needBg) {
        this._data[idata++] = BufferLine.wSet1(DataKind.BG, bg);
        cell.bg = bg;
      }
      if (needStyle) {
        if (style_flags & StyleFlags.HAS_EXTENDED)
          this._extendedAttrs[idata] = eAttrs;
        this._data[idata++] = BufferLine.wSet1(DataKind.STYLE_FLAGS, style_flags);
        cell.setStyleFlags(style_flags);
      }
      let itext = BufferLine.textIndex(cell);
      BufferLine.setPosition(cell, idata, itext, 0);
    }
  }

  /**
   * Set character following the cursor.
   */
  public setCodePoint(cursor: ICellData, codePoint: number, width: number): void {
    const cell = cursor as CellData;
    let idata = BufferLine.dataIndex(cell);
    let itext = BufferLine.textIndex(cell);
    let word = idata < this._dataLength ? this._data[idata] : NULL_DATA_WORD;
    let kind = BufferLine.wKind(word);
    const wlen = BufferLine.wStrLen(word);
    let colOffset = BufferLine.columnOffset(cell);
    codePoint &= Content.HAS_CONTENT_MASK;
    if (codePoint === 0) {
      if (kind === DataKind.SKIP_COLUMNS && colOffset < wlen) {
      } else if (idata === this._dataLength) {
      } else if (kind === DataKind.SKIP_COLUMNS && colOffset === wlen) {
        this.deleteCols(cell, 1, -1/*???*/);
        this._data[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, wlen + 1);
      } else {
        this.deleteCols(cell, width, -1/*???*/);
        this.addEmptyDataElements(idata, 1);
        this._data[++idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, 1);
        BufferLine.setPosition(cell, idata, itext, 0);
        return;
      }
    }

    const newGlyph = stringFromCodePoint(codePoint);
    const newLength = newGlyph.length;
    if (newLength === 1
        && ((kind === DataKind.TEXT_w1 && width === 1)
            || (kind === DataKind.TEXT_w2 && width === 2
                && (colOffset & 1) === 0))) {
        if (width * colOffset >= wlen) {
          this.deleteCols(cell, width, -1/*???*/);
          this._data[idata] = BufferLine.wSet1(kind, wlen+1);
        }
        const charOffset = itext + (width == 2 ? colOffset >> 1 : colOffset);
        this._text = this._text.substring(0, charOffset)
            + newGlyph
            + this._text.substring(charOffset + 1);
    } else {
      this.deleteCols(cell, width, -1/*???*/);
        if (idata < this._dataLength && BufferLine.wKindIsTextOrSkip(kind)) {
          itext += wlen;
          this.splitWord(cell, 1);
          idata = BufferLine.dataIndex(cell);
        } else {
          this.addEmptyDataElements(idata, 1);
        }
      kind = newLength === 1
        ? (width == 2 ? DataKind.TEXT_w2 : DataKind.TEXT_w1)
        : (width == 2 ? DataKind.CLUSTER_w2 : DataKind.CLUSTER_w1);
      this._data[idata] = BufferLine.wSet1(kind, newLength);
      this._text = this._text.substring(0, itext)
          + newGlyph
          + this._text.substring(itext);
      colOffset = 0;
    }
    BufferLine.setPosition(cell, idata, itext, colOffset);
  }

  // MERGE INTO setCluster
  /**
   * Add a codepoint to a cell from input handler.
   * During input stage combining chars with a width of 0 follow and stack
   * onto a leading char. Since we already set the attrs
   * by the previous `setDataFromCodePoint` call, we can omit it here.
   */
  public addToPrecedingGrapheme(cell: ICellData, newText: string, width: number): void {
    const cursor = cell as CellData;
    let itext = BufferLine.textIndex(cursor);
    let idata = BufferLine.dataIndex(cursor);
    const colOffset = BufferLine.columnOffset(cursor);
    if (idata >= this._dataLength || colOffset === 0) {
        return;
    }
    let word = this._data[idata];
    let kind = BufferLine.wKind(word);
    let oldWidth =
      (kind === DataKind.TEXT_w2 || kind === DataKind.CLUSTER_w2) ? 2 : 1;
    const newWidth = Math.max(oldWidth, width);
    const at = itext + colOffset;
    this._text = this._text.substring(0, at) + newText
          + this._text.substring(at);
    const wlen = BufferLine.wStrLen(word);
    const newLength = newText.length;
    if (kind === DataKind.CLUSTER_w1 || kind === DataKind.CLUSTER_w2) {
      if (colOffset !== oldWidth) {
        return;
      }
      kind = width >= 2 ? DataKind.CLUSTER_w2 : kind;
      this._data[idata] = BufferLine.wSet1(kind, BufferLine.wStrLen(word) + newLength);
    } else if (kind === DataKind.TEXT_w1 || kind === DataKind.TEXT_w2) {
      if (colOffset !== wlen * oldWidth) {
        return;
      }
      BufferLine.setPosition(cursor, idata, itext, colOffset - oldWidth);
      this.splitWord(cursor, 0);
      idata = BufferLine.dataIndex(cursor);
      itext = BufferLine.textIndex(cursor);
      kind = newWidth >= 2 ?  DataKind.CLUSTER_w2 : DataKind.CLUSTER_w1;
      word = this._data[idata];
      this._data[idata] = BufferLine.wSet1(kind, BufferLine.wStrLen(word) + newLength);
    } else {
      return;
    }
    BufferLine.setPosition(cursor, idata, itext, newWidth);
    /*
    let content = this._data[index * CELL_SIZE + Cell.CONTENT];
    if (content & Content.IS_COMBINED_MASK) {
      // we already have a combined string, simply add
      this._combined[index] += stringFromCodePoint(codePoint);
    } else {
      if (content & Content.CODEPOINT_MASK) {
        // normal case for combining chars:
        //  - move current leading char + new one into combined string
        //  - set combined flag
        this._combined[index] = stringFromCodePoint(content & Content.CODEPOINT_MASK) + stringFromCodePoint(codePoint);
        content &= ~Content.CODEPOINT_MASK; // set codepoint in buffer to 0
        content |= Content.IS_COMBINED_MASK;
      } else {
        // should not happen - we actually have no data in the cell yet
        // simply set the data in the cell buffer with a width of 1
        content = codePoint | (1 << Content.WIDTH_SHIFT);
      }
      this._data[index * CELL_SIZE + Cell.CONTENT] = content;
    }
    */
  }

  // MERGE INTO addToPrecedingGrapheme
  public setCluster(cursor: ICellData, addToPrevious: boolean, newText: string, width: number): void {
    const cell = cursor as CellData;
    const kind = width === 2 ? DataKind.CLUSTER_w2 : DataKind.CLUSTER_w1;
    this.deleteCols(cell, width, -1/*???*/);
    this.splitWord(cell, addToPrevious ? 0 : 1);
    let idata = BufferLine.dataIndex(cell);
    let itext = BufferLine.textIndex(cell);
    if (addToPrevious && idata < this._data.length) {
      const word = this._data[idata];
      const kind = BufferLine.wKind(word);
      if (kind === DataKind.CLUSTER_w1 || kind === DataKind.CLUSTER_w2) {
        this._data[idata] = BufferLine.wSet1(kind, BufferLine.wStrLen(word) + newText.length);
      } else if (kind === DataKind.TEXT_w1 || kind === DataKind.TEXT_w2){
      }
      // FIXME
    } else {
      this._data[idata] = BufferLine.wSet1(kind, newText.length);
    }
    this._text = this._text.substring(0, itext) + newText + this._text.substring(itext);
  }

  public insertCells(pos: number, n: number, fillCellData: ICellData, eraseAttr?: IAttributeData): void {
    alert("insertCells");
    /*
    pos %= this.length;

    // handle fullwidth at pos: reset cell one to the left if pos is second cell of a wide char
    if (pos && this.getWidth(pos - 1) === 2) {
      this.setCellFromCodePoint(pos - 1, 0, 1, eraseAttr?.fg || 0, eraseAttr?.bg || 0, eraseAttr?.extended || new ExtendedAttrs());
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
      this.setCellFromCodePoint(this.length - 1, 0, 1, eraseAttr?.fg || 0, eraseAttr?.bg || 0, eraseAttr?.extended || new ExtendedAttrs());
    }
    */
  }

 /** Split the the word referenced by 'cell' at the current colOffset.
   * Assumes wKindIsTextOrSkip(kind).
   */
  splitWord(cell: CellData, extraWordsToAdd: number): void {
    let idata = BufferLine.dataIndex(cell);
    let itext = BufferLine.textIndex(cell);
    const colOffset = BufferLine.columnOffset(cell);
    let add = extraWordsToAdd;
    if (colOffset === 0) {
      if (extraWordsToAdd) {
        this.addEmptyDataElements(idata, add);
        BufferLine.setPosition(cell, idata, itext, colOffset);
      }
    } else if (idata === this._dataLength) {
      this.addEmptyDataElements(idata, add + 1);
      this._data[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, colOffset);
      BufferLine.setPosition(cell, idata + 1, itext, 0);
    } else {
      const word = this._data[idata];
      const wlen = BufferLine.wStrLen(word);
      const kind = BufferLine.wKind(word);
      const atEnd = (kind === DataKind.TEXT_w1 || kind === DataKind.TEXT_w2)
            ? colOffset === wlen * (kind - DataKind.TEXT_w1 + 1)
            : colOffset === (kind - DataKind.CLUSTER_w1 + 1);
      if (atEnd) {
        if (extraWordsToAdd) {
          this.addEmptyDataElements(idata + 1, add);
        }
        idata++;
        itext += wlen;
      } else {
        const kind = BufferLine.wKind(word);
        this._data[idata] = BufferLine.wSet1(kind, colOffset);
        if (kind !== DataKind.SKIP_COLUMNS) {
          itext += colOffset;
        }
        idata++;
        this.addEmptyDataElements(idata, add + 1);
        this._data[idata+add] = BufferLine.wSet1(kind, wlen - colOffset);
      }
      BufferLine.setPosition(cell, idata, itext, 0);
    }
  }

  replaceCols(cursor: ICellData, count: number, fill: ICellData, respectProtect: boolean = false): void {
    this.fixSplitWide(cursor);
    const code = fill.getCode();
    const width = fill.getWidth();
    if (count <= 0)
      return;
    this.setAttributes(cursor, fill.fg, fill.bg, fill.extended);
    for (;;) {
      // FIXME check protected
      this.setCodePoint(cursor, code, width);
      if (--count <= 0)
        break;
      this.scanNext(cursor, 1, 0);
    }
    /*
    // full branching on respectProtect==true, hopefully getting fast JIT for standard case
    if (respectProtect) {
      if (start && this.getWidth(start - 1) === 2 && !this.isProtected(start - 1)) {
        this.setCellFromCodePoint(start - 1, 0, 1, eraseAttr?.fg || 0, eraseAttr?.bg || 0, eraseAttr?.extended || new ExtendedAttrs());
      }
      if (end < this.length && this.getWidth(end - 1) === 2 && !this.isProtected(end)) {
        this.setCellFromCodePoint(end, 0, 1, eraseAttr?.fg || 0, eraseAttr?.bg || 0, eraseAttr?.extended || new ExtendedAttrs());
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
      this.setCellFromCodePoint(start - 1, 0, 1, eraseAttr?.fg || 0, eraseAttr?.bg || 0, eraseAttr?.extended || newU733 ExtendedAttrs());
    }
    // handle fullwidth at last cell + 1: reset to empty cell if it is second part of a wide char
    if (end < this.length && this.getWidth(end - 1) === 2) {
      this.setCellFromCodePoint(end, 0, 1, eraseAttr?.fg || 0, eraseAttr?.bg || 0, eraseAttr?.extended || new ExtendedAttrs());
    }

    while (start < end  && start < this.length) {
      this.setCell(start++, fillCellData);
    }
  */
  }



  /**
   * Move cursor forward the specified number of columns.
   * After, getChars() is the last character whose start edge is traversed.
   */
  scanNext(cell: ICellData, n: number = 1, flags: number = 0): number {
    const cursor = cell as CellData;
    let idata = BufferLine.dataIndex(cursor);
    let itext = BufferLine.textIndex(cursor);
    let col = BufferLine.columnOffset(cursor);
    let todo = n;
    while (idata < this._dataLength) {
      const word = this._data[idata];
      const kind = BufferLine.wKind(word);
      const wlen = BufferLine.wStrLen(word);
      let w;
      switch (kind) {
        case DataKind.CLUSTER_w1:
        case DataKind.CLUSTER_w2:
          w = kind + 1 - DataKind.CLUSTER_w1;
          if (col + todo > w) {
            todo -= w - col;
            col = 0;
            idata++;
            itext += wlen;
          } else {
            if (col === 0)
              this._setChars(cursor, itext, itext+wlen, w);
            else
              this._setChars(cursor, 0, 0, 0);
            BufferLine.setPosition(cursor, idata, itext, col + todo);
            return 0;
          }
          break;
        case DataKind.FG:
          cursor.fg = (word & 0x3ffffff) | (cursor.fg & 0xfc000000);
          idata++;
          break;
        case DataKind.BG:
          cursor.bg = (word & 0x3ffffff) | (cursor.bg & 0xfc000000);
          idata++;
          break;
        case DataKind.STYLE_FLAGS:
          // FIXME
          idata++;
          break;
        case DataKind.SKIP_COLUMNS:
          if (col + todo > wlen) {
            todo -= wlen - col;
            col = 0;
            idata++;
          } else {
            this._setChars(cursor, 0, 0, 1);
            BufferLine.setPosition(cursor, idata, itext, col + todo);
            return 0;
          }
          break;
        case DataKind.TEXT_w1:
        case DataKind.TEXT_w2:
          w = kind + 1 - DataKind.TEXT_w1; // 1, or 2 if wide characters
          if (col + todo > w * wlen) {
            todo -= w * wlen - col;
            idata++;
            itext += wlen;
            col = 0;
          } else {
            col += todo;
            const wshift = w > 1 ? 1 : 0;
            const start = itext + ((col - 1) >> wshift);
            if (w > 1 && (col & 1) !== 0)
                this._setChars(cursor, 0, 0, 0);
            else
                this._setChars(cursor, start, start + 1, w);
            BufferLine.setPosition(cursor, idata, itext, col);
            return 0;
        }
      }
    }
    this._setChars(cursor, 0, 0, 1);
    BufferLine.setPosition(cursor, idata, itext, todo);
    return todo;
  }

  public previousCodePoint(cell: ICellData): number {
    const cursor = cell as CellData;
    const colOffset = BufferLine.columnOffset(cursor);
    let idata = BufferLine.dataIndex(cursor);
    let itext = BufferLine.textIndex(cursor);
    if (idata >= this._data.length)
      return -1;
    const word = this._data[idata];
    const kind = BufferLine.wKind(word);
    const width = (kind === DataKind.CLUSTER_w2 || kind === DataKind.TEXT_w2) ? 2 : 1;
    const wlen = BufferLine.wStrLen(word);
    switch (kind) {
      case DataKind.CLUSTER_w1:
      case DataKind.CLUSTER_w2:
        return colOffset !== width && this._text.codePointAt(itext) || -1;
      case DataKind.TEXT_w1:
      case DataKind.TEXT_w2:
        const charOffset = width == 2 ? colOffset >> 1 : colOffset;
        return colOffset == 0 || (width === 2 && (colOffset & 1) != 0) ? -1
                : this._text.codePointAt(itext + charOffset) || -1;
      default:
        return -1;
    }
  }

  public deleteCols(cursor: CellData, n: number, bg: number): void {
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

    let idata = BufferLine.dataIndex(cursor);
    let itext = BufferLine.textIndex(cursor);
    let colOffset = BufferLine.columnOffset(cursor);
    let word0 = this._data[idata];
    const wlen = BufferLine.wStrLen(word0);
    if (colOffset === 0) {
      while (idata > 0) {
        const prevKind = BufferLine.wKind(this._data[idata-1]);
        if (prevKind === DataKind.FG || prevKind === DataKind.BG
            || prevKind === DataKind.STYLE_FLAGS)
          idata--;
        else
          break;
      }
    }
    let fgValue = 0;
    let bgValue = 0;
    let styleValue = 0;
    let dskip_first = -1, dskip_last = 0, tskip_first = -1, tskip_last = -1, w;

    for (; todo > 0 && idata < this._dataLength; idata++) {
      let word = this._data[idata];
      const kind = BufferLine.wKind(word);
      let wlen = BufferLine.wStrLen(word);
      switch (kind) {
        case DataKind.FG: fgValue = word; break;
        case DataKind.BG: bgValue = word; break;
        case DataKind.STYLE_FLAGS:
          styleValue = word;
          // handle ExtendedAttrs FIXME
          break;
        case DataKind.SKIP_COLUMNS:
          if (colOffset === 0 && wlen <= todo) {
            dskip_first = dskip_first < 0 ? idata : dskip_first;
            dskip_last = idata;
            todo -= wlen;
          } else {
            let delta = Math.min(todo,  wlen - colOffset);
            this._data[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, wlen - delta);
            todo -= delta;
          }
          colOffset = 0;
          break;
        case DataKind.TEXT_w1:
        case DataKind.TEXT_w2:
          w = kind - DataKind.TEXT_w1; // 0, or 1 if wide characters
          const tstart = (colOffset >> w);
          const tend = Math.min((colOffset + todo) >> w,  wlen);
          if (colOffset === 0 && (wlen << w) <= todo) {
            dskip_first = dskip_first < 0 ? idata : dskip_first;
            dskip_last = idata;
            todo -= wlen << w;
          } else {
            const delta = tend - tstart;
            this._data[idata] = BufferLine.wSet1(kind, wlen - delta);
            todo -= delta << w;
          }
          if (tskip_first < 0)
            tskip_first = itext + tstart;
          tskip_last = itext + tend;
          itext += wlen;
          colOffset = 0;
          break;
        case DataKind.CLUSTER_w1:
        case DataKind.CLUSTER_w2:
          w = kind - DataKind.CLUSTER_w1; // 0, or 1 if wide characters
          if (colOffset < (1 << w)) {
            dskip_first = dskip_first < 0 ? idata : dskip_first;
            dskip_last = idata;
            if (tskip_first < 0)
              tskip_first = itext;
            tskip_last = itext + wlen;
            todo -= (1 << w);
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
          itext += wlen;
          colOffset = 0;
          break;
      }
    }
    if (tskip_first >= 0) {
      this._text = this._text.substring(0, tskip_first)
            + this._text.substring(tskip_last);
    }
    if (dskip_first >= 0) {
      this._data.copyWithin(dskip_first, dskip_last + 1, this._dataLength);
      this._dataLength -= dskip_last + 1 - dskip_first;
    }
    const deleted = n - todo;
    idata = BufferLine.dataIndex(cursor);
    if (idata !== this._dataLength && deleted > 0) {
      let word0 = this._data[idata];
      //const wlen = BufferLine.wStrLen(word0);
      // if kind of idata is SKIP_COLUMN, add deleted
      // if kind of idata-1 is SKIP_COLUMN, add deleted, adjust coloffset.
      if (BufferLine.wKind(word0) === DataKind.SKIP_COLUMNS) {
        this._data[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS,
                                             BufferLine.wStrLen(word0) + deleted);
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
    if (bg >= 0) {
      // FIXME
    }
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
    const itext = BufferLine.textIndex(cursor);
    const word = this._data[idata];
    const wkind = BufferLine.wKind(word);
    // replace wide character by SKIP_COLUMNS for 2 columns
    if (wkind === DataKind.TEXT_w2) {
      const wlen = BufferLine.wStrLen(word);
      const beforeLen = colOffset >> 1;
      const afterLen = wlen - beforeLen - 1;
      const expand = (beforeLen > 0 ? 1 : 0) + (afterLen > 0 ? 1 : 0);
      if (expand > 0)
        this.addEmptyDataElements(idata, expand);
      if (beforeLen > 0) {
        this._data[idata++] = BufferLine.wSet1(DataKind.TEXT_w2, beforeLen);
      }
      this._data[idata++] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, 2);
      if (afterLen > 0) {
        this._data[idata] = BufferLine.wSet1(DataKind.TEXT_w2, afterLen);
      }
      this._text = this._text.substring(0, beforeLen)
        + this._text.substring(beforeLen + 1)
      BufferLine.setPosition(cursor, idata - 1, beforeLen, 1);
    } else if (wkind === DataKind.CLUSTER_w2) {
      const wlen = BufferLine.wStrLen(word);
      this._data[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, 2);
      this._text = this._text.substring(0, itext)
            + this._text.substring(itext + wlen);
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
    this._text = line._text;
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
    newLine._text = this._text;
    newLine.length = this.length;
    newLine.isWrapped = this.isWrapped;
    return newLine;
  }

  public getTrimmedLength(): number {
    let cols = 0;
    let skipped = 0;
    const text = this._text;
    for (let idata = 0; idata < this._dataLength; idata++) {
      const word = this._data[idata];
      const kind = BufferLine.wKind(word);
      let wlen = BufferLine.wStrLen(word);
      const w = kind === DataKind.TEXT_w2 || kind === DataKind.CLUSTER_w2 ? 2 : 1;
      let wcols = 0;
      switch (kind) {
        case DataKind.FG:
        case DataKind.BG:
        case DataKind.STYLE_FLAGS:
          break;
        case DataKind.SKIP_COLUMNS:
          skipped += wlen;
          break;
        case DataKind.CLUSTER_w1:
        case DataKind.CLUSTER_w2:
          wcols = w;
          break;
        case DataKind.TEXT_w1:
        case DataKind.TEXT_w2:
          wcols = w * wlen;
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

  public translateToString(trimRight: boolean = false, startCol: number = 0, endCol: number = this.length): string {
    let s = '';
    let itext = 0;
    let col = 0;
    let pendingStart = -1;
    let pendingLength = 0;
    const text = this._text;
    function pendingForce(handleSkip = ! trimRight): void {
      if (pendingStart >= 0 && pendingLength > 0) {
        s += text.substring(pendingStart, pendingStart + pendingLength);
        pendingLength = 0;
      } else if (handleSkip && pendingLength > 0) {
        s += WHITESPACE_CELL_CHAR.repeat(pendingLength);
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
      let wlen = BufferLine.wStrLen(word);
      const wide = kind === DataKind.TEXT_w2 || kind === DataKind.CLUSTER_w2 ? 1 : 0;
      let wcols;
      switch (kind) {
        case DataKind.FG:
        case DataKind.BG:
        case DataKind.STYLE_FLAGS:
          break;
        case DataKind.SKIP_COLUMNS:
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
        case DataKind.CLUSTER_w1:
        case DataKind.CLUSTER_w2:
          wcols = 1 << wide;
          if (col >= startCol && col + wcols <= endCol) {
            addPendingString(itext, wlen);
          }
          itext += wlen;
          col += wcols;
          break;
        case DataKind.TEXT_w1:
        case DataKind.TEXT_w2:
          wcols = wlen << wide;
          if (col + wcols > startCol) {
            if (col < startCol) {
              const skip = (startCol - col) >> wide;
              wlen -= skip;
              wcols = wlen << wide;
              col = startCol;
              itext += skip;
            }
            if (col + wcols > endCol) {
              wlen = (endCol - col) >> wide;
            }
          }
          addPendingString(itext, wlen);
          itext += wlen;
          col += wlen << wide;
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
