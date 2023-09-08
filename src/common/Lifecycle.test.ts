/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { Disposable, MutableDisposable } from 'common/Lifecycle';
import { IDisposable } from 'common/Types';

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

describe('MutableDisposable', () => {
  const mutable = new MutableDisposable();
  class TrackedDisposable extends Disposable {
    public get isDisposed(): boolean { return this._isDisposed; }
  }
  describe('value', () => {
    it('should set the value', () => {
      const d1 = new TrackedDisposable();
      mutable.value = d1;
      assert.strictEqual(mutable.value, d1);
      assert.isFalse(d1.isDisposed);
    });
    it('should dispose of any previous value', () => {
      const d1 = new TrackedDisposable();
      const d2 = new TrackedDisposable();
      mutable.value = d1;
      mutable.value = d2;
      assert.strictEqual(mutable.value, d2);
      assert.isTrue(d1.isDisposed);
      assert.isFalse(d2.isDisposed);
    });
  });
  describe('clear', () => {
    it('should clear and dispose of the object', () => {
      const d1 = new TrackedDisposable();
      mutable.value = d1;
      mutable.clear();
      assert.strictEqual(mutable.value, undefined);
      assert.isTrue(d1.isDisposed);
    });
  });
  it('dispose', () => {
    it('should dispose of the object', () => {
      const d1 = new TrackedDisposable();
      mutable.value = d1;
      mutable.dispose();
      assert.strictEqual(mutable.value, undefined);
      assert.isTrue(d1.isDisposed);
    });
    it('should prevent using the MutableDisposable again', () => {
      const d1 = new TrackedDisposable();
      mutable.value = d1;
      mutable.dispose();
      mutable.value = new TrackedDisposable();
      assert.strictEqual(mutable.value, undefined);
    });
  });
});
