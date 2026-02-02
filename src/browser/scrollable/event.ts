/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Minimal event utilities for scrollable components.
 */

import { Disposable, DisposableStore, IDisposable, toDisposable } from './lifecycle';

export interface Event<T> {
  (listener: (e: T) => any, thisArgs?: any, disposables?: IDisposable[] | DisposableStore): IDisposable;
}

export class Emitter<T> {
  private _listeners: { fn: (e: T) => any, thisArgs: any }[] = [];
  private _disposed = false;
  private _event: Event<T> | undefined;

  public get event(): Event<T> {
    if (this._event) {
      return this._event;
    }
    this._event = (listener: (e: T) => any, thisArgs?: any, disposables?: IDisposable[] | DisposableStore) => {
      if (this._disposed) {
        return Disposable.None;
      }

      const entry = { fn: listener, thisArgs };
      this._listeners.push(entry);

      const result = toDisposable(() => {
        const idx = this._listeners.indexOf(entry);
        if (idx !== -1) {
          this._listeners.splice(idx, 1);
        }
      });

      if (disposables) {
        if (Array.isArray(disposables)) {
          disposables.push(result);
        } else {
          disposables.add(result);
        }
      }

      return result;
    };
    return this._event;
  }

  public fire(event: T): void {
    if (this._disposed || this._listeners.length === 0) {
      return;
    }
    if (this._listeners.length === 1) {
      const { fn, thisArgs } = this._listeners[0];
      fn.call(thisArgs, event);
      return;
    }

    const listeners = this._listeners.slice();
    for (const { fn, thisArgs } of listeners) {
      fn.call(thisArgs, event);
    }
  }

  public dispose(): void {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    this._listeners.length = 0;
  }
}

export namespace Event {
  export const None: Event<any> = () => Disposable.None;

  export function runAndSubscribe<T>(event: Event<T>, handler: (e: T) => void, initial: T): IDisposable;
  export function runAndSubscribe<T>(event: Event<T>, handler: (e: T | undefined) => void): IDisposable;
  export function runAndSubscribe<T>(event: Event<T>, handler: (e: T | undefined) => void, initial?: T): IDisposable {
    handler(initial);
    return event(e => handler(e));
  }
}
