/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IAttributeData, ICircularList, IBufferLine, ICellData, IMarker, ICharset, IDisposable } from 'common/Types';
import { IEvent } from 'common/EventEmitter';

// BufferIndex denotes a position in the buffer: [rowIndex, colIndex]
export type BufferIndex = [number, number];

export interface IBuffer {
  readonly lines: ICircularList<IBufferLine>;
  /** Number of rows above top visible row.
   * Similar to scrollTop (i.e. affected by scrollbar), but in rows.
   * FUTURE: We want to handle variable-height rows. Maybe just use scrollTop.
   */
  ydisp: number;
  /** Number of rows in the scrollback buffer, above the home row. */
  ybase: number;

  /** Row number relative to the "home" row, zero-origin.
   * This is the row number changed/reported by cursor escape sequences,
   * except that y is 0-origin: y=0 when we're at the home row.
   * Currently assumed to be >= 0, but FUTURE should allow negative - i.e.
   * in scroll-back area, as long as ybase+y >= 0.
   */
  y: number;

  /** Column number, zero-origin.
   * Valid range is 0 through C (inclusive), if C is terminal width in columns.
   * The first (left-most) column is 0.
   * The right-most column is either C-1 (before the right-most column, and
   * ready to write in it), or C (after the right-most column, having written
   * to it, and ready to wrap). DSR 6 returns C (1-origin) in either case,
   */
  x: number;

  tabs: any;
  scrollBottom: number;
  scrollTop: number;
  hasScrollback: boolean;
  savedY: number;
  savedX: number;
  savedCharset: ICharset | undefined;
  savedCurAttrData: IAttributeData;
  isCursorInViewport: boolean;
  markers: IMarker[];
  scrollArea: HTMLElement | undefined;
  translateBufferLineToString(lineIndex: number, trimRight: boolean, startCol?: number, endCol?: number): string;
  splitLine(row: number, col: number): void;
  getWrappedRangeForLine(y: number): { first: number, last: number };
  nextStop(x?: number): number;
  prevStop(x?: number): number;
  getBlankLine(attr: IAttributeData, isWrapped?: boolean): IBufferLine;
  getNullCell(attr?: IAttributeData): ICellData;
  getWhitespaceCell(attr?: IAttributeData): ICellData;
  addMarker(y: number): IMarker;
  clearMarkers(y: number): void;
  clearAllMarkers(): void;
  setWrapped(row: number, value: boolean): void;
  reflowRegion(startRow: number, endRow: number, maxRows: number): void;
  insertHtml(htmlText: string): void;
}

export interface IBufferSet extends IDisposable {
  alt: IBuffer;
  normal: IBuffer;
  active: IBuffer;

  onBufferActivate: IEvent<{ activeBuffer: IBuffer, inactiveBuffer: IBuffer }>;

  activateNormalBuffer(): void;
  activateAltBuffer(fillAttr?: IAttributeData): void;
  reset(): void;
  resize(newCols: number, newRows: number): void;
  setupTabStops(i?: number): void;
}
