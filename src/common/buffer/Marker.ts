/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable, IMarker } from 'common/Types';
import { Emitter } from 'common/Event';
import { Buffer } from 'common/buffer/Buffer';
import { BufferLine, LogicalColumn } from 'common/buffer/BufferLine';
import { dispose } from 'common/Lifecycle';

export class Marker implements IMarker {
  public payload?: IDisposable;
  private _buffer: Buffer | undefined;
  /** @internal */
  public _lineData: BufferLine | undefined;
  /**
   * @internal
   */
  public _startColumn: LogicalColumn = -1;
  /**
   * @internal
   */
  public _nextMarker: Marker | undefined;
  private static _nextId = 1;

  public isDisposed: boolean = false;
  private readonly _disposables: IDisposable[] = [];
  private readonly _id: number = Marker._nextId++;
  /**
   * @deprecated
   */
  public get id(): number { return this._id; }

  public addDisposable<T extends IDisposable>(o: T): T {
    if (this.isDisposed) {
      o.dispose();
    } else {
      this._disposables.push(o);
    }
    return o;
  }

  private readonly _onDispose = this.register(new Emitter<void>());
  public readonly onDispose = this._onDispose.event;

  public addToLine(buffer: Buffer, bline: BufferLine, startColumn: LogicalColumn): void {
    this._buffer = buffer;
    this._lineData = bline;
    const lline = bline.logical();
    this._startColumn = startColumn;
    this._nextMarker = lline._firstMarker;
    lline._firstMarker = this;
  }

  /**
   * Get corresponding line number.
   *
   */
  public get line(): number {
    return this._buffer && this._lineData
      ? this._buffer.lineNumberOf(this._lineData)
      : -1;
  }

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    // Emit before super.dispose such that dispose listeners get a change to react
    this._onDispose.fire();
    dispose(this._disposables);
    this._disposables.length = 0;
    this.removeMarker();
    this._buffer = undefined;
    this._lineData = undefined;
    this._startColumn = -1;
  }

  public removeMarker(): void {
    const bline = this._lineData;
    if (! bline) {
      return;
    }
    const lline = bline.logical();
    let prev: Marker | undefined;
    for (let m = lline._firstMarker; m; ) {
      const next = m._nextMarker;
      if (m === this) {
        if (prev) { prev._nextMarker = next; }
        else { lline._firstMarker = next; }
        break;
      }
      prev = m;
      m = next;
    }
    this._nextMarker = undefined;
  }

  public register<T extends IDisposable>(disposable: T): T {
    this._disposables.push(disposable);
    return disposable;
  }
}
