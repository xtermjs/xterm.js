/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { IEvent } from '../Event';
import type { ICircularList } from '../CircularList';
import type { ICharset } from '../../Types';
import type { IDisposable } from '../Lifecycle';
import type { UnderlineStyle } from './Constants';

// BufferIndex denotes a position in the buffer: [rowIndex, colIndex]
export type BufferIndex = [number, number];

export type CharData = [attr: number, char: string, width: number, code: number];

export interface IExtendedAttrs {
  ext: number;
  underlineStyle: UnderlineStyle;
  underlineColor: number;
  underlineVariantOffset: number;
  urlId: number;
  clone(): IExtendedAttrs;
  isEmpty(): boolean;
}

/**
 * An object that represents all attributes of a cell.
 */
export interface IAttributeData {
  /**
   * "fg" is a 32-bit unsigned integer that stores the foreground color of the cell in the 24 least
   * significant bits and additional flags in the remaining 8 bits.
   */
  fg: number;
  /**
   * "bg" is a 32-bit unsigned integer that stores the background color of the cell in the 24 least
   * significant bits and additional flags in the remaining 8 bits.
   */
  bg: number;
  /**
   * "extended", aka "ext", stores extended attributes beyond those available in fg and bg. This
   * data is optional on a cell and encodes less common data.
   */
  extended: IExtendedAttrs;

  clone(): IAttributeData;

  // flags
  isInverse(): number;
  isBold(): number;
  isUnderline(): number;
  isBlink(): number;
  isInvisible(): number;
  isItalic(): number;
  isDim(): number;
  isStrikethrough(): number;
  isProtected(): number;
  isOverline(): number;

  /**
   * The color mode of the foreground color which determines how to decode {@link getFgColor},
   * possible values include {@link Attributes.CM_DEFAULT}, {@link Attributes.CM_P16},
   * {@link Attributes.CM_P256} and {@link Attributes.CM_RGB}.
   */
  getFgColorMode(): number;
  /**
   * The color mode of the background color which determines how to decode {@link getBgColor},
   * possible values include {@link Attributes.CM_DEFAULT}, {@link Attributes.CM_P16},
   * {@link Attributes.CM_P256} and {@link Attributes.CM_RGB}.
   */
  getBgColorMode(): number;
  isFgRGB(): boolean;
  isBgRGB(): boolean;
  isFgPalette(): boolean;
  isBgPalette(): boolean;
  isFgDefault(): boolean;
  isBgDefault(): boolean;
  isAttributeDefault(): boolean;

  /**
   * Gets an integer representation of the foreground color, how to decode the color depends on the
   * color mode {@link getFgColorMode}.
   */
  getFgColor(): number;
  /**
   * Gets an integer representation of the background color, how to decode the color depends on the
   * color mode {@link getBgColorMode}.
   */
  getBgColor(): number;

  // extended attrs
  hasExtendedAttrs(): number;
  updateExtended(): void;
  getUnderlineColor(): number;
  getUnderlineColorMode(): number;
  isUnderlineColorRGB(): boolean;
  isUnderlineColorPalette(): boolean;
  isUnderlineColorDefault(): boolean;
  getUnderlineStyle(): number;
  getUnderlineVariantOffset(): number;
}

/** Cell data */
export interface ICellData extends IAttributeData {
  content: number;
  combinedData: string;
  isCombined(): number;
  getWidth(): number;
  getChars(): string;
  getCode(): number;
  setFromCharData(value: CharData): void;
  getAsCharData(): CharData;
}

/**
 * Interface for a line in the terminal buffer.
 */
export interface IBufferLine {
  length: number;
  isWrapped: boolean;
  get(index: number): CharData;
  set(index: number, value: CharData): void;
  loadCell(index: number, cell: ICellData): ICellData;
  setCell(index: number, cell: ICellData): void;
  setCellFromCodepoint(index: number, codePoint: number, width: number, attrs: IAttributeData): void;
  addCodepointToCell(index: number, codePoint: number, width: number): void;
  insertCells(pos: number, n: number, ch: ICellData): void;
  deleteCells(pos: number, n: number, fill: ICellData): void;
  replaceCells(start: number, end: number, fill: ICellData, respectProtect?: boolean): void;
  resize(cols: number, fill: ICellData): boolean;
  cleanupMemory(): number;
  fill(fillCellData: ICellData, respectProtect?: boolean): void;
  copyFrom(line: IBufferLine): void;
  clone(): IBufferLine;
  getTrimmedLength(): number;
  getNoBgTrimmedLength(): number;
  translateToString(trimRight?: boolean, startCol?: number, endCol?: number, outColumns?: number[]): string;

  /* direct access to cell attrs */
  getWidth(index: number): number;
  hasWidth(index: number): number;
  getFg(index: number): number;
  getBg(index: number): number;
  hasContent(index: number): number;
  getCodePoint(index: number): number;
  isCombined(index: number): number;
  getString(index: number): string;
}

export interface IMarker extends IDisposable {
  readonly id: number;
  readonly isDisposed: boolean;
  readonly line: number;
  onDispose: IEvent<void>;
}

export interface IBuffer {
  readonly lines: ICircularList<IBufferLine>;
  ydisp: number;
  ybase: number;
  y: number;
  x: number;
  tabs: any;
  scrollBottom: number;
  scrollTop: number;
  hasScrollback: boolean;
  savedY: number;
  savedX: number;
  savedCharset: ICharset | undefined;
  savedCharsets: (ICharset | undefined)[];
  savedGlevel: number;
  savedOriginMode: boolean;
  savedWraparoundMode: boolean;
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
