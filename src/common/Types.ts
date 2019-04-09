/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export interface IDisposable {
  dispose(): void;
}

export interface IEventEmitter {
  on(type: string, listener: (...args: any[]) => void): void;
  off(type: string, listener: (...args: any[]) => void): void;
  emit(type: string, data?: any): void;
  addDisposableListener(type: string, handler: (...args: any[]) => void): IDisposable;
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

export interface ICircularList<T> extends IEventEmitter {
  length: number;
  maxLength: number;
  isFull: boolean;

  get(index: number): T | undefined;
  set(index: number, value: T): void;
  push(value: T): void;
  recycle(): T | undefined;
  pop(): T | undefined;
  splice(start: number, deleteCount: number, ...items: T[]): void;
  trimStart(count: number): void;
  shiftElements(start: number, count: number, offset: number): void;
}
