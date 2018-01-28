/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IEventEmitter } from 'xterm';

export class EventEmitter implements IEventEmitter {
  private _events: {[type: string]: ((...args: any[]) => void)[]};

  constructor() {
    // Restore the previous events if available, this will happen if the
    // constructor is called multiple times on the same object (terminal reset).
    this._events = this._events || {};
  }

  public on(type: string, listener: ((...args: any[]) => void)): void {
    this._events[type] = this._events[type] || [];
    this._events[type].push(listener);
  }

  public off(type: string, listener: ((...args: any[]) => void)): void {
    if (!this._events[type]) {
      return;
    }

    let obj = this._events[type];
    let i = obj.length;

    while (i--) {
      if (obj[i] === listener) {
        obj.splice(i, 1);
        return;
      }
    }
  }

  public removeAllListeners(type: string): void {
    if (this._events[type]) {
       delete this._events[type];
    }
  }

  public emit(type: string, ...args: any[]): void {
    if (!this._events[type]) {
      return;
    }
    let obj = this._events[type];
    for (let i = 0; i < obj.length; i++) {
      obj[i].apply(this, args);
    }
  }

  public listeners(type: string): ((...args: any[]) => void)[] {
    return this._events[type] || [];
  }

  protected destroy(): void {
    this._events = {};
  }
}
