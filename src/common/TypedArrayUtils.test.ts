/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { concat } from 'common/TypedArrayUtils';

type TypedArray = Uint8Array | Uint16Array | Uint32Array | Uint8ClampedArray | Int8Array | Int16Array | Int32Array | Float32Array | Float64Array;

function deepEquals(a: TypedArray, b: TypedArray): void {
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; ++i) {
    assert.equal(a[i], b[i]);
  }
}

describe('typed array convenience functions', () => {
  it('concat', () => {
    const a = new Uint8Array([1, 2, 3, 4, 5]);
    const b = new Uint8Array([6, 7, 8, 9, 0]);
    const merged = concat(a, b);
    deepEquals(merged, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]));
  });
});
