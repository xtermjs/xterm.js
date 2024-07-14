/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from 'common/Types';
import type { Emitter, Event } from 'vs/base/common/event';

interface IListener<T, U = void> {
  (arg1: T, arg2: U): void;
}

export interface IEvent<T, U = void> {
  (listener: (arg1: T, arg2: U) => any): IDisposable;
}

export interface IEventEmitter<T, U = void> {
  event: IEvent<T, U>;
  fire(arg1: T, arg2: U): void;
  dispose(): void;
}
/** @deprecated Use vs/base/common/events version */
export class EventEmitter<T, U = void> implements IEventEmitter<T, U> {
  private _listeners: Set<IListener<T, U>> = new Set();
  private _event?: IEvent<T, U>;
  private _disposed: boolean = false;

  public get event(): IEvent<T, U> {
    if (!this._event) {
      this._event = (listener: (arg1: T, arg2: U) => any) => {
        this._listeners.add(listener);
        const disposable = {
          dispose: () => {
            if (!this._disposed) {
              this._listeners.delete(listener);
            }
          }
        };
        return disposable;
      };
    }
    return this._event;
  }

  public fire(arg1: T, arg2: U): void {
    const queue: IListener<T, U>[] = [];
    for (const l of this._listeners.values()) {
      queue.push(l);
    }
    for (let i = 0; i < queue.length; i++) {
      queue[i].call(undefined, arg1, arg2);
    }
  }

  public dispose(): void {
    this.clearListeners();
    this._disposed = true;
  }

  public clearListeners(): void {
    if (this._listeners) {
      this._listeners.clear();
    }
  }
}

export function forwardEvent<T>(from: IEvent<T> | Event<T>, to: Emitter<T>): IDisposable {
  return from(e => to.fire(e));
}

/** @deprecated Use vs/base/common/events version */
export function runAndSubscribe<T>(event: IEvent<T>, handler: (e: T | undefined) => any): IDisposable {
  handler(undefined);
  return event(e => handler(e));
}
