/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from './lifecycle';

export class TimeoutTimer implements IDisposable {
  private _token: any = -1;
  private _isDisposed = false;

  dispose(): void {
    this.cancel();
    this._isDisposed = true;
  }

  cancel(): void {
    if (this._token !== -1) {
      clearTimeout(this._token);
      this._token = -1;
    }
  }

  cancelAndSet(runner: () => void, timeout: number): void {
    if (this._isDisposed) {
      throw new Error('Calling cancelAndSet on a disposed TimeoutTimer');
    }
    this.cancel();
    this._token = setTimeout(() => {
      this._token = -1;
      runner();
    }, timeout);
  }

  setIfNotSet(runner: () => void, timeout: number): void {
    if (this._isDisposed) {
      throw new Error('Calling setIfNotSet on a disposed TimeoutTimer');
    }
    if (this._token !== -1) {
      return;
    }
    this._token = setTimeout(() => {
      this._token = -1;
      runner();
    }, timeout);
  }
}

export class IntervalTimer implements IDisposable {
  private _disposable: IDisposable | undefined;
  private _isDisposed = false;

  cancel(): void {
    this._disposable?.dispose();
    this._disposable = undefined;
  }

  cancelAndSet(runner: () => void, interval: number, context: Window | typeof globalThis = globalThis): void {
    if (this._isDisposed) {
      throw new Error('Calling cancelAndSet on a disposed IntervalTimer');
    }
    this.cancel();
    const handle = context.setInterval(() => {
      runner();
    }, interval);
    this._disposable = {
      dispose: () => {
        context.clearInterval(handle as any);
        this._disposable = undefined;
      }
    };
  }

  dispose(): void {
    this.cancel();
    this._isDisposed = true;
  }
}
