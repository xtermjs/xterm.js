/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IEventEmitter, IListenerType } from './Interfaces';

export class EventEmitter implements IEventEmitter {
  private _events: {[type: string]: IListenerType[]};

  constructor() {
    // Restore the previous events if available, this will happen if the
    // constructor is called multiple times on the same object (terminal reset).
    this._events = this._events || {};
  }

  public on(type: string, listener: IListenerType): void {
    this._events[type] = this._events[type] || [];
    this._events[type].push(listener);
  }

  public off(type: string, listener: IListenerType): void {
    if (!this._events[type]) {
      return;
    }

    let obj = this._events[type];
    let i = obj.length;

    while (i--) {
      if (obj[i] === listener || obj[i].listener === listener) {
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

  public once(type: string, listener: IListenerType): void {
    function on(): void {
      let args = Array.prototype.slice.call(arguments);
      this.off(type, on);
      listener.apply(this, args);
    }
    (<any>on).listener = listener;
    this.on(type, on);
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

  public listeners(type: string): IListenerType[] {
    return this._events[type] || [];
  }

  protected destroy(): void {
    this._events = {};
  }
}
