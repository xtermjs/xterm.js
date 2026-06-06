/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { ICircularList, IDeleteEvent, IInsertEvent } from '../primitives/CircularList';
import { MicrotaskTimer } from '../primitives/Async';
import { css } from '../primitives/Color';
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from '../primitives/Lifecycle';
import { IBufferService, IDecorationService, IInternalDecoration, ILogService } from './Services';
import { SortedList } from '../primitives/SortedList';
import { IColor } from '../Types';
import { IDecoration, IDecorationOptions, IMarker } from '@xterm/xterm';
import { Emitter } from '../primitives/Event';

// Work variables to avoid garbage collection
let $xmin = 0;
let $xmax = 0;

export class DecorationService extends Disposable implements IDecorationService {
  public serviceBrand: any;

  /**
   * A list of all decorations, sorted by the marker's line value. This relies on the fact that
   * while marker line values do change, they should all change by the same amount so this should
   * never become out of order.
   */
  private readonly _decorations: SortedList<IInternalDecoration>;

  private readonly _lineCache = this._register(new DecorationLineCache());

  private readonly _onDecorationRegistered = this._register(new Emitter<IInternalDecoration>());
  public readonly onDecorationRegistered = this._onDecorationRegistered.event;
  private readonly _onDecorationRemoved = this._register(new Emitter<IInternalDecoration>());
  public readonly onDecorationRemoved = this._onDecorationRemoved.event;

  public get decorations(): IterableIterator<IInternalDecoration> { return this._decorations.values(); }

  constructor(
    @ILogService private readonly _logService: ILogService,
    @IBufferService private readonly _bufferService: IBufferService
  ) {
    super();

    this._decorations = new SortedList(e => e?.marker.line, this._logService);

    this._register(toDisposable(() => this.reset()));
    this._register(this._bufferService.buffers.onBufferActivate(() => {
      this._lineCache.attachToBufferLines(this._bufferService.buffer.lines);
    }));
    this._lineCache.attachToBufferLines(this._bufferService.buffer.lines);
  }

  public registerDecoration(options: IDecorationOptions): IDecoration | undefined {
    if (options.marker.isDisposed) {
      return undefined;
    }
    const decoration = new Decoration(options);
    if (decoration) {
      const markerDispose = decoration.marker.onDispose(() => decoration.dispose());
      const listener = decoration.onDispose(() => {
        listener.dispose();
        if (decoration) {
          if (this._decorations.delete(decoration)) {
            this._lineCache.remove(decoration);
            this._onDecorationRemoved.fire(decoration);
          }
          markerDispose.dispose();
        }
      });
      this._decorations.insert(decoration);
      this._lineCache.add(decoration);
      this._onDecorationRegistered.fire(decoration);
    }
    return decoration;
  }

  public reset(): void {
    for (const d of this._decorations.values()) {
      d.dispose();
    }
    this._decorations.clear();
    this._lineCache.clear();
  }

  public *getDecorationsAtCell(x: number, line: number, layer?: 'bottom' | 'top'): IterableIterator<IInternalDecoration> {
    const bucket = this._lineCache.getDecorationsOnLine(line);
    if (!bucket) {
      return;
    }
    for (const d of bucket) {
      $xmin = d.options.x ?? 0;
      $xmax = $xmin + (d.options.width ?? 1);
      if (x >= $xmin && x < $xmax && (!layer || (d.options.layer ?? 'bottom') === layer)) {
        yield d;
      }
    }
  }

  public forEachDecorationAtCell(x: number, line: number, layer: 'bottom' | 'top' | undefined, callback: (decoration: IInternalDecoration) => void): void {
    const bucket = this._lineCache.getDecorationsOnLine(line);
    if (!bucket) {
      return;
    }
    for (const d of bucket) {
      $xmin = d.options.x ?? 0;
      $xmax = $xmin + (d.options.width ?? 1);
      if (x >= $xmin && x < $xmax && (!layer || (d.options.layer ?? 'bottom') === layer)) {
        callback(d);
      }
    }
  }
}

/**
 * Per-logical-line index of decorations for fast cell lookup.
 *
 * Keys are marker.line coordinates (logical buffer lines), not CircularList ring slots.
 * Multi-line decorations appear in every line bucket they span. The index is kept aligned
 * with marker.line updates via buffer line trim/insert/delete events.
 */
export class DecorationLineCache extends Disposable {
  private readonly _decorationsByLine: Map<number, IInternalDecoration[]> = new Map();
  private readonly _decorations = new Set<IInternalDecoration>();
  private readonly _bufferLineListeners = this._register(new MutableDisposable<DisposableStore>());
  private readonly _lineIndexSyncTimer = this._register(new MicrotaskTimer());
  private _lineIndexSyncCallbacks: (() => void)[] = [];

  public clear(): void {
    this._lineIndexSyncCallbacks.length = 0;
    this._lineIndexSyncTimer.cancel();
    this._decorationsByLine.clear();
    this._decorations.clear();
  }

  public add(decoration: IInternalDecoration): void {
    this._decorations.add(decoration);
    this._addToLineBuckets(decoration);
  }

  public remove(decoration: IInternalDecoration): void {
    this._decorations.delete(decoration);
    this._removeFromLineBuckets(decoration);
  }

  public getDecorationsOnLine(line: number): ReadonlyArray<IInternalDecoration> | undefined {
    return this._decorationsByLine.get(line);
  }

  public attachToBufferLines(lines: ICircularList<unknown>): void {
    const store = new DisposableStore();
    this._bufferLineListeners.value = store;
    store.add(lines.onTrim(amount => this._handleBufferLinesTrim(amount)));
    store.add(lines.onInsert(event => this._handleBufferLinesInsert(event)));
    store.add(lines.onDelete(event => this._handleBufferLinesDelete(event)));
  }

  private _getDecorationHeight(decoration: IInternalDecoration): number {
    return decoration.options.height ?? 1;
  }

  private _addToLineBuckets(decoration: IInternalDecoration): void {
    const start = decoration.marker.line;
    if (start < 0) {
      return;
    }
    decoration._indexedStartLine = start;
    const height = this._getDecorationHeight(decoration);
    for (let line = start; line < start + height; line++) {
      let bucket = this._decorationsByLine.get(line);
      if (!bucket) {
        bucket = [];
        this._decorationsByLine.set(line, bucket);
      }
      bucket.push(decoration);
    }
  }

  private _removeFromLineBuckets(decoration: IInternalDecoration): void {
    const start = decoration._indexedStartLine;
    const height = this._getDecorationHeight(decoration);
    for (let line = start; line < start + height; line++) {
      const bucket = this._decorationsByLine.get(line);
      if (!bucket) {
        continue;
      }
      const index = bucket.indexOf(decoration);
      if (index !== -1) {
        bucket.splice(index, 1);
      }
      if (bucket.length === 0) {
        this._decorationsByLine.delete(line);
      }
    }
  }

  private _reindexDecoration(decoration: IInternalDecoration): void {
    this._removeFromLineBuckets(decoration);
    if (!decoration.marker.isDisposed && decoration.marker.line >= 0) {
      this._addToLineBuckets(decoration);
    }
  }

  /** Re-index after marker line updates (buffer listeners may run before markers). */
  private _scheduleLineIndexSync(callback: () => void): void {
    this._lineIndexSyncCallbacks.push(callback);
    this._lineIndexSyncTimer.set(() => {
      const callbacks = this._lineIndexSyncCallbacks;
      this._lineIndexSyncCallbacks = [];
      for (const cb of callbacks) {
        cb();
      }
    });
  }

  private _handleBufferLinesTrim(amount: number): void {
    if (amount <= 0) {
      return;
    }
    const newMap = new Map<number, IInternalDecoration[]>();
    for (const [line, bucket] of this._decorationsByLine) {
      const newLine = line - amount;
      if (newLine < 0) {
        continue;
      }
      this._mergeLineBucket(newMap, newLine, bucket);
    }
    this._decorationsByLine.clear();
    for (const [line, bucket] of newMap) {
      this._decorationsByLine.set(line, bucket);
    }
    for (const d of this._decorations) {
      if (!d.marker.isDisposed) {
        d._indexedStartLine -= amount;
      }
    }
  }

  private _handleBufferLinesInsert(event: IInsertEvent): void {
    this._scheduleLineIndexSync(() => this._applyBufferLinesInsert(event));
  }

  private _handleBufferLinesDelete(event: IDeleteEvent): void {
    this._scheduleLineIndexSync(() => this._applyBufferLinesDelete(event));
  }

  private _mergeLineBucket(newMap: Map<number, IInternalDecoration[]>, line: number, bucket: IInternalDecoration[]): void {
    const existing = newMap.get(line);
    if (existing) {
      for (let i = 0, len = bucket.length; i < len; i++) {
        existing.push(bucket[i]);
      }
    } else {
      newMap.set(line, bucket.slice());
    }
  }

  /**
   * Shift indexed line keys and sync start lines. O(unique indexed lines), not O(decoration count).
   * Decorations that span the insert point are re-indexed individually (rare vs single-line hits).
   */
  private _applyBufferLinesInsert(event: IInsertEvent): void {
    const { index, amount } = event;
    const spanCrossers: IInternalDecoration[] = [];
    for (const d of this._decorations) {
      if (d.marker.isDisposed) {
        continue;
      }
      const start = d._indexedStartLine;
      if (start < index && start + this._getDecorationHeight(d) > index) {
        spanCrossers.push(d);
        this._removeFromLineBuckets(d);
      }
    }
    const newMap = new Map<number, IInternalDecoration[]>();
    for (const [line, bucket] of this._decorationsByLine) {
      const newLine = line >= index ? line + amount : line;
      this._mergeLineBucket(newMap, newLine, bucket);
    }
    this._decorationsByLine.clear();
    for (const [line, bucket] of newMap) {
      this._decorationsByLine.set(line, bucket);
    }
    for (const d of this._decorations) {
      if (d.marker.isDisposed) {
        continue;
      }
      if (d._indexedStartLine >= index) {
        d._indexedStartLine = d.marker.line;
      }
    }
    for (const d of spanCrossers) {
      this._addToLineBuckets(d);
    }
  }

  /**
   * Drop deleted line keys, shift keys below, sync start lines. Full re-index only when a
   * multi-line decoration spans across the deleted range but survives.
   */
  private _applyBufferLinesDelete(event: IDeleteEvent): void {
    const deleteEnd = event.index + event.amount;
    const newMap = new Map<number, IInternalDecoration[]>();
    for (const [line, bucket] of this._decorationsByLine) {
      if (line >= event.index && line < deleteEnd) {
        continue;
      }
      const newLine = line >= deleteEnd ? line - event.amount : line;
      this._mergeLineBucket(newMap, newLine, bucket);
    }
    this._decorationsByLine.clear();
    for (const [line, bucket] of newMap) {
      this._decorationsByLine.set(line, bucket);
    }
    const toReindex: IInternalDecoration[] = [];
    for (const d of this._decorations) {
      if (d.marker.isDisposed) {
        continue;
      }
      const start = d._indexedStartLine;
      const height = this._getDecorationHeight(d);
      if (start >= deleteEnd) {
        d._indexedStartLine = d.marker.line;
      } else if (start < event.index && start + height > deleteEnd) {
        toReindex.push(d);
      }
    }
    for (const d of toReindex) {
      this._reindexDecoration(d);
    }
  }
}

class Decoration extends DisposableStore implements IInternalDecoration {
  public readonly marker: IMarker;
  public element: HTMLElement | undefined;

  /** Start line used for line-index removal when marker.line is cleared on dispose. */
  public _indexedStartLine: number;

  public readonly onRenderEmitter = this.add(new Emitter<HTMLElement>());
  public readonly onRender = this.onRenderEmitter.event;
  private readonly _onDispose = this.add(new Emitter<void>());
  public readonly onDispose = this._onDispose.event;

  private _cachedBg: IColor | undefined | null = null;
  public get backgroundColorRGB(): IColor | undefined {
    if (this._cachedBg === null) {
      if (this.options.backgroundColor) {
        this._cachedBg = css.toColor(this.options.backgroundColor);
      } else {
        this._cachedBg = undefined;
      }
    }
    return this._cachedBg;
  }

  private _cachedFg: IColor | undefined | null = null;
  public get foregroundColorRGB(): IColor | undefined {
    if (this._cachedFg === null) {
      if (this.options.foregroundColor) {
        this._cachedFg = css.toColor(this.options.foregroundColor);
      } else {
        this._cachedFg = undefined;
      }
    }
    return this._cachedFg;
  }

  constructor(
    public readonly options: IDecorationOptions
  ) {
    super();
    this.marker = options.marker;
    this._indexedStartLine = options.marker.line;
    if (this.options.overviewRulerOptions && !this.options.overviewRulerOptions.position) {
      this.options.overviewRulerOptions.position = 'full';
    }
  }

  public override dispose(): void {
    this._onDispose.fire();
    super.dispose();
  }
}
