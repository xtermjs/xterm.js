/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from 'common/Types';
import { IDcsHandler, IParams, ParamsArray, IHandlerCollection, IDcsParser, DcsFallbackHandler } from 'common/parser/Types';
import { utf32ToString } from 'common/input/TextDecoder';
import { Params } from 'common/parser/Params';
import { PAYLOAD_LIMIT } from 'common/parser/Constants';


export class DcsParser implements IDcsParser {
  private _handlers: IHandlerCollection<IDcsHandler> = Object.create(null);
  private _active: IDcsHandler[] = [];
  private _collectAndFlag: string = '';
  private _handlerFb: DcsFallbackHandler = () => {};

  public dispose(): void {
    this._handlers = Object.create(null);
    this._handlerFb = () => {};
  }

  public addDcsHandler(collectAndFlag: string, handler: IDcsHandler): IDisposable {
    if (this._handlers[collectAndFlag] === undefined) {
      this._handlers[collectAndFlag] = [];
    }
    const handlerList = this._handlers[collectAndFlag];
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

  public setDcsHandler(collectAndFlag: string, handler: IDcsHandler): void {
    this._handlers[collectAndFlag] = [handler];
  }

  public clearDcsHandler(collectAndFlag: string): void {
    if (this._handlers[collectAndFlag]) delete this._handlers[collectAndFlag];
  }

  public setDcsHandlerFallback(handler: DcsFallbackHandler): void {
    this._handlerFb = handler;
  }

  public reset(): void {
    if (this._active.length) {
      this.unhook(false);
    }
    this._active = [];
    this._collectAndFlag = '';
  }

  public hook(collect: string, params: IParams, flag: number): void {
    this._collectAndFlag = collect + String.fromCharCode(flag);
    this._active = this._handlers[this._collectAndFlag] || [];
    if (!this._active.length) {
      this._handlerFb(this._collectAndFlag, 'HOOK', {collect, params, flag});
    } else {
      for (let j = this._active.length - 1; j >= 0; j--) {
        this._active[j].hook(collect, params, flag);
      }
    }
  }

  public put(data: Uint32Array, start: number, end: number): void {
    if (!this._active.length) {
      this._handlerFb(this._collectAndFlag, 'PUT', utf32ToString(data, start, end));
    } else {
      for (let j = this._active.length - 1; j >= 0; j--) {
        this._active[j].put(data, start, end);
      }
    }
  }

  public unhook(success: boolean): void {
    if (!this._active.length) {
      this._handlerFb(this._collectAndFlag, 'UNHOOK', success);
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
    this._active = [];
    this._collectAndFlag = '';
  }
}

/**
 * Convenient class to create a DCS handler from a single callback function.
 * Note: The payload is currently limited to 50 MB (hardcoded).
 */
export class DcsHandlerFactory implements IDcsHandler {
  private _data = '';
  private _params: IParams | undefined;
  private _hitLimit: boolean = false;

  constructor(private _handler: (params: IParams, data: string) => any) {}

  public hook(collect: string, params: IParams, flag: number): void {
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
      ret = this._handler(this._params ? this._params : new Params(), this._data);
    }
    this._params = undefined;
    this._data = '';
    this._hitLimit = false;
    return ret;
  }
}
