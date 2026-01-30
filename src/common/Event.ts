/**
 * Copyright (c) 2024-2026 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Minimal event utilities for xterm.js core.
 * Simplified from VS Code's event.ts - no leak detection/profiling.
 */

import { IDisposable, DisposableStore, toDisposable } from 'common/Lifecycle';

export interface IEvent<T> {
  (listener: (e: T) => any, thisArgs?: any, disposables?: IDisposable[] | DisposableStore): IDisposable;
}

export class Emitter<T> {
  private _listeners: { fn: (e: T) => any, thisArgs: any }[] = [];
  private _disposed = false;
  private _event: IEvent<T> | undefined;

  public get event(): IEvent<T> {
    if (!this._event) {
      this._event = (listener: (e: T) => any, thisArgs?: any, disposables?: IDisposable[] | DisposableStore) => {
        if (this._disposed) {
          return toDisposable(() => {});
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
    }
    return this._event;
  }

  public fire(event: T): void {
    if (this._disposed) {
      return;
    }
    // Snapshot listeners to allow modifications during iteration
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

export namespace EventUtils {
  export function forward<T>(from: IEvent<T>, to: Emitter<T>): IDisposable {
    return from(e => to.fire(e));
  }

  export function map<I, O>(event: IEvent<I>, map: (i: I) => O): IEvent<O> {
    return (listener: (e: O) => any, thisArgs?: any, disposables?: IDisposable[] | DisposableStore) => {
      return event(i => listener.call(thisArgs, map(i)), undefined, disposables);
    };
  }

  export function any<T>(...events: IEvent<T>[]): IEvent<T>;
  export function any(...events: IEvent<any>[]): IEvent<void>;
  export function any<T>(...events: IEvent<T>[]): IEvent<T> {
    return (listener: (e: T) => any, thisArgs?: any, disposables?: IDisposable[] | DisposableStore) => {
      const store = new DisposableStore();
      for (const event of events) {
        store.add(event(e => listener.call(thisArgs, e)));
      }
      if (disposables) {
        if (Array.isArray(disposables)) {
          disposables.push(store);
        } else {
          disposables.add(store);
        }
      }
      return store;
    };
  }

  export function runAndSubscribe<T>(event: IEvent<T>, handler: (e: T | undefined) => void): IDisposable {
    handler(undefined);
    return event(e => handler(e));
  }
}
