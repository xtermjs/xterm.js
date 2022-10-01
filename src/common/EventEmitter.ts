/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from 'common/Types';

interface IListener<T, U = void> {
  (arg1: T, arg2: U): void;
}

export interface IEvent<T, U = void> {
  (listener: (arg1: T, arg2: U) => any): IDisposable;
}

export interface IEventEmitter<T, U = void> {
  fire(arg1: T, arg2: U): void;
  dispose(): void;
}

export interface IEventWithEmitter<T, U = void> extends IEventEmitter<T, U>, IEvent<T, U> {
}

export class EventEmitter<T, U = void> implements IEventEmitter<T, U> {
  private _listeners: IListener<T, U>[] = [];
  private _event?: IEvent<T, U>;
  private _disposed: boolean = false;

  public get event(): IEvent<T, U> {
    if (!this._event) {
      this._event = (listener: (arg1: T, arg2: U) => any) => {
        this._listeners.push(listener);
        const disposable = {
          dispose: () => {
            if (!this._disposed) {
              for (let i = 0; i < this._listeners.length; i++) {
                if (this._listeners[i] === listener) {
                  this._listeners.splice(i, 1);
                  return;
                }
              }
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
    for (let i = 0; i < this._listeners.length; i++) {
      queue.push(this._listeners[i]);
    }
    for (let i = 0; i < queue.length; i++) {
      queue[i].call(undefined, arg1, arg2);
    }
  }

  public dispose(): void {
    if (this._listeners) {
      this._listeners.length = 0;
    }
    this._disposed = true;
  }
}

/**
 * Creates an object that implements both the {@link IEvent} and {@link IEmitter} interfaces. This
 * allows more concise instantiation. The idea is to internally use the combined
 * {@link IEventWithEmitter} interface and only expose {@link IEvent} externally.
 *
 * @example
 * ```ts
 * public readonly onFoo = initEvent<string>();
 * // ...
 * onFoo(e => handle(e));
 * onFoo.fire('bar');
 * ```
 */
export function initEvent<T, U = void>(): IEventWithEmitter<T, U> {
  const emitter = new EventEmitter<T, U>();
  const event = emitter.event;
  Object.defineProperty(event, 'fire', {
    value: emitter.fire.bind(emitter)
  });
  Object.defineProperty(event, 'dispose', {
    value: emitter.dispose.bind(emitter)
  });
  return event as any;
}

export function forwardEvent<T>(from: IEvent<T>, to: IEventEmitter<T>): IDisposable {
  return from(e => to.fire(e));
}
