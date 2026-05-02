/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { IBufferLineStringCache, IBufferLineStringCacheEntry } from 'common/buffer/BufferLine';

export class BufferLineStringCache implements IBufferLineStringCache {
  public generation: number = 0;
  public readonly entries: Set<IBufferLineStringCacheEntry> = new Set();

  constructor(private readonly _onCacheUsed: () => void = () => { }) { }

  public touch(): void {
    this._onCacheUsed();
  }

  public allocateEntry(): IBufferLineStringCacheEntry {
    const entry: IBufferLineStringCacheEntry = {
      value: undefined,
      isTrimmed: false,
      generation: this.generation
    };
    this.entries.add(entry);
    this._onCacheUsed();
    return entry;
  }

  public clear(): void {
    this.generation++;
    for (const entry of this.entries) {
      entry.value = undefined;
      entry.isTrimmed = false;
    }
    this.entries.clear();
  }
}
