/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { Disposable } from './Lifecycle';

class TestDisposable extends Disposable {
  public get isDisposed(): boolean {
    return this._isDisposed;
  }
}

describe('Disposable', () => {
  describe('register', () => {
    it('should register disposables', () => {
      const d = new TestDisposable();
      const d2 = {
        dispose: () => { throw new Error(); }
      };
      d.register(d2);
      assert.throws(() => d.dispose());
    });
  });
  describe('unregister', () => {
    it('should unregister disposables', () => {
      const d = new TestDisposable();
      const d2 = {
        dispose: () => { throw new Error(); }
      };
      d.register(d2);
      d.unregister(d2);
      assert.doesNotThrow(() => d.dispose());
    });
  });
  describe('dispose', () => {
    it('should set is disposed flag', () => {
      const d = new TestDisposable();
      assert.isFalse(d.isDisposed);
      d.dispose();
      assert.isTrue(d.isDisposed);
    });
  });
});
