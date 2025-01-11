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

  public dispose(): void {
    this._store.dispose();
  }
}
