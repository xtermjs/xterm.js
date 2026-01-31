/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IApcHandler, IHandlerCollection, ApcFallbackHandlerType, IApcParser, ISubParserStackState } from 'common/parser/Types';
import { ApcState, PAYLOAD_LIMIT } from 'common/parser/Constants';
import { utf32ToString } from 'common/input/TextDecoder';
import { IDisposable } from 'common/Types';

const EMPTY_HANDLERS: IApcHandler[] = [];

/**
 * APC Parser for handling Application Program Command sequences.
 * APC sequences use the format: ESC _ <identifier><data> ESC \
 *
 * Unlike OSC which uses numeric identifiers (e.g., OSC 1337),
 * APC uses the first character as the identifier (e.g., 'G' for Kitty graphics).
 * The identifier is the character code of the first byte after ESC _.
 */
export class ApcParser implements IApcParser {
  private _state = ApcState.START;
  private _active = EMPTY_HANDLERS;
  private _id = -1;
  private _handlers: IHandlerCollection<IApcHandler> = Object.create(null);
  private _handlerFb: ApcFallbackHandlerType = () => { };
  private _stack: ISubParserStackState = {
    paused: false,
    loopPosition: 0,
    fallThrough: false
  };

  /**
   * Register an APC handler for a specific identifier.
   * @param ident The character code of the first byte (e.g., 0x47 for 'G')
   * @param handler The handler to register
   */
  public registerHandler(ident: number, handler: IApcHandler): IDisposable {
    this._handlers[ident] ??= [];
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

  public clearHandler(ident: number): void {
    if (this._handlers[ident]) delete this._handlers[ident];
  }

  public setHandlerFallback(handler: ApcFallbackHandlerType): void {
    this._handlerFb = handler;
  }

  public dispose(): void {
    this._handlers = Object.create(null);
    this._handlerFb = () => { };
    this._active = EMPTY_HANDLERS;
  }

  public reset(): void {
    // force cleanup handlers if payload was already sent
    if (this._state === ApcState.PAYLOAD) {
      for (let j = this._stack.paused ? this._stack.loopPosition - 1 : this._active.length - 1; j >= 0; --j) {
        this._active[j].end(false);
      }
    }
    this._stack.paused = false;
    this._active = EMPTY_HANDLERS;
    this._id = -1;
    this._state = ApcState.START;
  }

  private _start(): void {
    this._active = this._handlers[this._id] || EMPTY_HANDLERS;
    if (!this._active.length) {
      this._handlerFb(this._id, 'START');
    } else {
      for (let j = this._active.length - 1; j >= 0; j--) {
        this._active[j].start();
      }
    }
  }

  private _put(data: Uint32Array, start: number, end: number): void {
    if (!this._active.length) {
      this._handlerFb(this._id, 'PUT', utf32ToString(data, start, end));
    } else {
      for (let j = this._active.length - 1; j >= 0; j--) {
        this._active[j].put(data, start, end);
      }
    }
  }

  public start(): void {
    // always reset leftover handlers
    this.reset();
    this._state = ApcState.ID;
  }

  /**
   * Put data to current APC command.
   * For APC, the first character is used as the identifier.
   * Format: ESC _ <identifier><payload> ESC \
   * Example: ESC _ G f=100,a=T;... ESC \ (Kitty graphics, identifier='G')
   */
  public put(data: Uint32Array, start: number, end: number): void {
    if (this._state === ApcState.ABORT) {
      return;
    }
    if (this._state === ApcState.ID) {
      // The first character is the identifier
      if (start < end) {
        this._id = data[start++];
        this._state = ApcState.PAYLOAD;
        this._start();
      }
    }
    if (this._state === ApcState.PAYLOAD && end - start > 0) {
      this._put(data, start, end);
    }
  }

  /**
   * Indicates end of an APC command.
   * Whether the APC got aborted or finished normally
   * is indicated by `success`.
   */
  public end(success: boolean, promiseResult: boolean = true): void | Promise<boolean> {
    if (this._state === ApcState.START) {
      return;
    }
    // do nothing if command was faulty
    if (this._state !== ApcState.ABORT) {
      // if we are still in ID state and get an early end
      // means we got an empty APC sequence with no identifier,
      // which is invalid - just reset and return
      if (this._state === ApcState.ID) {
        this._active = EMPTY_HANDLERS;
        this._id = -1;
        this._state = ApcState.START;
        return;
      }

      if (!this._active.length) {
        this._handlerFb(this._id, 'END', success);
      } else {
        let handlerResult: boolean | Promise<boolean> = false;
        let j = this._active.length - 1;
        let fallThrough = false;
        if (this._stack.paused) {
          j = this._stack.loopPosition - 1;
          handlerResult = promiseResult;
          fallThrough = this._stack.fallThrough;
          this._stack.paused = false;
        }
        if (!fallThrough && handlerResult === false) {
          for (; j >= 0; j--) {
            handlerResult = this._active[j].end(success);
            if (handlerResult === true) {
              break;
            } else if (handlerResult instanceof Promise) {
              this._stack.paused = true;
              this._stack.loopPosition = j;
              this._stack.fallThrough = false;
              return handlerResult;
            }
          }
          j--;
        }
        // cleanup left over handlers
        // we always have to call .end for proper cleanup,
        // here we use `success` to indicate whether a handler should execute
        for (; j >= 0; j--) {
          handlerResult = this._active[j].end(false);
          if (handlerResult instanceof Promise) {
            this._stack.paused = true;
            this._stack.loopPosition = j;
            this._stack.fallThrough = true;
            return handlerResult;
          }
        }
      }

    }
    this._active = EMPTY_HANDLERS;
    this._id = -1;
    this._state = ApcState.START;
  }
}

/**
 * Convenient class to allow attaching string based handler functions
 * as APC handlers.
 */
export class ApcHandler implements IApcHandler {
  private static PAYLOAD_LIMIT = PAYLOAD_LIMIT;

  private _data = '';
  private _hitLimit: boolean = false;

  constructor(private _handler: (data: string) => boolean | Promise<boolean>) { }

  public start(): void {
    this._data = '';
    this._hitLimit = false;
  }

  public put(data: Uint32Array, start: number, end: number): void {
    if (this._hitLimit) {
      return;
    }
    this._data += utf32ToString(data, start, end);
    if (this._data.length > ApcHandler.PAYLOAD_LIMIT) {
      this._data = '';
      this._hitLimit = true;
    }
  }

  public end(success: boolean): boolean | Promise<boolean> {
    let ret: boolean | Promise<boolean> = false;
    if (this._hitLimit) {
      ret = false;
    } else if (success) {
      ret = this._handler(this._data);
      if (ret instanceof Promise) {
        // need to hold data until `ret` got resolved
        // dont care for errors, data will be freed anyway on next start
        return ret.then(res => {
          this._data = '';
          this._hitLimit = false;
          return res;
        });
      }
    }
    this._data = '';
    this._hitLimit = false;
    return ret;
  }
}
