/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { IBufferLineStringCache, IBufferLineStringCacheEntry } from 'common/buffer/BufferLine';
import { disposableTimeout } from 'common/Async';
import type { IDisposable } from 'common/Lifecycle';

const STRING_CACHE_CLEAR_DELAY_MS = 50;

export class BufferLineStringCache implements IBufferLineStringCache, IDisposable {
  public generation: number = 0;
  public readonly entries: Set<IBufferLineStringCacheEntry> = new Set();
  private _clearTimeout: IDisposable | undefined;

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
    this._clearTimeout?.dispose();
    this._clearTimeout = undefined;
    this.generation++;
    for (const entry of this.entries) {
      entry.value = undefined;
      entry.isTrimmed = false;
    }
    this.entries.clear();
  }

  public dispose(): void {
    this.clear();
  }

  private _scheduleClear(): void {
    this._clearTimeout?.dispose();
    this._clearTimeout = disposableTimeout(() => {
      this._clearTimeout = undefined;
      this.clear();
    }, STRING_CACHE_CLEAR_DELAY_MS);
  }
}
