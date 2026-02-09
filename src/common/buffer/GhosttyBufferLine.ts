/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { CharData, IAttributeData, IBufferLine, ICellData, IExtendedAttrs } from 'common/Types';
import { CellData } from 'common/buffer/CellData';
import { BufferLine } from 'common/buffer/BufferLine';
import { Attributes, BgFlags, CHAR_DATA_ATTR_INDEX, CHAR_DATA_CHAR_INDEX, CHAR_DATA_WIDTH_INDEX, Content, WHITESPACE_CELL_CHAR } from 'common/buffer/Constants';
import { stringFromCodePoint } from 'common/input/TextDecoder';
import { GhosttyWasmBuffer } from 'common/buffer/GhosttyWasmBuffer';

// Work variables to avoid garbage collection
const workCell = new CellData();

export class GhosttyBufferLine implements IBufferLine {
  public get length(): number {
    return this._buffer.cols;
  }

  constructor(
    private readonly _buffer: GhosttyWasmBuffer,
    private readonly _row: number
  ) {
  }

  public get row(): number {
    return this._row;
  }

  public get _extendedAttrs(): { [key: number]: IExtendedAttrs | undefined } {
    const rowMap = this._buffer.getExtendedRow(this._row);
    if (!rowMap) {
      return {};
    }
    const result: { [key: number]: IExtendedAttrs | undefined } = {};
    for (const [col, ext] of rowMap) {
      result[col] = ext;
    }
    return result;
  }

  public get isWrapped(): boolean {
    return this._buffer.getRowWrap(this._row);
  }

  public set isWrapped(value: boolean) {
    this._buffer.setRowWrap(this._row, value);
  }

  public get(index: number): CharData {
    const [content, fg] = this._buffer.getCell(this._row, index);
    const cp = content & Content.CODEPOINT_MASK;
    const combined = (content & Content.IS_COMBINED_MASK)
      ? this._buffer.getCombined(this._row, index) ?? ''
      : '';
    return [
      fg,
      (content & Content.IS_COMBINED_MASK)
        ? combined
        : (cp) ? stringFromCodePoint(cp) : '',
      content >> Content.WIDTH_SHIFT,
      (content & Content.IS_COMBINED_MASK)
        ? (combined.length ? combined.charCodeAt(combined.length - 1) : 0)
        : cp
    ];
  }

  public set(index: number, value: CharData): void {
    const fg = value[CHAR_DATA_ATTR_INDEX];
    const chars = value[CHAR_DATA_CHAR_INDEX];
    if (chars.length > 1) {
      this._buffer.setCombined(this._row, index, chars);
      this._buffer.setCell(this._row, index, index | Content.IS_COMBINED_MASK | (value[CHAR_DATA_WIDTH_INDEX] << Content.WIDTH_SHIFT), fg, 0);
    } else {
      this._buffer.clearCombined(this._row, index);
      this._buffer.setCell(this._row, index, chars.charCodeAt(0) | (value[CHAR_DATA_WIDTH_INDEX] << Content.WIDTH_SHIFT), fg, 0);
    }
  }

  public loadCell(index: number, cell: ICellData): ICellData {
    const [content, fg, bg] = this._buffer.getCell(this._row, index);
    cell.content = content;
    cell.fg = fg;
    cell.bg = bg;
    if (cell.content & Content.IS_COMBINED_MASK) {
      cell.combinedData = this._buffer.getCombined(this._row, index) ?? '';
    }
    if (cell.bg & BgFlags.HAS_EXTENDED) {
      cell.extended = this._buffer.getExtended(this._row, index)!;
    }
    return cell;
  }

  public setCell(index: number, cell: ICellData): void {
    if (cell.content & Content.IS_COMBINED_MASK) {
      this._buffer.setCombined(this._row, index, cell.combinedData);
    } else {
      this._buffer.clearCombined(this._row, index);
    }
    if (cell.bg & BgFlags.HAS_EXTENDED) {
      this._buffer.setExtended(this._row, index, cell.extended);
    } else {
      this._buffer.clearExtended(this._row, index);
    }
    this._buffer.setCell(this._row, index, cell.content, cell.fg, cell.bg);
  }

  public setCellFromCodepoint(index: number, codePoint: number, width: number, attrs: IAttributeData): void {
    if (attrs.bg & BgFlags.HAS_EXTENDED) {
      this._buffer.setExtended(this._row, index, attrs.extended);
    } else {
      this._buffer.clearExtended(this._row, index);
    }
    this._buffer.clearCombined(this._row, index);
    this._buffer.setCell(this._row, index, codePoint | (width << Content.WIDTH_SHIFT), attrs.fg, attrs.bg);
  }

  public addCodepointToCell(index: number, codePoint: number, width: number): void {
    const [content, fg, bg] = this._buffer.getCell(this._row, index);
    let newContent = content;
    if (content & Content.IS_COMBINED_MASK) {
      const existing = this._buffer.getCombined(this._row, index) ?? '';
      this._buffer.setCombined(this._row, index, existing + stringFromCodePoint(codePoint));
    } else {
      if (content & Content.CODEPOINT_MASK) {
        const existing = stringFromCodePoint(content & Content.CODEPOINT_MASK);
        this._buffer.setCombined(this._row, index, existing + stringFromCodePoint(codePoint));
        newContent &= ~Content.CODEPOINT_MASK;
        newContent |= Content.IS_COMBINED_MASK;
      } else {
        newContent = codePoint | (1 << Content.WIDTH_SHIFT);
      }
    }
    if (width) {
      newContent &= ~Content.WIDTH_MASK;
      newContent |= width << Content.WIDTH_SHIFT;
    }
    this._buffer.setCell(this._row, index, newContent, fg, bg);
  }

  public insertCells(pos: number, n: number, fillCellData: ICellData): void {
    pos %= this.length;
    if (pos && this.getWidth(pos - 1) === 2) {
      this.setCellFromCodepoint(pos - 1, 0, 1, fillCellData);
    }

    if (n < this.length - pos) {
      for (let i = this.length - pos - n - 1; i >= 0; --i) {
        this.setCell(pos + n + i, this.loadCell(pos + i, workCell));
      }
      for (let i = 0; i < n; ++i) {
        this.setCell(pos + i, fillCellData);
      }
    } else {
      for (let i = pos; i < this.length; ++i) {
        this.setCell(i, fillCellData);
      }
    }

    if (this.getWidth(this.length - 1) === 2) {
      this.setCellFromCodepoint(this.length - 1, 0, 1, fillCellData);
    }
  }

  public deleteCells(pos: number, n: number, fillCellData: ICellData): void {
    pos %= this.length;
    if (n < this.length - pos) {
      for (let i = 0; i < this.length - pos - n; ++i) {
        this.setCell(pos + i, this.loadCell(pos + n + i, workCell));
      }
      for (let i = this.length - n; i < this.length; ++i) {
        this.setCell(i, fillCellData);
      }
    } else {
      for (let i = pos; i < this.length; ++i) {
        this.setCell(i, fillCellData);
      }
    }

    if (pos && this.getWidth(pos - 1) === 2) {
      this.setCellFromCodepoint(pos - 1, 0, 1, fillCellData);
    }
    if (this.getWidth(pos) === 0 && !this.hasContent(pos)) {
      this.setCellFromCodepoint(pos, 0, 1, fillCellData);
    }
  }

  public replaceCells(start: number, end: number, fillCellData: ICellData, respectProtect: boolean = false): void {
    if (respectProtect) {
      if (start && this.getWidth(start - 1) === 2 && !this.isProtected(start - 1)) {
        this.setCellFromCodepoint(start - 1, 0, 1, fillCellData);
      }
      if (end < this.length && this.getWidth(end - 1) === 2 && !this.isProtected(end)) {
        this.setCellFromCodepoint(end, 0, 1, fillCellData);
      }
      while (start < end && start < this.length) {
        if (!this.isProtected(start)) {
          this.setCell(start, fillCellData);
        }
        start++;
      }
      return;
    }

    if (start && this.getWidth(start - 1) === 2) {
      this.setCellFromCodepoint(start - 1, 0, 1, fillCellData);
    }
    if (end < this.length && this.getWidth(end - 1) === 2) {
      this.setCellFromCodepoint(end, 0, 1, fillCellData);
    }

    while (start < end && start < this.length) {
      this.setCell(start++, fillCellData);
    }
  }

  public resize(_cols: number, _fillCellData: ICellData): boolean {
    return false;
  }

  public cleanupMemory(): number {
    return 0;
  }

  public fill(fillCellData: ICellData, respectProtect: boolean = false): void {
    if (respectProtect) {
      for (let i = 0; i < this.length; ++i) {
        if (!this.isProtected(i)) {
          this.setCell(i, fillCellData);
        }
      }
      return;
    }
    for (let i = 0; i < this.length; ++i) {
      this.setCell(i, fillCellData);
    }
  }

  public copyFrom(line: IBufferLine): void {
    for (let i = 0; i < this.length; ++i) {
      this.setCell(i, line.loadCell(i, workCell));
    }
    this.isWrapped = line.isWrapped;
  }

  public clone(): IBufferLine {
    const clone = new BufferLine(this.length);
    for (let i = 0; i < this.length; ++i) {
      clone.setCell(i, this.loadCell(i, workCell));
    }
    clone.isWrapped = this.isWrapped;
    return clone;
  }

  public getTrimmedLength(): number {
    for (let i = this.length - 1; i >= 0; --i) {
      if ((this._buffer.getCell(this._row, i)[0] & Content.HAS_CONTENT_MASK)) {
        return i + (this._buffer.getCell(this._row, i)[0] >> Content.WIDTH_SHIFT);
      }
    }
    return 0;
  }

  public getNoBgTrimmedLength(): number {
    for (let i = this.length - 1; i >= 0; --i) {
      const [content, , bg] = this._buffer.getCell(this._row, i);
      if ((content & Content.HAS_CONTENT_MASK) || (bg & Attributes.CM_MASK)) {
        return i + (content >> Content.WIDTH_SHIFT);
      }
    }
    return 0;
  }

  public translateToString(trimRight?: boolean, startCol?: number, endCol?: number, outColumns?: number[]): string {
    startCol = startCol ?? 0;
    endCol = endCol ?? this.length;
    if (trimRight) {
      endCol = Math.min(endCol, this.getTrimmedLength());
    }
    if (outColumns) {
      outColumns.length = 0;
    }
    let result = '';
    while (startCol < endCol) {
      const content = this._buffer.getCell(this._row, startCol)[0];
      const cp = content & Content.CODEPOINT_MASK;
      const chars = (content & Content.IS_COMBINED_MASK)
        ? (this._buffer.getCombined(this._row, startCol) ?? '')
        : (cp) ? stringFromCodePoint(cp) : WHITESPACE_CELL_CHAR;
      result += chars;
      if (outColumns) {
        for (let i = 0; i < chars.length; ++i) {
          outColumns.push(startCol);
        }
      }
      startCol += (content >> Content.WIDTH_SHIFT) || 1;
    }
    if (outColumns) {
      outColumns.push(startCol);
    }
    return result;
  }

  public getWidth(index: number): number {
    return this._buffer.getCell(this._row, index)[0] >> Content.WIDTH_SHIFT;
  }

  public hasWidth(index: number): number {
    return this._buffer.getCell(this._row, index)[0] & Content.WIDTH_MASK;
  }

  public getFg(index: number): number {
    return this._buffer.getCell(this._row, index)[1];
  }

  public getBg(index: number): number {
    return this._buffer.getCell(this._row, index)[2];
  }

  public hasContent(index: number): number {
    return this._buffer.getCell(this._row, index)[0] & Content.HAS_CONTENT_MASK;
  }

  public getCodePoint(index: number): number {
    const content = this._buffer.getCell(this._row, index)[0];
    if (content & Content.IS_COMBINED_MASK) {
      const combined = this._buffer.getCombined(this._row, index) ?? '';
      return combined.charCodeAt(combined.length - 1);
    }
    return content & Content.CODEPOINT_MASK;
  }

  public isCombined(index: number): number {
    return this._buffer.getCell(this._row, index)[0] & Content.IS_COMBINED_MASK;
  }

  public getString(index: number): string {
    const content = this._buffer.getCell(this._row, index)[0];
    if (content & Content.IS_COMBINED_MASK) {
      return this._buffer.getCombined(this._row, index) ?? '';
    }
    if (content & Content.CODEPOINT_MASK) {
      return stringFromCodePoint(content & Content.CODEPOINT_MASK);
    }
    return '';
  }

  public isProtected(index: number): number {
    return this._buffer.getCell(this._row, index)[2] & BgFlags.PROTECTED;
  }
}
