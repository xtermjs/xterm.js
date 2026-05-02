/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { IBufferLineStringCache, IBufferLineStringCacheEntry } from 'common/buffer/BufferLine';
import { disposableTimeout } from 'common/Async';
import { Disposable, MutableDisposable, toDisposable } from 'common/Lifecycle';
import type { IDisposable } from 'common/Lifecycle';

const enum Constants {
  CacheTtlMs = 15000
}

export class BufferLineStringCache extends Disposable implements IBufferLineStringCache {
  public generation: number = 0;
  public readonly entries: Set<IBufferLineStringCacheEntry> = new Set();
  private readonly _clearTimeout = this._register(new MutableDisposable<IDisposable>());
  private _lastAccessTimestamp: number = 0;

  constructor() {
    super();
    this._register(toDisposable(() => this.entries.clear()));
  }

  public touch(): void {
    this._scheduleClear();
  }

  public allocateEntry(): IBufferLineStringCacheEntry {
    const entry: IBufferLineStringCacheEntry = {
      value: undefined,
      isTrimmed: false,
      generation: this.generation
    };
    this.entries.add(entry);
    this._scheduleClear();
    return entry;
  }

  public clear(): void {
    this._clearTimeout.clear();
    this._lastAccessTimestamp = 0;
    this.generation++;
    for (const entry of this.entries) {
      entry.value = undefined;
      entry.isTrimmed = false;
    }
    this.entries.clear();
  }

  private _scheduleClear(): void {
    this._lastAccessTimestamp = Date.now();
    if (this._clearTimeout.value) {
      return;
    }
    this._scheduleClearTimeout(Constants.CacheTtlMs);
  }

  private _scheduleClearTimeout(timeoutMs: number): void {
    this._clearTimeout.value = disposableTimeout(() => {
      const elapsed = Date.now() - this._lastAccessTimestamp;
      if (elapsed >= Constants.CacheTtlMs) {
        this.clear();
        return;
      }
      this._scheduleClearTimeout(Constants.CacheTtlMs - elapsed);
    }, timeoutMs);
  }
}
