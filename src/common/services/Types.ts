/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export type CursorStyle = 'block' | 'underline' | 'bar';

export type CursorInactiveStyle = 'outline' | 'block' | 'bar' | 'underline' | 'none';

/**
 * Tracks the current hyperlink for OscLinkService.
 */
export interface IOscLinkData {
  id?: string;
  uri: string;
}

export interface IModes {
  insertMode: boolean;
}

export interface IDecPrivateModes {
  applicationCursorKeys: boolean;
  applicationKeypad: boolean;
  bracketedPasteMode: boolean;
  colorSchemeUpdates: boolean;
  cursorBlink: boolean | undefined;
  cursorStyle: CursorStyle | undefined;
  origin: boolean;
  reverseWraparound: boolean;
  sendFocus: boolean;
  synchronizedOutput: boolean;
  win32InputMode: boolean;
  wraparound: boolean; // defaults: xterm - true, vt100 - false
}

/**
 * Kitty keyboard protocol state (CoreService).
 */
export interface IKittyKeyboardState {
  flags: number;
  mainFlags: number;
  altFlags: number;
  mainStack: number[];
  altStack: number[];
}

export const enum CoreMouseButton {
  LEFT = 0,
  MIDDLE = 1,
  RIGHT = 2,
  NONE = 3,
  WHEEL = 4,
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
  UP = 0,
  DOWN = 1,
  LEFT = 2,
  RIGHT = 3,
  MOVE = 32
}

export interface ICoreMouseEvent {
  col: number;
  row: number;
  x: number;
  y: number;
  button: CoreMouseButton;
  action: CoreMouseAction;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
}

export const enum CoreMouseEventType {
  NONE = 0,
  DOWN = 1,
  UP = 2,
  DRAG = 4,
  MOVE = 8,
  WHEEL = 16
}

export interface ICoreMouseProtocol {
  events: CoreMouseEventType;
  restrict: (e: ICoreMouseEvent) => boolean;
}

export type CoreMouseEncoding = (event: ICoreMouseEvent) => string;
