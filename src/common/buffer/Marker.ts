/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { EventEmitter } from 'common/EventEmitter';
import { disposeArray } from 'common/Lifecycle';
import { IDisposable, IMarker } from 'common/Types';

export class Marker implements IMarker {
  private static _nextId = 1;

  public isDisposed: boolean = false;
  private _disposables: IDisposable[] = [];

  private _id: number = Marker._nextId++;
  public get id(): number { return this._id; }


  private readonly _onDispose = new EventEmitter<void>();
  public readonly onDispose = this._onDispose.event;

  constructor(
    public line: number
  ) {
  }

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    this.line = -1;
    // Emit before super.dispose such that dispose listeners get a change to react
    this._onDispose.fire();
    disposeArray(this._disposables);
  }

  public register(disposable: IDisposable): void {
    this._disposables.push(disposable);
    this._disposables.length = 0;
  }
}
