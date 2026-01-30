/**
 * Copyright (c) 2024-2026 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Minimal lifecycle utilities for xterm.js core.
 * Simplified from VS Code's lifecycle.ts - no tracking/leak detection.
 */

export interface IDisposable {
  dispose(): void;
}

export function toDisposable(fn: () => void): IDisposable {
  return { dispose: fn };
}

export function dispose<T extends IDisposable>(disposables: T | T[] | undefined): void {
  if (!disposables) {
    return;
  }
  if (Array.isArray(disposables)) {
    for (const d of disposables) {
      d.dispose();
    }
  } else {
    disposables.dispose();
  }
}

export function combinedDisposable(...disposables: IDisposable[]): IDisposable {
  return toDisposable(() => dispose(disposables));
}

export class DisposableStore implements IDisposable {
  private readonly _disposables = new Set<IDisposable>();
  private _isDisposed = false;

  public get isDisposed(): boolean {
    return this._isDisposed;
  }

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
}

export abstract class Disposable implements IDisposable {
  protected readonly _store = new DisposableStore();

  public dispose(): void {
    this._store.dispose();
  }

  protected _register<T extends IDisposable>(o: T): T {
    return this._store.add(o);
  }
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
