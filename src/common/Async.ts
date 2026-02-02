/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Minimal async helpers for xterm.js core.
 */

import { DisposableStore, IDisposable, toDisposable } from 'common/Lifecycle';

export function timeout(millis: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, millis));
}

/**
 * Creates a timeout that can be disposed using its returned value.
 * @param handler The timeout handler.
 * @param timeout An optional timeout in milliseconds.
 * @param store An optional {@link DisposableStore} that will have the timeout disposable managed
 * automatically.
 */
export function disposableTimeout(handler: () => void, timeout = 0, store?: DisposableStore): IDisposable {
  const timer = setTimeout(() => {
    handler();
    if (store) {
      disposable.dispose();
    }
  }, timeout);
  const disposable = toDisposable(() => {
    clearTimeout(timer);
  });
  store?.add(disposable);
  return disposable;
}

export class TimeoutTimer implements IDisposable {
  private _token: any = -1;
  private _isDisposed = false;

  public dispose(): void {
    this.cancel();
    this._isDisposed = true;
  }

  public cancel(): void {
    if (this._token !== -1) {
      clearTimeout(this._token);
      this._token = -1;
    }
  }

  public cancelAndSet(runner: () => void, timeout: number): void {
    if (this._isDisposed) {
      throw new Error('Calling cancelAndSet on a disposed TimeoutTimer');
    }
    this.cancel();
    this._token = setTimeout(() => {
      this._token = -1;
      runner();
    }, timeout);
  }

  public setIfNotSet(runner: () => void, timeout: number): void {
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

  public cancel(): void {
    this._disposable?.dispose();
    this._disposable = undefined;
  }

  public cancelAndSet(runner: () => void, interval: number, context: Window | typeof globalThis = globalThis): void {
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

  public dispose(): void {
    this.cancel();
    this._isDisposed = true;
  }
}
