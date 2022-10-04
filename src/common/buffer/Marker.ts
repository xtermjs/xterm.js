/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { initEvent } from 'common/EventEmitter';
import { Disposable } from 'common/Lifecycle';
import { IMarker } from 'common/Types';

export class Marker extends Disposable implements IMarker {
  private static _nextId = 1;

  private _id: number = Marker._nextId++;
  public isDisposed: boolean = false;

  public get id(): number { return this._id; }

  public readonly onDispose = initEvent<void>();

  constructor(
    public line: number
  ) {
    super();
  }

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    this.line = -1;
    // Emit before super.dispose such that dispose listeners get a change to react
    this.onDispose.fire();
    super.dispose();
  }
}
