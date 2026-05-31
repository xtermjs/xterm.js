/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
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
