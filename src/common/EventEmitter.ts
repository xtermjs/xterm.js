/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from 'common/Types';
import type { Emitter, Event } from 'vs/base/common/event';

export interface IEvent<T, U = void> {
  (listener: (arg1: T, arg2: U) => any): IDisposable;
}

export function forwardEvent<T>(from: IEvent<T> | Event<T>, to: Emitter<T>): IDisposable {
  return from(e => to.fire(e));
}

/** @deprecated Use vs/base/common/events version */
export function runAndSubscribe<T>(event: IEvent<T>, handler: (e: T | undefined) => any): IDisposable {
  handler(undefined);
  return event(e => handler(e));
}
