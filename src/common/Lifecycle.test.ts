/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/// <reference path="../../node_modules/@types/node/index.d.ts" />
import * as assert from 'assert';
import { Disposable } from 'common/Lifecycle';

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
      assert.strictEqual(d.isDisposed, false);
      d.dispose();
      assert.strictEqual(d.isDisposed, true);
    });
  });
});
