/**
 * @license MIT
 */

interface ListenerType {
    (): void;
    listener?: () => void;
};

export class EventEmitter {
  private _events: {[type: string]: ListenerType[]};

  constructor() {
    this._events = {};
  }

  // TODO: Merge addListener and on, no reason for an alias in a private component
  public addListener(type, listener): void {
    this._events[type] = this._events[type] || [];
    this._events[type].push(listener);
  }

  public on(type, listener): void {
    this.addListener(type, listener);
  }

  // TODO: Merge removeListener and off, no reason for an alias in a private component
  public removeListener(type, listener): void {
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

  public off(type, listener): void {
    this.removeListener(type, listener);
  }

  public removeAllListeners(type): void {
    if (this._events[type]) {
       delete this._events[type];
    }
  }

  public once(type, listener): any {
    function on() {
      let args = Array.prototype.slice.call(arguments);
      this.removeListener(type, on);
      return listener.apply(this, args);
    }
    (<any>on).listener = listener;
    return this.on(type, on);
  }

  public emit(type): void {
    if (!this._events[type]) {
      return;
    }

    let args = Array.prototype.slice.call(arguments, 1);
    let obj = this._events[type];

    for (let i = 0; i < obj.length; i++) {
      obj[i].apply(this, args);
    }
  }

  public listeners(type): ListenerType[] {
    return this._events[type] || [];
  }
}
