/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable, IDisposableStore, DisposableStoreCtorType, EmitterCtorType } from '@xterm/xterm';

export { DisposableStore, toDisposable } from 'vs/base/common/lifecycle';
export { Emitter } from 'vs/base/common/event';

export class DisposableAddon implements IDisposable {
  protected readonly _store: IDisposableStore;

  constructor(storeCtor: DisposableStoreCtorType) {
    this._store = new storeCtor();
  }

  dispose(): void {
    this._store.dispose();
  }
}


export class EmitterAddon {
  constructor(
    protected readonly emitterCtor: EmitterCtorType
  ) {}
}


export class DisposableEmitterAddon implements IDisposable {
  protected readonly _store: IDisposableStore;

  constructor(
    readonly storeCtor: DisposableStoreCtorType,
    protected readonly emitterCtor: EmitterCtorType
  ) {
    this._store = new storeCtor();
  }

  dispose(): void {
    this._store.dispose();
  }
}
