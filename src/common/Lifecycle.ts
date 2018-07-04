/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from 'xterm';

/**
 * A base class that can be extended to provide convenience methods for managing the lifecycle of an
 * object and its components.
 */
export abstract class Disposable implements IDisposable {
  protected _disposables: IDisposable[] = [];

  constructor() {
  }

  /**
   * Disposes the object, triggering the `dispose` method on all registered IDisposables.
   */
  public dispose(): void {
    this._disposables.forEach(d => d.dispose());
    this._disposables.length = 0;
  }

  /**
   * Registers a disposable object.
   * @param d The disposable to register.
   */
  public register<T extends IDisposable>(d: T): void {
    this._disposables.push(d);
  }
}
