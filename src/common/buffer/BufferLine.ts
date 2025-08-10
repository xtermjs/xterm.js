/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { CharData, IInputHandler, IAttributeData, IBufferLine, ICellData, IExtendedAttrs } from 'common/Types';
import { AttributeData } from 'common/buffer/AttributeData';
import { CellData } from 'common/buffer/CellData';
import { Attributes, BgFlags, CHAR_DATA_ATTR_INDEX, CHAR_DATA_CHAR_INDEX, CHAR_DATA_WIDTH_INDEX, Content, StyleFlags, NULL_CELL_CHAR, NULL_CELL_CODE, NULL_CELL_WIDTH, WHITESPACE_CELL_CHAR , UnderlineStyle } from 'common/buffer/Constants';
import { stringFromCodePoint, utf32ToString } from 'common/input/TextDecoder';
import { UnicodeService } from 'common/services/UnicodeService';
import { ICoreService } from 'common/services/Services';

export const DEFAULT_ATTR_DATA = Object.freeze(new AttributeData());

/** Column count within current visible row.
 * The left-most column is column 0.
 */
type RowColumn = number;

/** Column count within current logical line.
 * If the display is 80 columns wide, then LineColumn of the left-most
 * character of the first wrapped line would normally be 80.
 * (It might be 79 if the character at column 79 is double-width.)
 */
type LineColumn = number;

// Work variables to avoid garbage collection
let $startIndex = 0;

/** Factor when to cleanup underlying array buffer after shrinking. */
const CLEANUP_THRESHOLD = 2;

const enum DataKind { // 4 bits
  FG = 1, // lower 26 bits is RGB foreground color and CM_MASK
  BG = 2, // lower 26 bits is RGB background color and CM_MASK
  STYLE_FLAGS = 3, // lower 28 bits is StyleFlags

  SKIP_COLUMNS = 7, // empty ("null") columns (28 bit count)
  // The following have a 21-bit codepoint value in the low-order bits
  CHAR_W1 = 8, // single-non-compound, 1 column wide
  CHAR_W2 = 9, // single-non-compound, 2 columns wide
  // CLUSTER_START_xx have a 7=bit for number of CONTINUED entries
  CLUSTER_START_W1 = 10, // start of non-trivial cluster, 1 column wide
  CLUSTER_START_W2 = 11, // start of non-trivial cluster, 2 columns wide
  CLUSTER_CONTINUED = 12 // continuation of cluster
}

const NULL_DATA_WORD = DataKind.SKIP_COLUMNS << 28;

export abstract class BufferLine implements IBufferLine {
  /** Number of logical columns */
  public length: number = 0;
  public abstract get isWrapped(): boolean;
  public abstract cleanupMemory(): number;

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

  /**
   * Get codepoint of the cell. @deprecated
   * To be in line with `code` in CharData this either returns
   * a single UTF32 codepoint or the last codepoint of a combined string.
   */
  public getCodePoint(index: number): number {
    return this.loadCell(index, new CellData()).getCode();
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

  static make(cols: number, fillCellData?: ICellData, isWrapped: boolean = false): BufferLine {
    const line = new LogicalBufferLine(cols, fillCellData);
    if (isWrapped) {
      const wline = new WrappedBufferLine(line);
      if (fillCellData) { wline.replaceCells(0, cols, fillCellData); }
      return wline;
    }
    return line;
  }

  /** From a Uint23 in _data, extract the DataKind bits. */
  public static wKind(word: number): DataKind { return word >>> 28; }
  public static wKindIsText(kind: DataKind): boolean { return kind >= DataKind.CHAR_W1 && kind <= DataKind.CLUSTER_CONTINUED; }
  public static wKindIsTextOrSkip(kind: DataKind): boolean { return kind >= DataKind.SKIP_COLUMNS && kind <= DataKind.CLUSTER_CONTINUED; }
  /* Return 1 or 2 assuming wKindIsText(kind). */
  public static wTextWidth(kind: DataKind): number { return (kind & 1) + 1; }
  /** From a Uint23 in _data, extract length of string within _text.
   * Only for SKIP_COLUMNS. */
  public static wSkipCount(word: number): number { return word & 0xfffff; }
  /** Number of following CLUSTER_CONTINUED words.
   * Valid if wKindIsText(wKind(word)). Zero if CHAR_W1 or CHAR_W2.
   */
  public static wContinuedCount(word: number): number { return (word >> 21) & 0x3F}
  public static wSet1(kind: DataKind, value: number): number {
    return (kind << 28) | (value & 0x0fffffff);
  }
  nextRowSameLine: WrappedBufferLine | undefined;

  /** The "current" index into the _data array.
   * The index must be either dataLength() or wKindIsTextOrSkip must be true.
   * (The index never points to a CLUSTER_CONTINUED item.)
   */
  _cachedDataIndex(): number { return this.logicalLine()._cache1 >>> 16; }
  /** The logical column number corresponding to _cachedDataIndex(). */
  _cachedColumn(): LineColumn { return this.logicalLine()._cache1 & 0xFFFF; }
  protected abstract _cachedColumnInRow(): RowColumn;
  // private _cachedColOffset(): number { return this._cache3 >> 24; } // UNUSED
  abstract _cachedBg(): number;
  abstract _cachedFg(): number;
  // An index (in data()) of a STYLE_FLAGS entry; -1 if none.
  _cachedStyleFlagsIndex(): number { return this.logicalLine()._cache4; }
  protected _cacheReset(): void { const line = this.logicalLine(); line._cache1 = 0; line._cache2 = 0; line._cache3 = 0; line._cache4 = -1; }
  protected _cacheSetFgBg(fg: number, bg: number): void { const line = this.logicalLine(); line._cache2 = bg; line._cache3 = fg; }
  protected _cacheSetStyleFlagsIndex(index: number): void { this.logicalLine()._cache4 = index; }
  protected _cacheSetColumnDataIndex(column: LineColumn, dataIndex: number): void { this.logicalLine()._cache1 = (dataIndex << 16) | (column & 0xFFFF); }

  /*public setStartFromCacheX(wrapRow: WrappedBufferLine, column: LineColumn): void {
    wrapRow.startColumn = column;
    wrapRow.startIndex = this._cachedDataIndex();
    wrapRow.startIndexColumn = this._cachedColumn();
    wrapRow.startBg = this._cachedBg();
    wrapRow.startFg = this._cachedFg();
    wrapRow.startStyle = this._cachedStyleFlagsIndex();
  }*/

  // Length of data() array.
  abstract dataLength(): number;

  public abstract logicalLine(): LogicalBufferLine;
  public abstract logicalStartColumn(): LineColumn;
  protected abstract data(): Uint32Array;
  abstract resizeData(size: number): void;
  abstract addEmptyDataElements(position: number, count: number): void;
  protected shouldCleanupMemory(): boolean {
    return this.dataLength() * CLEANUP_THRESHOLD < this.data().length;
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
    const styleWord = styleIndex < 0 ? 0 : this.data()[styleIndex];
    return this._cachedFg() | ((styleWord << 24) & Attributes.STYLE_BITS_MASK);
  }

  /** Get BG cell component. @deprecated */
  public getBg(index: number): number {
    this.moveToColumn(index);
    const styleIndex = this._cachedStyleFlagsIndex();
    const styleWord = styleIndex < 0 ? 0 : this.data()[styleIndex];
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

  public showRowData(): string {
    return (this.isWrapped ? '(wrapped)' : '')
      + this.showData(this.logicalStartColumn(), this.nextRowSameLine ? this.nextRowSameLine?.logicalStartColumn() : Infinity);
  }
  /* Human-readable display of data() array, for debugging */
  public showData(startColumn = 0, endColumn = Infinity): string {
    let s = '';
    let curColumn = 0;
    const data = this.data();
    const lline = this.logicalLine();
    for (let i = 0; i < this.dataLength() && curColumn < endColumn; i++) {
      const word = data[i];
      const kind = BufferLine.wKind(word);
      let code: string | number = kind;
      const wnum = word & 0xfffffff;
      let nextColumn = curColumn;
      let skip = curColumn < startColumn;
      switch (kind) {
        case DataKind.FG: code = 'FG'; break;
        case DataKind.BG: code = 'BG'; break;
        case DataKind.STYLE_FLAGS: code = 'STYLE'; break;
        case DataKind.SKIP_COLUMNS: code = 'SKIP';
          nextColumn += wnum;
          skip = nextColumn <= startColumn;
          break;
        case DataKind.CLUSTER_START_W1: code = 'CL1'; nextColumn += 1; break;
        case DataKind.CLUSTER_START_W2: code = 'CL2'; nextColumn += 2; break;
        case DataKind.CLUSTER_CONTINUED: code = 'CL_CONT'; break;
        case DataKind.CHAR_W1: code = 'C1'; nextColumn += 1; break;
        case DataKind.CHAR_W2: code = 'C2'; nextColumn += 2; break;
      }

      if (! skip) {
        if (s) {
          s += ', ';
        }
        let value;
        if (kind === DataKind.CHAR_W1 || kind === DataKind.CHAR_W2) {
          let count = 1;
          const w = nextColumn - curColumn;
          while (curColumn + count * w < endColumn && i + count < this.dataLength() && BufferLine.wKind(this.data()[i + count]) === kind) {
            count++;
          }
          let str;
          if (count === 1) {
            str = stringFromCodePoint(word & 0x1fffff);
          } else {
            str = utf32ToString(this.data(), i, i + count);
            code = code + '*' + count;
            i += count - 1;
          }
          value = JSON.stringify(str);
          nextColumn = curColumn + count * w;
        } else if (kind === DataKind.CLUSTER_START_W1
            || kind === DataKind.CLUSTER_START_W2
            || kind === DataKind.CLUSTER_CONTINUED) {
          value = '#' + (word & 0x1fffff).toString(16);
        } else if (kind === DataKind.BG || kind === DataKind.FG) {
          value = (wnum >> 24) + '#' + (wnum & 0xffffff).toString(16);
        } else if (kind === DataKind.STYLE_FLAGS) {
          value = '#' + (wnum & 0xfffffff).toString(16);
          if (wnum & StyleFlags.HAS_EXTENDED) {
              const extended = lline._extendedAttrs[i];
              if (! extended) { value += " (missing ext)"; }
              else {
                  switch (extended.underlineStyle) {
                    case UnderlineStyle.SINGLE: value += " us:SINGLE"; break;
                    case UnderlineStyle.DOUBLE: value += " us:DOUBLE"; break;
                    case UnderlineStyle.CURLY: value += " us:CURLY"; break;
                    case UnderlineStyle.DOTTED: value += " us:DOTTED"; break;
                    case UnderlineStyle.DASHED: value += " us:DASHED"; break;
                  }
              }
          }
        } else if (kind === DataKind.SKIP_COLUMNS) {
          value = nextColumn <= endColumn ? wnum
          : `${endColumn - curColumn} of ${wnum}`;
        } else {
          value = wnum.toString();
        }
        s += code + ': ' + value;
        if (curColumn < startColumn) {
          s += ` offset ${startColumn - curColumn}`;
        }
      }
      curColumn = nextColumn;
    }
    return `[${s}]`;
  }

  /** Check invariants. Useful for debugging. */
  _check(): void {
    function error(str: string): void {
      console.log('ERROR: '+str);
    }
    const data = this.data();
    if (this.dataLength() < 0 || this.dataLength() > data.length)
    {error('bad _dataLength');}
    if (this.dataLength() === 2 && BufferLine.wKind(data[0]) === DataKind.SKIP_COLUMNS && BufferLine.wKind(data[1]) === DataKind.BG) {
      error('SKIP followed by BG');
    }
    if (this.dataLength() === 1 && data[0] === BufferLine.wSet1(DataKind.BG, 0)) {
      error('default BG only');
    }
    for (let idata = 0; idata < this.dataLength(); idata++) {
      const word = data[idata];
      const kind = BufferLine.wKind(word);
      switch (kind) {
        case DataKind.FG:
        case DataKind.BG:
          break;
        case DataKind.STYLE_FLAGS:
          if ((word & StyleFlags.HAS_EXTENDED) != 0
          && ! this.logicalLine()._extendedAttrs[idata]) {
            error("missed ExtendedAttributes")
          }
          break;
        case DataKind.SKIP_COLUMNS:
          break;
        case DataKind.CHAR_W1:
        case DataKind.CHAR_W2:
        case DataKind.CLUSTER_START_W1:
        case DataKind.CLUSTER_START_W2:
        case DataKind.CLUSTER_CONTINUED:
          break;
        default:
          error('invalid _dataKind');
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

  public clusterEnd(idata: number): number {
    // FIXME do we need to handle more than 7 bits of CLUSTED_CONTINUED?
    return idata + 1 + BufferLine.wContinuedCount(this.data()[idata]);
  }

  public insertCells(pos: number, n: number, fillCellData: ICellData): void {
    // FIXME handle if start or end in middle of wide character.
    const width = this.length;
    if (pos >= width) {
      return;
    }
    if (pos + n < width) {
      const endpos = width - n;
      this.moveToColumn(endpos, 2);
      const idata = this._cachedDataIndex();
      const colOffset = this._cachedColumn();
      this.logicalLine().deleteCellsOnly(idata, n);
    } else {
      n = width - pos;
    }
    this.insertCellsOnly(pos, n, fillCellData);
  }

  private insertCellsOnly(pos: RowColumn, n: number, fillCellData: ICellData): void {
    if (!(fillCellData.content & Content.IS_COMBINED_MASK)
      && fillCellData.getWidth() === 1) {
      // Optimization
      this.preInsert(this.logicalStartColumn() + pos, fillCellData);
      const idata = this._cachedDataIndex();
      const code = fillCellData.getCode();
      if (code === NULL_CELL_CODE) {
        this.addEmptyDataElements(idata, 1);
        this.data()[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, n);
      } else {
        this.addEmptyDataElements(idata, n);
        for (let i = 0; i < n; ++i) {
          this.data()[idata+i] = BufferLine.wSet1(DataKind.CHAR_W1, code);
        }
      }
    } else {
      this.moveToColumn(this.logicalStartColumn() + pos);
      const idata = this._cachedDataIndex();
      this.addEmptyDataElements(idata, 1);
      this.data()[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, n);
      for (let i = 0; i < n; ++i) {
        this.setCell(pos + i, fillCellData);
      }
    }
  }

  /** Move to column 'index', which is a RowColumn.
   * Return encoded 'content'.
   * @param index Goal column.
   * @param splitIfNeeded. As in moveToLineColumn.
   */
  public moveToColumn(index: RowColumn, splitIfNeeded: number = 0): number {
    const endColumn = this.nextRowSameLine ? this.nextRowSameLine.logicalStartColumn() : Infinity;
    return this.moveToLineColumn(index + this.logicalStartColumn(), splitIfNeeded, endColumn);
  }

  /** Move to column 'index', which is a LineColumn.
   * Return encoded 'content' (code value with width and possible IS_COMBINED_MARK) of following character, if any.
   * If index is the middle of a multi-column character: leaves the position before the character;
   * the return value specifices the code value 0 and the width 0.
   * If index is in the middle of a SKIP_COLUMNS: leaves the position cache before the SKIP_COLUMNS;
   * the return value specifices the code value 0 and width 1.
   * If index would take us past _dataLength: Set the position to _dataLength;
   * the return value specifices the code value 0 and width 1.
   * @param index The goal, as a LineColumn.
   * @param splitIfNeeded. If splitIfNeeded > 0 and the goal is in the middle
   *   of a double-wide character, replace letter by two SKIP-COLUMNS entries.
   *   If splitIfNeeded >= 2 and goal is in middle of SKIP_COLUMNS or
   *   after end of the row, split or add a SKIP_COLUMNS entry.
   *   If splitIfNeeded >= 3, stop early, before style words.
   * @param endColumn Don't move past this LineColumn.
   *    Used mainly to limit movement to the current row.
   */
  public moveToLineColumn(index: LineColumn, splitIfNeeded: number = 0, endColumn = Infinity): number {
    const stopEarly = splitIfNeeded >= 3;
    let curColumn = this._cachedColumn();
    if (index < curColumn) {
      // FIXME can sometimes do better
      this._cacheReset();
      curColumn = this._cachedColumn();
    }
    let idata = this._cachedDataIndex();
    let fg = this._cachedFg();
    let bg = this._cachedBg();
    let styleFlagsIndex = this._cachedStyleFlagsIndex();
    let todo = index - curColumn;
    let word;
    let kind;
    let content = 0;
    while (stopEarly ? todo > 0 : todo >= 0) {
      if (idata >= this.dataLength() || curColumn >= endColumn) {
        word = NULL_DATA_WORD;
        kind = DataKind.SKIP_COLUMNS;
        content = (NULL_CELL_WIDTH << Content.WIDTH_SHIFT) | NULL_CELL_CODE;
        if (splitIfNeeded > 1 && todo > 0) {
          this.addEmptyDataElements(idata, 1);
          this.data()[idata++] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, todo);
          curColumn += todo;
        }
        break;
      }
      let nextColumn = curColumn;
      word = this.data()[idata];
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
          styleFlagsIndex = idata;
          idata++;
          break;
        case DataKind.SKIP_COLUMNS:
          w = BufferLine.wSkipCount(word);
          nextColumn = curColumn + w;
          if (todo >= w) {
            todo -= w;
            idata++;
            curColumn += w;
          } else {
            if (splitIfNeeded > 1 && todo < w) {
               this.addEmptyDataElements(idata, 1);
               this.data()[idata++] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, todo);
               this.data()[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, w - todo);
               curColumn += todo;
            }
            content = (NULL_CELL_WIDTH << Content.WIDTH_SHIFT) | NULL_CELL_CODE;
            todo = -1;
          }
          break;
        case DataKind.CHAR_W1:
        case DataKind.CHAR_W2:
        case DataKind.CLUSTER_START_W1:
        case DataKind.CLUSTER_START_W2:
          w = BufferLine.wTextWidth(kind);
          nextColumn = curColumn + w;
          const clEnd = idata + 1 + BufferLine.wContinuedCount(word);
          if (todo >= w) {
            todo -= w;
            curColumn = nextColumn;
            idata = clEnd;
          } else {
            if (splitIfNeeded > 0 && index !== curColumn) {
              this.addEmptyDataElements(idata, 2 - (clEnd - idata));
              this.data()[idata++] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, 1);
              this.data()[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, 1);
              curColumn++;
            }
            content = index !== curColumn ? 0
              : kind <= DataKind.CHAR_W2 ? (w << Content.WIDTH_SHIFT) | (word & 0x1fffff)
              : (w << Content.WIDTH_SHIFT) | Content.IS_COMBINED_MASK;
            todo = -1;
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
   * to GC as it significantly reduced the amount of new objects/references needed.
   */
  public loadCell(index: number, cell: ICellData): ICellData {
    const cursor = cell as CellData;
    const content = this.moveToColumn(index);
    cursor.content = content;
    cursor.setFg(this._cachedFg());
    cursor.content = content;
    cursor.setFg(this._cachedFg());
    cursor.setBg(this._cachedBg());
    const styleFlagsIndex = this._cachedStyleFlagsIndex();
    const word = styleFlagsIndex < 0 ? 0 : this.data()[styleFlagsIndex];
    cursor.setStyleFlags(word);
    if ((word & StyleFlags.HAS_EXTENDED) !== 0) {
      cursor.extended = this.logicalLine()._extendedAttrs[styleFlagsIndex]!;
    }
    if (content & Content.IS_COMBINED_MASK) {
      // FIXME do this lazily, in CellData.getChars
      const idata = this._cachedDataIndex();
      const str = utf32ToString(this.data(), idata, this.clusterEnd(idata));
      cursor.combinedData = str;
    }
    return cell;
  }

  public deleteCells(pos: RowColumn, n: number, fillCellData: ICellData): void {
    this.moveToColumn(pos, 2);
    const idata = this._cachedDataIndex();
    const curColumn = this._cachedColumn();
    this.logicalLine().deleteCellsOnly(idata, n);
    this.insertCellsOnly(this.length - n, n, fillCellData); // FIXME logical
  }

  /** Insert attributes as necesssary into data array.
   * Cached position will be adjusted to at index but with specified attributes.
   */
  protected preInsert(index: LineColumn, attrs: IAttributeData, extendToEnd: boolean = false): boolean {
    this.moveToLineColumn(index, 3);
    let idata = this._cachedDataIndex();
    // set attributes
    const newFg = attrs.getFg();
    const newBg = attrs.getBg();
    const newStyle = attrs.getStyleFlags();
    let oldFg = this._cachedFg();
    let oldBg = this._cachedBg();
    const styleFlagsIndex = this._cachedStyleFlagsIndex();
    let oldStyle = styleFlagsIndex < 0 ? 0 : (this.data()[styleFlagsIndex] & 0xfffffff);
    let data = this.data();
    const extendedAttrs = this.logicalLine()._extendedAttrs;
    const idata0 = idata;
    let dataLength = this.dataLength();
    // Optimization - if followed by fg or bg elements matching attrs, just adjust data index.
    for (; idata < dataLength; idata++) {
      const word = data[idata];
      let done = true;
      switch (BufferLine.wKind(word)) {
        case DataKind.BG:
          if ((word & 0x3ffffff) === newBg) {
            oldBg = newBg;
            done = false;
          }
          break;
        case DataKind.FG:
          if ((word & 0x3ffffff) === newFg) {
            oldFg = newFg;
            done = false;
          }
          break;
          // FIXME StyleFlags
      }
      if (done) {
        break;
      }
    }
    let needFg = newFg !== oldFg;
    let needBg = newBg !== oldBg;
    let oldExt = (oldStyle & StyleFlags.HAS_EXTENDED) && extendedAttrs[styleFlagsIndex];
    let newExt = (newStyle & StyleFlags.HAS_EXTENDED) && attrs.extended;
    let needStyle = newStyle !== oldStyle || oldExt !== newExt;
    const add1 = extendToEnd ? 1 : 2;
    let add = (needBg?add1:0) + (needFg?add1:0) + (needStyle?add1:0);
    if (add) {
      add = (needBg?add1:0) + (needFg?add1:0) + (needStyle?add1:0);
      this.addEmptyDataElements(idata, add - (idata0 - idata));
      data = this.data();
      if (needFg) {
        data[idata++] = BufferLine.wSet1(DataKind.FG, newFg);
      }
      if (needBg) {
        data[idata++] = BufferLine.wSet1(DataKind.BG, newBg);
      }
      if (needStyle) {
        if (newStyle & StyleFlags.HAS_EXTENDED)
        {extendedAttrs[idata] = attrs.extended;}
        this._cacheSetStyleFlagsIndex(idata);
        data[idata++] = BufferLine.wSet1(DataKind.STYLE_FLAGS, newStyle);
      }
      this._cacheSetColumnDataIndex(index, idata);
      let xdata = idata; // FIXME
      if (! extendToEnd) {
        if (needFg) {
          data[xdata++] = BufferLine.wSet1(DataKind.FG, oldFg);
        }
        if (needStyle) {
          if ((oldStyle & StyleFlags.HAS_EXTENDED) !== 0 && oldExt)
            {extendedAttrs[xdata] = oldExt;}
          data[xdata++] = BufferLine.wSet1(DataKind.STYLE_FLAGS, oldStyle);
        }
       if (needBg) {
         data[xdata++] = BufferLine.wSet1(DataKind.BG, oldBg);
        }
       }
      this._cacheSetFgBg(newFg, newBg);
    } else if (idata > idata0) {
      this._cacheSetColumnDataIndex(index, idata);
    }
    return add > 0;
  }

  /** Insert characters from 'data' (from 'start' to 'end').
   * @return The ending column. This may be more than the available width,
   * in which case the caller is responsible for wrapping.
   */
  public insertText(index: RowColumn, data: Uint32Array, start: number, end: number, attrs: IAttributeData, inputHandler: IInputHandler, coreService: ICoreService): RowColumn {
    const insertMode = coreService.modes.insertMode;
    const wraparoundMode = coreService.decPrivateModes.wraparound;
    let lstart = this.logicalStartColumn();
    let lindex = index + lstart;
    const add = this.preInsert(lindex, attrs);
    lstart = this.logicalStartColumn();
    lindex = index + lstart;
    let curColumn = this._cachedColumn();
    const lline = this.logicalLine();
    const startColumn: LineColumn = curColumn;
    let idata = this._cachedDataIndex();
    let precedingJoinState = inputHandler.precedingJoinState;
    let inext;
    if (add || idata === this.dataLength() || lindex === curColumn)
    {inext = idata;}
    else {
      const kind = BufferLine.wKind(this.data()[idata]);
      if (BufferLine.wKindIsText(kind))
      {inext = this.clusterEnd(idata);}
      else
      {inext = idata;}
    }
    // FIXME optimize of overwriting simple text in-place
    this.addEmptyDataElements(inext, end - start);

    let cellColumn = curColumn;
    let chWidth = 0;
    for (let i = start; i < end; i++) {
      // inext is the insertion point for the current codepoint
      // idata is the start of the most recent character or cluster,
      // assuming all codepoints from idata until inext are the same cluster.
      // If there is no preceding character/cluster that can be added to,
      // then idata === inext.
      const code = data[i];
      const currentInfo = inputHandler.unicodeService.charProperties(code, precedingJoinState);
      chWidth = UnicodeService.extractWidth(currentInfo);
      const shouldJoin = UnicodeService.extractShouldJoin(currentInfo);
      const oldWidth = shouldJoin ? UnicodeService.extractWidth(precedingJoinState) : 0;
      precedingJoinState = currentInfo;
      let kind;
      if (shouldJoin) {
        kind = chWidth === 2 ? DataKind.CLUSTER_START_W2 : DataKind.CLUSTER_START_W1;
        const oldCount = (this.data()[idata] >> 21) & 0x3F;
        const startChar = this.data()[idata] & 0x1FFFFF;
        // FIXME check for count overflow;
        this.data()[idata] = BufferLine.wSet1(kind,
          startChar + ((oldCount + 1) << 21));
        kind = DataKind.CLUSTER_CONTINUED;
        curColumn += chWidth - oldWidth;
      } else {
        kind = chWidth === 2 ? DataKind.CHAR_W2 : DataKind.CHAR_W1;
        idata = inext;
        cellColumn = curColumn;
        curColumn += chWidth;
      }
      this.data()[inext++] = BufferLine.wSet1(kind, code);
    }
    const lastChar = idata;
    inputHandler.precedingJoinState = precedingJoinState;
    if (! insertMode && idata < this.dataLength()) {
      this.logicalLine().deleteCellsOnly(inext, curColumn - startColumn);
    }
    curColumn -= lstart;
    if (curColumn > this.length && ! wraparoundMode) {
      this.moveToColumn(this.length - chWidth);
      idata = this._cachedDataIndex();
      this.addEmptyDataElements(idata, idata - lastChar);
    } else {
      this._cacheSetColumnDataIndex(cellColumn, idata);
    }
    return curColumn;
  }

  public eraseCells(start: RowColumn, end: RowColumn, attrs: IAttributeData): void {
    const startColumn = this.logicalStartColumn();
    end = Math.min(end, this.length);
    const count = end - start;
    start += startColumn;
    end += startColumn;
    this.moveToLineColumn(start, 2);
    let idata = this._cachedDataIndex();
    const lline = this.logicalLine();
    lline.deleteCellsOnly(idata, count);
    this.preInsert(start, attrs, end === Infinity);
    idata = this._cachedDataIndex();
    const data = this.data();
    if (idata > 0 && BufferLine.wKind(data[idata-1]) === DataKind.SKIP_COLUMNS) {
      const skipped = BufferLine.wSkipCount(data[idata - 1]);
      if (idata === this.dataLength()) {
        end = start - skipped;
        idata--;
        lline._dataLength = idata;
      } else {
        if (this instanceof WrappedBufferLine && idata === this.startIndex) {
          this.startIndex--;
          this.startIndexColumn -= skipped;
        }
        data[idata-1] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, skipped + count);
      }
    } else {
      if (idata === this.dataLength()) {
        return;
      }
      this.addEmptyDataElements(idata, 1);
      data[idata++] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, count);
    }
    this._cacheSetColumnDataIndex(end, idata);
  }

  /**
   * Set data at `index` to `cell`.
   */
  public setCell(index: number, cell: ICellData): void {
    const width = cell.getWidth();
    if (cell.content & Content.IS_COMBINED_MASK) {
      const str = cell.combinedData;
      const nstr = str.length;
      const arr = new Uint32Array(nstr);
      let istr = 0;
      let iarr = 0;
      while (istr < nstr) {
        const cp = str.codePointAt(istr) || 0;
        arr[iarr++] += cp;
        istr += cp >= 0x10000 ? 2 : 1;
      }
      if (iarr <= 1) {
        this.setCellFromCodepoint(index, iarr > 0 ? arr[0] : NULL_CELL_CODE, width, cell);
      } else {
        const lindex = index + this.logicalStartColumn();
        const add = this.preInsert(lindex, cell); // FIXME
        let curColumn = this._cachedColumn();
        let idata = this._cachedDataIndex();
        let inext = idata;
        let cellColumn = curColumn;
        const kind = width === 2 ? DataKind.CLUSTER_START_W2 : DataKind.CLUSTER_START_W1;
        idata = inext;
        cellColumn = curColumn;
        curColumn += width;
        this.addEmptyDataElements(inext, iarr);
        this.data()[inext++] = BufferLine.wSet1(kind, arr[0] + ((iarr - 1) << 21));
        for (let i = 1; i < iarr; i++) {
          this.data()[inext++] = BufferLine.wSet1(DataKind.CLUSTER_CONTINUED, arr[i]);
        }
        this._cacheSetColumnDataIndex(cellColumn, idata);
        if (idata < this.dataLength()) {
          this.logicalLine().deleteCellsOnly(inext, width);
        }
      }
    } else {
      this.setCellFromCodepoint(index, cell.getCode(), width, cell);
    }
  }

  public setCellFromCodepoint(index: RowColumn, codePoint: number, width: number,  attrs: IAttributeData): void {
    if (codePoint === NULL_CELL_CODE) {
      if (width === 0) {
        // i.e. combining character
        // FIXME - usually a no-op
      } else {
        this.eraseCells(index, index + 1, attrs);
      }
      return;
    }
    const lindex = index + this.logicalStartColumn();
    const add = this.preInsert(lindex, attrs); // FIXME
    let curColumn = this._cachedColumn();
    let idata = this._cachedDataIndex();
    let inext;
    if (add || idata === this.dataLength() || lindex === curColumn)
    {inext = idata;}
    else {
      const kind = BufferLine.wKind(this.data()[idata]);
      if (BufferLine.wKindIsText(kind))
      {inext = this.clusterEnd(idata);}
      else
      {inext = idata;}
    }
    let cellColumn = curColumn;
    const kind = width === 2 ? DataKind.CHAR_W2 : DataKind.CHAR_W1;
    idata = inext;
    cellColumn = curColumn;
    curColumn += width;
    // FIXME optimize of overwriting simple text in-place
    this.addEmptyDataElements(inext, 1);
    this.data()[inext++] = BufferLine.wSet1(kind, codePoint);
    this._cacheSetColumnDataIndex(cellColumn, idata);
    if (idata < this.dataLength()) {
      this.logicalLine().deleteCellsOnly(inext, width);
    }
  }

  // DEPRECATED
  public addCodepointToCell(index: number, codePoint: number, width: number): void {
    const cell = this.loadCell(index, new CellData());
    let content = cell.content;
    if (cell.content & Content.IS_COMBINED_MASK) {
      cell.combinedData += stringFromCodePoint(codePoint);
    } else {
      if (content & Content.CODEPOINT_MASK) {
        // normal case for combining chars:
        //  - move current leading char + new one into combined string
        //  - set combined flag
        cell.combinedData = stringFromCodePoint(content & Content.CODEPOINT_MASK) + stringFromCodePoint(codePoint);
        content &= ~Content.CODEPOINT_MASK; // set codepoint in buffer to 0
        content |= Content.IS_COMBINED_MASK;
      } else {
        // should not happen - we actually have no data in the cell yet
        // simply set the data in the cell buffer with a width of 1
        content = codePoint | (1 << Content.WIDTH_SHIFT);
      }
    }
    if (width) {
      content &= ~Content.WIDTH_MASK;
      content |= width << Content.WIDTH_SHIFT;
    }
    cell.content = content;
    this.setCell(index, cell);
  }

  /**
   * Resize BufferLine to `cols` filling excess cells with `fillCellData`.
   * The underlying array buffer will not change if there is still enough space
   * to hold the new buffer line data.
   * Returns a boolean indicating, whether a `cleanupMemory` call would free
   * excess memory (true after shrinking > CLEANUP_THRESHOLD).
   * NOTE only used for testing?
   */
  public resize(cols: number, fillCellData: ICellData): boolean {
    if (cols === this.length) {
      return this.shouldCleanupMemory();
    }
    const uint32Cells = cols * 2; // FIXME
    if (cols > this.length) {
      /*
      if (this.data().buffer.byteLength >= uint32Cells * 4) {
        // optimization: avoid alloc and data copy if buffer has enough room
        this.data() = new Uint32Array(this.data().buffer, 0, uint32Cells);
      } else {
        // slow path: new alloc and full data copy
        const data = new Uint32Array(uint32Cells);
        data.set(this.data());
        this.data() = data;
      }
      */
      for (let i = this.length; i < cols; ++i) {
        this.setCell(i, fillCellData);
      }
    } else {
      // optimization: just shrink the view on existing buffer
      /*
      this.data() = this.data().subarray(0, uint32Cells);
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
      */
    }
    this.length = cols;
    return this.shouldCleanupMemory();
  }

  /** fill a line with fillCharData */
  public fill(fillCellData: ICellData, respectProtect?: boolean): void {
    this.replaceCells(0, this.length, fillCellData, respectProtect);
  }

  public getTrimmedLength(countBackground: boolean = false, logical: boolean = false): number {
    let cols = 0;
    let skipped = 0;
    const startIndex = !logical && this instanceof WrappedBufferLine
    ? this.startIndex : 0;
    const data = this.data();
    const end = this.nextRowSameLine && ! logical ? this.nextRowSameLine.startIndex : this.dataLength();
    let bg = this._cachedBg();
    let bgCol = 0;
    for (let idata = startIndex; idata < end; idata++) {
      const word = data[idata];
      const kind = BufferLine.wKind(word);
      const w = kind === DataKind.CHAR_W2 || kind === DataKind.CLUSTER_START_W2 ? 2 : 1;
      let wcols = 0;
      switch (kind) {
        case DataKind.BG:
          bg = word & 0x3ffffff;
          bgCol = cols + skipped;
          break;
        case DataKind.FG:
        case DataKind.STYLE_FLAGS:
          break;
        case DataKind.SKIP_COLUMNS:
          skipped += BufferLine.wSkipCount(word);
          if (idata === startIndex && this instanceof WrappedBufferLine) {
             skipped -= this.startColumn - this.startIndexColumn;
          }
          break;
        case DataKind.CLUSTER_START_W1:
        case DataKind.CLUSTER_START_W2:
          idata += BufferLine.wContinuedCount(word);
          wcols = w;
          break;
        case DataKind.CHAR_W1:
        case DataKind.CHAR_W2:
          wcols = w;
          break;
        case DataKind.CLUSTER_CONTINUED:
          break; // should be skipped
      }
      if (wcols) {
        cols += skipped + wcols;
        skipped = 0;
      }
    }
    if (countBackground) {
      cols += skipped;
      cols = bg ? this.length : Math.max(cols, bgCol);
    }
    return cols;
  }

  public getNoBgTrimmedLength(): number {
    return this.getTrimmedLength(true);
  }

  public translateToString(trimRight: boolean = false, startCol: number = 0, endCol: number = -1, outColumns?: number[], skipReplace: string = WHITESPACE_CELL_CHAR): string {
    const lineStart = this.logicalStartColumn();
    let logicalEndColumn = endCol >= 0 ? lineStart + endCol
      : this.nextRowSameLine ? this.nextRowSameLine.logicalStartColumn()
      : lineStart + this.length;
    if (trimRight) {
      logicalEndColumn = Math.min(logicalEndColumn, lineStart + this.getTrimmedLength());
    }

  let s = this.logicalLine().translateLogicalToString(false, lineStart + startCol, logicalEndColumn, outColumns, skipReplace);
    if (!trimRight && endCol < 0) { s += ' '.repeat(this.length - logicalEndColumn + lineStart)}
    if (outColumns && lineStart !== 0) {
      for (let i = outColumns.length; --i >= 0; ) {
        outColumns[i] -= lineStart;
      }
    }
    return s;
  }
}

export class LogicalBufferLine extends BufferLine implements IBufferLine {
  protected _data: Uint32Array;
  // Each item in _data is a 4-bit DataKind and 28 bits data.
  _dataLength: number = 0; // active length of _data array
  /** Width in collumns if there is no line-wrapping. */
  public get logicalWidth(): number { return this.getTrimmedLength(false, true); } 
  //logicalWidth: number = 0; // FIXME needs work updating this
  public reflowNeeded: boolean = false;

  // Key is index in _data array that has STYLE_FLAGS kind with HAS_EXTENDED.
  _extendedAttrs: IExtendedAttrs[] = [];

  // Maybe move these to to Buffer? Would save space. but with API complications.
  _cache1: number = 0;
  _cache2: number = 0;
  _cache3: number = 0;
  _cache4: number = -1;

  constructor(cols: number, fillCellData?: ICellData, src?: WrappedBufferLine, startIndex: number = 0, data: Uint32Array = new Uint32Array(cols)) {
    super();
    // MAYBE: const buffer = new ArrayBuffer(0, { maxByteLength: 6 * cols });
    // const buffer = new ArrayBuffer(4 * cols, { maxByteLength: 6 * cols });
    this.length = cols;
    if (src) {
      const lline = src.logicalLine();
      const oldStart = startIndex;
      this._data = lline._data.slice(oldStart);
      this._dataLength = lline._dataLength - oldStart;
      this._extendedAttrs = lline._extendedAttrs.slice(oldStart);
      if (fillCellData) { this.preInsert(0, fillCellData); }
    } else {
      this._data = data;
      this._dataLength = 0;
      if (fillCellData) { this.replaceCells(0, this.length, fillCellData, false); }
    }
  }
  public override logicalLine(): LogicalBufferLine { return this; }
  public override logicalStartColumn(): LineColumn { return 0; }
  override data(): Uint32Array { return this._data; }
  override dataLength(): number { return this._dataLength; }
  override _cachedBg(): number { return this._cache2; }
  override _cachedFg(): number { return this._cache3; }
  public get isWrapped(): boolean { return false; }

  protected _cachedColumnInRow(): RowColumn { return (this.logicalLine()._cache1 & 0xFFFF); }

  /** Creates a new LogicalBufferLine but reuses old _data buffer.
   * The oldLine_data buffer is resized to _dataLength,
   * while the old _data buffer is reused for the new line.
   */
  public static makeAndTrim(cols: number, fillCellData?: ICellData, oldRow?: IBufferLine): LogicalBufferLine {
    if (oldRow) {
      const oldLine = (oldRow as BufferLine).logicalLine();
      if (oldLine._data.length > oldLine._dataLength) {
        const oldData = oldLine._data;
        oldLine._data = oldData.slice(0, oldLine._dataLength);
        const newLine = new LogicalBufferLine(cols, undefined, undefined, 0, oldData);
        newLine._data = oldData;
        if (fillCellData) { newLine.preInsert(0, fillCellData); }
        return newLine;
      }
    }
    return new LogicalBufferLine(cols, fillCellData);
  }

  // count can be negative
  addEmptyDataElements(position: number, count: number): void {
    const oldDataLength = this._dataLength;
    this.resizeData(oldDataLength + count);
    if (count < 0) {
      this.data().copyWithin(position, position - count, oldDataLength);
    } else {
      this.data().copyWithin(position + count, position, oldDataLength);
    }
    this._dataLength += count;
    for (let next = this.nextRowSameLine; next; next = next.nextRowSameLine) {
      if (next.startIndex > position)
      {next.startIndex += count;}
    }
    if (count < 0) {
      this._extendedAttrs.copyWithin(position, position - count, oldDataLength);
    } else {
      this._extendedAttrs.length = this._dataLength
      this._extendedAttrs.copyWithin(position + count, position, oldDataLength);
    }
    if (this._extendedAttrs.length > this._dataLength) {
      this._extendedAttrs.length = this._dataLength;
    }
  }

  resizeData(size: number): void {
    if (size > this.data().length) {
      // buffer = new ArrayBuffer(buffer.byteLength, { maxByteLength: 6 * size });
      const dataNew = new Uint32Array((3 * size) >> 1); // FIXME
      dataNew.set(this._data);
      this.logicalLine()._data = dataNew;
    }
  }

  /**
   * Cleanup underlying array buffer.
   * A cleanup will be triggered if the array buffer exceeds the actual used
   * memory by a factor of CLEANUP_THRESHOLD.
   * Returns 0 or 1 indicating whether a cleanup happened.
   */
  public cleanupMemory(): number {
    if (this.shouldCleanupMemory()) {
      const data = new Uint32Array(this.dataLength());
      data.set(this.data());
      this._data = data;
      return 1;
    }
    return 0;
  }

  // FIXME doesn't properly handle if delete range starts or ends in middle
  // of wide character
  /** Internal - delete n columns, with no adjust at end of line.
   * idata0 - index in _data array of start of deletion.
   * n - number of columns to delete.
   */
  deleteCellsOnly(idata0: number, n: number): void {
    let todo = n;
    const data = this.data();
    let idata = idata0;
    let dskipFirst = idata; let dskipLast = -1; let w;
    let fgValue = -1; // cursor.getFg();
    let bgValue = -1; // cursor.getBg();
    let styleValue = -1;
    let extended = undefined; // cursor.getStyleFlags(); // FIXME handle extendedattrs

    // Move start backwards before style entries.
    // The goal is to remove no-longer needed style entries.
    while (idata > 0) {
      let skipItem = true;
      const word = data[idata-1];
      switch (BufferLine.wKind(word)) {
        case DataKind.BG: bgValue = word & 0x3ffffff; break;
        case DataKind.FG: fgValue = word & 0x3ffffff; break;
        case DataKind.STYLE_FLAGS:
          styleValue = word & 0xfffffff;
          extended = (word & StyleFlags.HAS_EXTENDED) !== 0 && this._extendedAttrs[idata - 1];
          break;
        default: skipItem = false;
      }
      if (skipItem) {
        idata--;
        dskipFirst = idata;
        dskipLast = idata0-1;
      } else {
        break;
      }
    }

    let skipNeeded = 0;
    for (; todo > 0 && idata < this.dataLength(); idata++) {
      const word = data[idata];
      const kind = BufferLine.wKind(word);
      switch (kind) {
        case DataKind.FG:
          fgValue = word & 0x3ffffff;
          dskipLast = idata;
          break;
        case DataKind.BG:
          bgValue = word & 0x3ffffff;
          dskipLast = idata;
          break;
        case DataKind.STYLE_FLAGS:
          dskipLast = idata;
          styleValue = word & 0xfffffff;
          extended = (word & StyleFlags.HAS_EXTENDED) !== 0 && this._extendedAttrs[idata];
          break;
        case DataKind.SKIP_COLUMNS:
          const wlen = BufferLine.wSkipCount(word);
          if (wlen <= todo) { // FIXME
            dskipLast = idata;
            todo -= wlen;
          } else {
            const delta = Math.min(todo,  wlen);
            this.data()[idata] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, wlen - delta);
            todo -= delta;
          }
          break;
        case DataKind.CHAR_W1:
        case DataKind.CHAR_W2:
          w = kind - DataKind.CHAR_W1; // 0, or 1 if wide characters
          dskipLast = idata;
          todo -= 1 << w;
          if (todo < 0) { skipNeeded = -todo; }
          break;
        case DataKind.CLUSTER_START_W1:
        case DataKind.CLUSTER_START_W2:
          w = kind - DataKind.CLUSTER_START_W1; // 0, or 1 if wide characters
          const clEnd = this.clusterEnd(idata);
          idata = clEnd;
          dskipLast = idata;
          todo -= (1 << w);
          break;
      }
    }
    idata0 = dskipFirst;
    if (bgValue >= 0) {
      this.data()[idata0++] = BufferLine.wSet1(DataKind.BG, bgValue);
    }
    if (fgValue >= 0 && idata0 !== this._dataLength) {
      this.data()[idata0++] = BufferLine.wSet1(DataKind.FG, fgValue);
    }
    if (styleValue >= 0 && idata0 !== this._dataLength) {
      if ((styleValue & StyleFlags.HAS_EXTENDED) !== 0 && extended) {
        if (! extended) throw(new Error("missing extended"));
        this._extendedAttrs[idata0] = extended;
      }
      this.data()[idata0++] = BufferLine.wSet1(DataKind.STYLE_FLAGS, styleValue);
    }
    if (skipNeeded > 0) {
      this.data()[idata0++] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, skipNeeded);
    }
    if (dskipLast >= 0) {
      const dcount = dskipLast + 1 - idata0;
      this.addEmptyDataElements(idata0, - dcount);
    }
  }

  public setWrapped(previousLine: BufferLine): WrappedBufferLine {
    const column = this.logicalStartColumn() + previousLine.length;
    const content = previousLine.moveToLineColumn(column);
    const neededPadding = column - previousLine._cachedColumn();
    const startLine = previousLine.logicalLine();
    let startLength = startLine._dataLength;
    const padWithSpaces = false; // use spaces or SKIP_COLUMNS?
    let padLength = neededPadding <= 0 ? 0 : padWithSpaces ? neededPadding : 1;
    startLine.resizeData(this._dataLength + startLength + padLength);
    if (neededPadding > 0) {
      if (padWithSpaces) {
        while (--padLength >= 0) {
          startLine._data[startLength++] = BufferLine.wSet1(DataKind.CHAR_W1, 32);
        }
      } else {
        startLine._data[startLength++] = BufferLine.wSet1(DataKind.SKIP_COLUMNS, neededPadding);
      }
    }
    startLine._data.set(this._data.subarray(0, this._dataLength), startLength);
    startLine._dataLength = startLength + this._dataLength;
    for (let i = this._extendedAttrs.length; --i >= 0; ) {
       const attr = this._extendedAttrs[i];
       if (attr) { startLine._extendedAttrs[startLength + i] = attr; }
    }
    const newRow = new WrappedBufferLine(previousLine);
    newRow.nextRowSameLine = this.nextRowSameLine;
    newRow.setStartFromCache(startLine, column, content);
    for (let following = this.nextRowSameLine; following;
      following = following?.nextRowSameLine) {
      following.startColumn += newRow.startColumn;
      following.startIndexColumn += newRow.startIndexColumn;
      following.startIndex += newRow.startIndex;
    }
    return newRow;
  }

  public translateLogicalToString(trimRight: boolean = false, startCol: number = 0, endCol: number = Infinity, outColumns?: number[], skipReplace: string = WHITESPACE_CELL_CHAR): string {
    if (outColumns) {
      outColumns.length = 0;
    }
    let s = '';
    let col = 0;
    // assuming skipReplace is ' ' or ''.
    const skipReplaceLength = skipReplace.length;
    let pendingSkips = 0;
    let pendingStart = -1;
    let pendingLength = 0;
    const data = this.data();
    function emitPendingSkips(): void {
      if (pendingSkips > 0) {
        s += skipReplace.repeat(pendingSkips);
        if (outColumns) {
          const col0 = col - pendingSkips;
          for (let i = 0; i < pendingSkips; ++i) {
            outColumns.push(col0 + i * skipReplaceLength);
          }
        }
        pendingSkips = 0;
      }
    }
    for (let idata = 0; idata < this.dataLength() && col < endCol; idata++) {
      const word = this.data()[idata];
      const kind = BufferLine.wKind(word);
      const wide = kind === DataKind.CHAR_W2 || kind === DataKind.CLUSTER_START_W2 ? 1 : 0;
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
            pendingSkips += wlen;
          }
          col += wlen;
          break;
        case DataKind.CHAR_W1:
        case DataKind.CHAR_W2:
        case DataKind.CLUSTER_START_W1:
        case DataKind.CLUSTER_START_W2:
          const wcols = BufferLine.wTextWidth(kind);
          const ncontinued = BufferLine.wContinuedCount(word);
          if (col >= startCol && col < endCol) {
            emitPendingSkips();
            const t = utf32ToString(data, idata, idata + ncontinued + 1);
            if (outColumns) {
              for (let i = t.length; --i >= 0; ) { outColumns.push(col); }
            }
            s += t;
          }
          idata += ncontinued;
          col += wcols;
          break;
      }
    }
    if (col < startCol) { col = startCol; }
    if (! trimRight && col < endCol && endCol !== Infinity) {
      pendingSkips += endCol - col;
      col = endCol;
    }
    if (! trimRight) {
      //col += pendingSkips;
      emitPendingSkips();
    }
    if (outColumns) {
      outColumns.push(col);
    }
    return s;
  }

  /** for debugging */
  getText(skipReplace: string = ' '): string {
    return this.translateLogicalToString(true, 0, this.length, undefined, skipReplace);
  }
}

export class WrappedBufferLine extends BufferLine implements IBufferLine {
  _logicalLine: LogicalBufferLine;

  /** Number of logical columns in previous rows.
   * Also: logical column number (column number assuming infinitely-wide
   * terminal) corresponding to the start of this row.
   * If R is 0 for the previous LogicalBufferLine, R is 1 for first
   * WrappedBufferLine and so on, startColumn will *usually* be N*W
   * (where W is the width of the terminal in columns) but may be slightly
   * different when a wide character at column W-1 must wrap "early".
   */
  startColumn: LineColumn = 0;

  /** Index in data array containing first column.
   * If _data[startIndex] is a SKIP_COLUMNS, some columns might be the
   * end of the previous row, and some might be the current row.
   * In that case, startColumn-startIndexColumn is the number of columns
   * in the previous row.
   */
  startIndex: number = 0;

  /** Column number corresponding to startIndex.
   * Usually the same as startColumn, but may be less if startIndex refers to a SKIP_COLUMNS.
   */
  startIndexColumn: number = 0;

  // startIndex, startFg, startBg, startStyle are  used by _cacheReset
  // to optimize moveToColumn on same row.  It might be best to get rid of them;
  // to mitigate the performance cost we could support backwards movement by moveToColumn.
  // Changing Data>FG etc to use xor-encoding would help. TODO.
  startFg: number = 0;
  startBg: number = 0;
  startStyle: number = -1;

  constructor(prevRow: BufferLine) {
    super();
    const logicalLine = prevRow.logicalLine();
    prevRow.nextRowSameLine = this;
    this._logicalLine = logicalLine;
    this.length = logicalLine.length;
  }

  public get isWrapped(): boolean { return true; }  

  public setStartFromCache(line: BufferLine, column: LineColumn, content: number): void {
    this.startColumn = content === 0 ? line._cachedColumn() : column;
    this.startIndex = line._cachedDataIndex();
    this.startIndexColumn = line._cachedColumn();
    this.startBg = line._cachedBg();
    this.startFg = line._cachedFg();
    this.startStyle = line._cachedStyleFlagsIndex();
  }

  public override logicalLine(): LogicalBufferLine { return this._logicalLine; }
  public override logicalStartColumn(): LineColumn { return this.startColumn; }
  protected override data(): Uint32Array { return this._logicalLine.data(); }
  public override dataLength(): number { return this._logicalLine.dataLength(); }
  public override _cachedBg(): number { return this._logicalLine._cachedBg(); }
  public override _cachedFg(): number { return this._logicalLine._cachedFg(); }
  addEmptyDataElements(position: number, count: number): void {
    this._logicalLine.addEmptyDataElements(position, count);
  }
  protected _cachedColumnInRow(): RowColumn { return (this.logicalLine()._cache1 & 0xFFFF) - this.startIndexColumn; }
  protected _cacheReset(): void {
    this._cacheSetFgBg(this.startFg, this.startBg);
    this._cacheSetStyleFlagsIndex(this.startStyle);
    this._cacheSetColumnDataIndex(this.startIndexColumn, this.startIndex);
  }
  public resizeData(size: number): void { this._logicalLine.resizeData(size); }
  public cleanupMemory(): number { return 0;}
  public getPreviousRow(): BufferLine {
    for (let row: BufferLine = this._logicalLine; ;) {
      const next = row.nextRowSameLine as BufferLine;
      if (next === this) {
        return row;
      }
      row = next;
    }
  }

  public asUnwrapped(prevRow: BufferLine = this.getPreviousRow()): LogicalBufferLine {
    const oldStartColumn = this.logicalStartColumn();
    prevRow.nextRowSameLine = undefined;
    const oldLine = prevRow.logicalLine();
    oldLine.moveToColumn(oldStartColumn, 1);
    const startIndex = oldLine._cachedDataIndex();
    const cell = new CellData();
    this.loadCell(oldStartColumn, cell);
    const newRow = new LogicalBufferLine(this.length, cell, this, startIndex);
    newRow.nextRowSameLine = this.nextRowSameLine;
    const oldStart = this.startIndex;
    const oldIndexColumn = this.startIndexColumn;
    for (let nextRow = newRow.nextRowSameLine; nextRow; nextRow = nextRow.nextRowSameLine) {
      nextRow.startColumn -= oldStartColumn;
      nextRow.startIndex -= oldStart;
      nextRow.startIndexColumn -= oldIndexColumn;
      nextRow._logicalLine = newRow;
    }
    oldLine._dataLength = startIndex;
    return newRow;

  }
}
