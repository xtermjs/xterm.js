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
  /** Row number relative to the "home" row.
   * This is the row number changed/reported by cursor escape sequences,
   * except that y is 0-origin: y=0 when we're at the home row.
   */
  y: number;
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
  translateBufferLineToString(lineIndex: number, trimRight: boolean, startCol?: number, endCol?: number): string;
  getWrappedRangeForLine(y: number): { first: number, last: number };
  nextStop(x?: number): number;
  prevStop(x?: number): number;
  getBlankLine(attr: IAttributeData, isWrapped?: boolean): IBufferLine;
  getNullCell(attr?: IAttributeData): ICellData;
  getWhitespaceCell(attr?: IAttributeData): ICellData;
  addMarker(y: number): IMarker;
  clearMarkers(y: number): void;
  clearAllMarkers(): void;
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
