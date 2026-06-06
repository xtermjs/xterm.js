/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/** sequence params serialized to js arrays */
export type ParamsArray = (number | number[])[];

/** Interface of Params storage class. */
export interface IParams {
  /** from ctor */
  maxLength: number;
  maxSubParamsLength: number;

  /** param values and its length */
  params: Int32Array;
  length: number;

  /** methods */
  clone(): IParams;
  toArray(): ParamsArray;
  reset(): void;
  resetZdm(): void;
  addParam(value: number): void;
  addSubParam(value: number): void;
  hasSubParams(idx: number): boolean;
  getSubParams(idx: number): Int32Array | null;
  getSubParamsAll(): {[idx: number]: Int32Array};
}

export interface IDisposable {
  dispose(): void;
}

export type CursorStyle = 'block' | 'underline' | 'bar';

export type CursorInactiveStyle = 'outline' | 'block' | 'bar' | 'underline' | 'none';

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
  /** @deprecated See KeyboardEvent.keyCode */
  keyCode: number;
  key: string;
  type: string;
  code: string;
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

export interface IColor {
  readonly css: string;
  readonly rgba: number; // 32-bit int with rgba in each byte
}
export type IColorRGB = [red: number, green: number, blue: number];

/**
 * Tracks the current hyperlink. Since these are treated as extended attirbutes, these get passed on
 * to the linkifier when anything is printed. Doing it this way ensures that even when the cursor
 * moves around unexpectedly the link is tracked, as opposed to using a start position and
 * finalizing it at the end.
 */
export interface IOscLinkData {
  id?: string;
  uri: string;
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
  /** xy pixel positions. */
  x: number;
  y: number;
  /**
   * Button the action occurred. Due to restrictions of the tracking protocols
   * it is not possible to report multiple buttons at once.
   * Wheel is treated as a button.
   * There are invalid combinations of buttons and actions possible
   * (like move + wheel), those are silently ignored by the MouseStateService.
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
 * to MouseStateService.
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
 * A mouse protocol can be registered and activated at the MouseStateService.
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
 * The tracking encoding can be registered and activated at the MouseStateService.
 * If a ICoreMouseEvent passes all procotol restrictions it will be encoded
 * with the active encoding and sent out.
 * Note: Returning an empty string will supress sending a mouse report,
 * which can be used to skip creating falsey reports in limited encodings
 * (DEFAULT only supports up to 223 1-based as coord value).
 */
export type CoreMouseEncoding = (event: ICoreMouseEvent) => string;

// color events from common, used for OSC 4/10/11/12 and 104/110/111/112
export const enum ColorRequestType {
  REPORT = 0,
  SET = 1,
  RESTORE = 2
}

// IntRange from https://stackoverflow.com/a/39495173
type Enumerate<N extends number, Acc extends number[] = []> = Acc['length'] extends N
  ? Acc[number]
  : Enumerate<N, [...Acc, Acc['length']]>;
type IntRange<F extends number, T extends number> = Exclude<Enumerate<T>, Enumerate<F>>;

export type ColorIndex = IntRange<0, 256>; // number from 0 to 255
export type AllColorIndex = ColorIndex | SpecialColorIndex;
export const enum SpecialColorIndex {
  FOREGROUND = 256,
  BACKGROUND = 257,
  CURSOR = 258
}
export interface IColorReportRequest {
  type: ColorRequestType.REPORT;
  index: AllColorIndex;
}
export interface IColorSetRequest {
  type: ColorRequestType.SET;
  index: AllColorIndex;
  color: IColorRGB;
}
export interface IColorRestoreRequest {
  type: ColorRequestType.RESTORE;
  index?: AllColorIndex;
}
export type IColorEvent = (IColorReportRequest | IColorSetRequest | IColorRestoreRequest)[];
