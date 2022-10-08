/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { EventEmitter } from 'common/EventEmitter';
import { Disposable, toDisposable } from 'common/Lifecycle';
import { IMarker } from 'common/Types';

export class Marker extends Disposable implements IMarker {
  private static _nextId = 1;

  private _id: number = Marker._nextId++;
  public get id(): number { return this._id; }

  private readonly _onDispose = this.register(new EventEmitter<void>());
  public readonly onDispose = this._onDispose.event;

  public get isDisposed(): boolean { return this._isDisposed; }

  constructor(
    public line: number
  ) {
    super();
    this.register(toDisposable(() => {
      this.line = -1;
      this._onDispose.fire();
    }));
  }
}
