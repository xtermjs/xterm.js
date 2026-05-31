/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { UnderlineStyle } from 'common/buffer/Constants';
import type { IDisposable } from 'common/Lifecycle';
import type { IEvent } from 'common/Event';

export type { IColorRGB } from 'common/ColorTypes';

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
  fg: number;
  bg: number;
  extended: IExtendedAttrs;

  clone(): IAttributeData;

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

  getFgColorMode(): number;
  getBgColorMode(): number;
  isFgRGB(): boolean;
  isBgRGB(): boolean;
  isFgPalette(): boolean;
  isBgPalette(): boolean;
  isFgDefault(): boolean;
  isBgDefault(): boolean;
  isAttributeDefault(): boolean;

  getFgColor(): number;
  getBgColor(): number;

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
