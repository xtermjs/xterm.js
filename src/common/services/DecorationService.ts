/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { css } from 'common/Color';
import { Disposable, DisposableStore, toDisposable } from 'common/Lifecycle';
import { IDecorationService, IInternalDecoration, ILogService } from 'common/services/Services';
import { IColor, IBufferLine } from 'common/Types';
import { Marker } from 'common/buffer/Marker';
import { IDecoration, IDecorationOptions, IMarker } from '@xterm/xterm';
import { Emitter } from 'common/Event';

// Work variables to avoid garbage collection
let $xmin = 0;
let $xmax = 0;
let $ymin = 0;
let $ymax = 0;

export class DecorationService extends Disposable implements IDecorationService {
  public serviceBrand: any;

  private readonly _onDecorationRegistered = this._register(new Emitter<IInternalDecoration>());
  public readonly onDecorationRegistered = this._onDecorationRegistered.event;
  private readonly _onDecorationRemoved = this._register(new Emitter<IInternalDecoration>());
  public readonly onDecorationRemoved = this._onDecorationRemoved.event;

  public get decorations(): IterableIterator<IInternalDecoration> {
    const iterator = {
      current: this._firstDecoration,
      next: (): IteratorResult<IInternalDecoration> => {
        const node = iterator.current;
        if (node) {
          iterator.current = node.nextDecoration;
          return { done: false, value: node };
        }
        return { done: true, value: undefined };
      },
      [Symbol.iterator]: () => {
        return iterator; }
    };
    return iterator;
  }
  private _firstDecoration: Decoration | undefined;
  private _lastDecoration: Decoration | undefined;

  constructor(@ILogService private readonly _logService: ILogService) {
    super();

    this._register(toDisposable(() => this.reset()));
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
          // Remove from linked list
          const previous = decoration.previousDecoration;
          const next = decoration.nextDecoration;
          if (previous) {
            previous.nextDecoration = next;
          } else {
            this._firstDecoration = next;
          }
          if (next) {
            next.previousDecoration = previous;
          } else {
            this._lastDecoration = previous;
          }
          this._onDecorationRemoved.fire(decoration);
          markerDispose.dispose();
        }
      });
      // insert decoration into linked list
      decoration.previousDecoration = this._lastDecoration;
      if (this._lastDecoration) {
        this._lastDecoration.nextDecoration = decoration;
      } else {
        this._firstDecoration = decoration;
      }
      this._lastDecoration = decoration;
      this._onDecorationRegistered.fire(decoration);
    }
    return decoration;
  }

  public reset(): void {
    for (let d = this._firstDecoration; d; d = d.nextDecoration) {
      d.dispose();
    }
  }

  /**
   * Only used in tests.
   * @deprecated
   */
  public *getDecorationsAtCell(x: number, line: number, layer?: 'bottom' | 'top'): IterableIterator<IInternalDecoration> {
    let xmin = 0;
    let xmax = 0;
    let ymin = 0;
    let ymax = 0;
    for (const d of this.decorations) {
      ymin = d.marker.line;
      ymax = ymin + (d.options.height ?? 1);
      if (line < ymin || line >= ymax) {
        continue;
      }
      xmin = d.options.x ?? 0;
      xmax = xmin + (d.options.width ?? 1);
      if (x >= xmin && x < xmax && (!layer || (d.options.layer ?? 'bottom') === layer)) {
        yield d;
      }
    }
  }

  public forEachDecorationAtCellLine(x: number, line: number, layer: 'bottom' | 'top' | undefined, callback: (decoration: IInternalDecoration) => void, bline: IBufferLine): void {
    const lline = bline.logical();
    x += bline.startColumn;
    lline.forEachMarker((marker: IMarker) => {
      const d = marker.payload;
      if (d instanceof Decoration) {
        const xmin = (marker as Marker)._startColumn;
        const xmax = xmin + (d.options.width ?? 1);
        if (x >= xmin && x < xmax && (!layer || (d.options.layer ?? 'bottom') === layer)) {
          callback(d);
        }
      }
    });
  }

  public forEachDecorationAtCell(x: number, line: number, layer: 'bottom' | 'top' | undefined, callback: (decoration: IInternalDecoration) => void): void {
    for (let d = this._firstDecoration; d; d = d.nextDecoration) {
      $ymin = d.marker.line;
      $ymax = $ymin + (d.options.height ?? 1);
      if (line < $ymin || line >= $ymax) {
        continue;
      }
      $xmin = d.options.x ?? 0;
      $xmax = $xmin + (d.options.width ?? 1);
      if (x >= $xmin && x < $xmax && (!layer || (d.options.layer ?? 'bottom') === layer)) {
        callback(d);
      }
    }
  }
}


class Decoration extends DisposableStore implements IInternalDecoration {
  public readonly marker: IMarker;
  public element: HTMLElement | undefined;
  public nextDecoration: Decoration | undefined;
  public previousDecoration: Decoration | undefined;

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
    if (options.x) { (this.marker as Marker)._startColumn += options.x; }
    this.marker.payload = this;
    if (this.options.overviewRulerOptions && !this.options.overviewRulerOptions.position) {
      this.options.overviewRulerOptions.position = 'full';
    }
  }

  public override dispose(): void {
    this._onDispose.fire();
    super.dispose();
  }
}
