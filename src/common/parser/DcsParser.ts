/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from 'common/Types';
import { IDcsHandler, IParams, IHandlerCollection, IDcsParser, DcsFallbackHandlerType } from 'common/parser/Types';
import { utf32ToString } from 'common/input/TextDecoder';
import { Params } from 'common/parser/Params';
import { PAYLOAD_LIMIT } from 'common/parser/Constants';

const EMPTY_HANDLERS: IDcsHandler[] = [];

export class DcsParser implements IDcsParser {
  private _handlers: IHandlerCollection<IDcsHandler> = Object.create(null);
  private _active: IDcsHandler[] = EMPTY_HANDLERS;
  private _ident: number = 0;
  private _handlerFb: DcsFallbackHandlerType = () => {};

  public dispose(): void {
    this._handlers = Object.create(null);
    this._handlerFb = () => {};
  }

  public addHandler(ident: number, handler: IDcsHandler): IDisposable {
    if (this._handlers[ident] === undefined) {
      this._handlers[ident] = [];
    }
    const handlerList = this._handlers[ident];
    handlerList.push(handler);
    return {
      dispose: () => {
        const handlerIndex = handlerList.indexOf(handler);
        if (handlerIndex !== -1) {
          handlerList.splice(handlerIndex, 1);
        }
      }
    };
  }

  public setHandler(ident: number, handler: IDcsHandler): void {
    this._handlers[ident] = [handler];
  }

  public clearHandler(ident: number): void {
    if (this._handlers[ident]) delete this._handlers[ident];
  }

  public setHandlerFallback(handler: DcsFallbackHandlerType): void {
    this._handlerFb = handler;
  }

  public reset(): void {
    if (this._active.length) {
      this.unhook(false);
    }
    this._active = EMPTY_HANDLERS;
    this._ident = 0;
  }

  public hook(ident: number, params: IParams): void {
    // always reset leftover handlers
    this.reset();
    this._ident = ident;
    this._active = this._handlers[ident] || EMPTY_HANDLERS;
    if (!this._active.length) {
      this._handlerFb(this._ident, 'HOOK', params);
    } else {
      for (let j = this._active.length - 1; j >= 0; j--) {
        this._active[j].hook(params);
      }
    }
  }

  public put(data: Uint32Array, start: number, end: number): void {
    if (!this._active.length) {
      this._handlerFb(this._ident, 'PUT', utf32ToString(data, start, end));
    } else {
      for (let j = this._active.length - 1; j >= 0; j--) {
        this._active[j].put(data, start, end);
      }
    }
  }

  public unhook(success: boolean): void {
    if (!this._active.length) {
      this._handlerFb(this._ident, 'UNHOOK', success);
    } else {
      let j = this._active.length - 1;
      for (; j >= 0; j--) {
        if (this._active[j].unhook(success) !== false) {
          break;
        }
      }
      j--;
      // cleanup left over handlers
      for (; j >= 0; j--) {
        this._active[j].unhook(false);
      }
    }
    this._active = EMPTY_HANDLERS;
    this._ident = 0;
  }
}

/**
 * Convenient class to create a DCS handler from a single callback function.
 * Note: The payload is currently limited to 50 MB (hardcoded).
 */
export class DcsHandler implements IDcsHandler {
  private _data = '';
  private _params: IParams | undefined;
  private _hitLimit: boolean = false;

  constructor(private _handler: (data: string, params: IParams) => any) {}

  public hook(params: IParams): void {
    this._params = params.clone();
    this._data = '';
    this._hitLimit = false;
  }

  public put(data: Uint32Array, start: number, end: number): void {
    if (this._hitLimit) {
      return;
    }
    this._data += utf32ToString(data, start, end);
    if (this._data.length > PAYLOAD_LIMIT) {
      this._data = '';
      this._hitLimit = true;
    }
  }

  public unhook(success: boolean): any {
    let ret;
    if (this._hitLimit) {
      ret = false;
    } else if (success) {
      ret = this._handler(this._data, this._params || new Params());
    }
    this._params = undefined;
    this._data = '';
    this._hitLimit = false;
    return ret;
  }
}
