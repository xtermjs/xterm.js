/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable, IMarker } from 'common/Types';
import { Emitter } from 'common/Event';
import { Buffer } from 'common/buffer/Buffer';
import { BufferLine, LogicalLine, LogicalColumn } from 'common/buffer/BufferLine';
import { dispose } from 'common/Lifecycle';

export class Marker implements IMarker {
  public payload?: IDisposable;
  private _buffer: Buffer | undefined;
  private _lineData: LogicalLine | undefined;
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

  public addToLine(buffer: Buffer, line: LogicalLine, startColumn: LogicalColumn): void {
    this._buffer = buffer;
    this._lineData = line;
    this._startColumn = startColumn;
    this._nextMarker = line._firstMarker;
    line._firstMarker = this;
  }

  /**
   * Get corresponding line number.
   * This uses an expensive linear search through the buffer, so should be avoided.
   * @deprecated
   *
   */
  public get line(): number {
    const buffer = this._buffer;
    if (! buffer) {
      return -1;
    }
    const nlines = buffer.lines.length;
    let prevLine: LogicalLine | undefined;
    for (let i: number = 0; i < nlines; i++) {
      const lline = (buffer.lines.get(i) as BufferLine).logicalLine;
      if (lline !== prevLine) {
        for (let m = lline._firstMarker; m; m = m._nextMarker) {
          if (m === this) {
            let bline = lline.firstBufferLine;
            for (let j = 0; ; j++) {
              if (! bline || this._startColumn >= bline.startColumn) {
                return i + j;
              }
              bline = bline?.nextBufferLine;
            }
          }
        }
        prevLine = lline;
      }
    }
    return -1;
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
    this._buffer = undefined;
    this._lineData = undefined;
    this._startColumn = -1;
  }

  public removeMarker(): void {
    const lline = this._lineData;
    if (! lline) {
      return;
    }
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
