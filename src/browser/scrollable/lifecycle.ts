/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Minimal lifecycle utilities for scrollable components.
 */

export interface IDisposable {
  dispose(): void;
}

export function toDisposable(fn: () => void): IDisposable {
  return { dispose: fn };
}

export function dispose<T extends IDisposable>(disposable: T): T;
export function dispose<T extends IDisposable>(disposable: T | undefined): T | undefined;
export function dispose<T extends IDisposable>(disposables: T[]): T[];
export function dispose<T extends IDisposable>(arg: T | T[] | undefined): T | T[] | undefined {
  if (!arg) {
    return arg;
  }
  if (Array.isArray(arg)) {
    for (const d of arg) {
      d.dispose();
    }
    return [];
  }
  arg.dispose();
  return arg;
}

export function combinedDisposable(...disposables: IDisposable[]): IDisposable {
  return toDisposable(() => dispose(disposables));
}

export class DisposableStore implements IDisposable {
  private readonly _disposables = new Set<IDisposable>();
  private _isDisposed = false;

  public add<T extends IDisposable>(o: T): T {
    if (this._isDisposed) {
      o.dispose();
    } else {
      this._disposables.add(o);
    }
    return o;
  }

  public dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables.clear();
  }

  public clear(): void {
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables.clear();
  }
}

export abstract class Disposable implements IDisposable {
  static readonly None: IDisposable = Object.freeze({ dispose() { } });

  protected readonly _store = new DisposableStore();

  public dispose(): void {
    this._store.dispose();
  }

  protected _register<T extends IDisposable>(o: T): T {
    return this._store.add(o);
  }
}

export function markAsSingleton<T extends IDisposable>(singleton: T): T {
  return singleton;
}

export class MutableDisposable<T extends IDisposable> implements IDisposable {
  private _value: T | undefined;
  private _isDisposed = false;

  public get value(): T | undefined {
    return this._isDisposed ? undefined : this._value;
  }

  public set value(value: T | undefined) {
    if (this._isDisposed || value === this._value) {
      return;
    }
    this._value?.dispose();
    this._value = value;
  }

  public clear(): void {
    this.value = undefined;
  }

  public dispose(): void {
    this._isDisposed = true;
    this._value?.dispose();
    this._value = undefined;
  }
}
