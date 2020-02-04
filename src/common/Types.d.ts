/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IEvent, IEventEmitter } from 'common/EventEmitter';
import { IDeleteEvent, IInsertEvent } from 'common/CircularList';

export interface IDisposable {
  dispose(): void;
}

export type XtermListener = (...args: any[]) => void;

/**
 * A keyboard event interface which does not depend on the DOM, KeyboardEvent implicitly extends
 * this event.
 */
export interface IKeyboardEvent {
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  keyCode: number;
  key: string;
  type: string;
}

export interface ICircularList<T> {
  length: number;
  maxLength: number;
  isFull: boolean;

  onDeleteEmitter: IEventEmitter<IDeleteEvent>;
  onDelete: IEvent<IDeleteEvent>;
  onInsertEmitter: IEventEmitter<IInsertEvent>;
  onInsert: IEvent<IInsertEvent>;
  onTrimEmitter: IEventEmitter<number>;
  onTrim: IEvent<number>;

  get(index: number): T | undefined;
  set(index: number, value: T): void;
  push(value: T): void;
  recycle(): T | undefined;
  pop(): T | undefined;
  splice(start: number, deleteCount: number, ...items: T[]): void;
  trimStart(count: number): void;
  shiftElements(start: number, count: number, offset: number): void;
}

export const enum KeyboardResultType {
  SEND_KEY,
  SELECT_ALL,
  PAGE_UP,
  PAGE_DOWN
}

export interface IKeyboardResult {
  type: KeyboardResultType;
  cancel: boolean;
  key: string | undefined;
}

export interface ICharset {
  [key: string]: string | undefined;
}

export type CharData = [number, string, number, number];
export type IColorRGB = [number, number, number];

/** Attribute data */
export interface IAttributeData {
  fg: number;
  bg: number;

  clone(): IAttributeData;

  // flags
  isInverse(): number;
  isBold(): number;
  isUnderline(): number;
  isBlink(): number;
  isInvisible(): number;
  isItalic(): number;
  isDim(): number;

  // color modes
  getFgColorMode(): number;
  getBgColorMode(): number;
  isFgRGB(): boolean;
  isBgRGB(): boolean;
  isFgPalette(): boolean;
  isBgPalette(): boolean;
  isFgDefault(): boolean;
  isBgDefault(): boolean;
  isAttributeDefault(): boolean;

  // colors
  getFgColor(): number;
  getBgColor(): number;
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
  setCellFromCodePoint(index: number, codePoint: number, width: number, fg: number, bg: number): void;
  addCodepointToCell(index: number, codePoint: number): void;
  insertCells(pos: number, n: number, ch: ICellData, eraseAttr?: IAttributeData): void;
  deleteCells(pos: number, n: number, fill: ICellData, eraseAttr?: IAttributeData): void;
  replaceCells(start: number, end: number, fill: ICellData, eraseAttr?: IAttributeData): void;
  resize(cols: number, fill: ICellData): void;
  fill(fillCellData: ICellData): void;
  copyFrom(line: IBufferLine): void;
  clone(): IBufferLine;
  getTrimmedLength(): number;
  translateToString(trimRight?: boolean, startCol?: number, endCol?: number): string;

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
}

export interface IDecPrivateModes {
  applicationCursorKeys: boolean;
  applicationKeypad: boolean;
  origin: boolean;
  wraparound: boolean; // defaults: xterm - true, vt100 - false
}

export interface IRowRange {
  start: number;
  end: number;
}

/**
 * Interface for mouse events in the core.
 */
export const enum CoreMouseButton {
  LEFT = 0,
  MIDDLE = 1,
  RIGHT = 2,
  NONE = 3,
  WHEEL = 4,
  // additional buttons 1..8
  // untested!
  AUX1 = 8,
  AUX2 = 9,
  AUX3 = 10,
  AUX4 = 11,
  AUX5 = 12,
  AUX6 = 13,
  AUX7 = 14,
  AUX8 = 15
}

export const enum CoreMouseAction {
  UP = 0,     // buttons, wheel
  DOWN = 1,   // buttons, wheel
  LEFT = 2,   // wheel only
  RIGHT = 3,  // wheel only
  MOVE = 32   // buttons only
}

export interface ICoreMouseEvent {
  /** column (zero based). */
  col: number;
  /** row (zero based). */
  row: number;
  /**
   * Button the action occured. Due to restrictions of the tracking protocols
   * it is not possible to report multiple buttons at once.
   * Wheel is treated as a button.
   * There are invalid combinations of buttons and actions possible
   * (like move + wheel), those are silently ignored by the CoreMouseService.
   */
  button: CoreMouseButton;
  action: CoreMouseAction;
  /**
   * Modifier states.
   * Protocols will add/ignore those based on specific restrictions.
   */
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
}

/**
 * CoreMouseEventType
 * To be reported to the browser component which events a mouse
 * protocol wants to be catched and forwarded as an ICoreMouseEvent
 * to CoreMouseService.
 */
export const enum CoreMouseEventType {
  NONE = 0,
  /** any mousedown event */
  DOWN = 1,
  /** any mouseup event */
  UP = 2,
  /** any mousemove event while a button is held */
  DRAG = 4,
  /** any mousemove event without a button */
  MOVE = 8,
  /** any wheel event */
  WHEEL = 16
}

/**
 * Mouse protocol interface.
 * A mouse protocol can be registered and activated at the CoreMouseService.
 * `events` should contain a list of needed events as a hint for the browser component
 * to install/remove the appropriate event handlers.
 * `restrict` applies further protocol specific restrictions like not allowed
 * modifiers or filtering invalid event types.
 */
export interface ICoreMouseProtocol {
  events: CoreMouseEventType;
  restrict: (e: ICoreMouseEvent) => boolean;
}

/**
 * CoreMouseEncoding
 * The tracking encoding can be registered and activated at the CoreMouseService.
 * If a ICoreMouseEvent passes all procotol restrictions it will be encoded
 * with the active encoding and sent out.
 * Note: Returning an empty string will supress sending a mouse report,
 * which can be used to skip creating falsey reports in limited encodings
 * (DEFAULT only supports up to 223 1-based as coord value).
 */
export type CoreMouseEncoding = (event: ICoreMouseEvent) => string;

/**
 * windowOptions
 */
export interface IWindowOptions {
  restoreWin?: boolean;
  minimizeWin?: boolean;
  setWinPosition?: boolean;
  setWinSizePixels?: boolean;
  raiseWin?: boolean;
  lowerWin?: boolean;
  refreshWin?: boolean;
  setWinSizeChars?: boolean;
  maximizeWin?: boolean;
  fullscreenWin?: boolean;
  getWinState?: boolean;
  getWinPosition?: boolean;
  getWinSizePixels?: boolean;
  getScreenSizePixels?: boolean;
  getCellSizePixels?: boolean;
  getWinSizeChars?: boolean;
  getScreenSizeChars?: boolean;
  getIconTitle?: boolean;
  getWinTitle?: boolean;
  pushTitle?: boolean;
  popTitle?: boolean;
  setWinLines?: boolean;
}
