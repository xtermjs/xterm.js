/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from 'xterm';

export abstract class Disposable implements IDisposable {
  protected _disposables: IDisposable[] = [];

  constructor() {
  }

  public dispose(): void {
    this._disposables.forEach(d => d.dispose());
    this._disposables.length = 0;
  }

  public register<T extends IDisposable>(t: T): void {
    this._disposables.push(t);
  }
}
