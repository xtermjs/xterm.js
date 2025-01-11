/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable, IDisposableStore, ISharedExports } from '@xterm/xterm';


export class AddonDisposable implements IDisposable {
  protected readonly _store: IDisposableStore;

  constructor(sharedExports: ISharedExports) {
    this._store = new sharedExports.DisposableStore();
  }

  protected _register<T extends IDisposable>(o: T): T {
    if ((o as unknown as IDisposable) === this) {
      throw new Error('Cannot register a disposable on itself!');
    }
    return this._store.add(o);
  }

  public dispose(): void {
    this._store.dispose();
  }
}
