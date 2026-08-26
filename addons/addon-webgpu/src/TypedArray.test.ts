/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { sliceFallback } from './TypedArray';

type TypedArray = Uint8Array | Uint16Array | Uint32Array | Uint8ClampedArray | Int8Array | Int16Array | Int32Array | Float32Array | Float64Array;

function deepEquals(a: TypedArray, b: TypedArray): void {
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; ++i) {
    assert.equal(a[i], b[i]);
  }
}

describe('polyfill conformance tests', function(): void {
  describe('TypedArray.slice', () => {
    describe('should work with all typed array types', () => {
      it('Uint8Array', () => {
        const a = new Uint8Array(5);
        deepEquals(sliceFallback(a, 2), a.slice(2));
        deepEquals(sliceFallback(a, 65535), a.slice(65535));
        deepEquals(sliceFallback(a, -1), a.slice(-1));
      });
      it('Uint16Array', () => {
        const u161 = new Uint16Array(5);
        const u162 = new Uint16Array(5);
        deepEquals(sliceFallback(u161, 2), u162.slice(2));
        deepEquals(sliceFallback(u161, 65535), u162.slice(65535));
        deepEquals(sliceFallback(u161, -1), u162.slice(-1));
      });
      it('Uint32Array', () => {
        const u321 = new Uint32Array(5);
        const u322 = new Uint32Array(5);
        deepEquals(sliceFallback(u321, 2), u322.slice(2));
        deepEquals(sliceFallback(u321, 65537), u322.slice(65537));
        deepEquals(sliceFallback(u321, -1), u322.slice(-1));
      });
      it('Int8Array', () => {
        const i81 = new Int8Array(5);
        const i82 = new Int8Array(5);
        deepEquals(sliceFallback(i81, 2), i82.slice(2));
        deepEquals(sliceFallback(i81, 65537), i82.slice(65537));
        deepEquals(sliceFallback(i81, -1), i82.slice(-1));
      });
      it('Int16Array', () => {
        const i161 = new Int16Array(5);
        const i162 = new Int16Array(5);
        deepEquals(sliceFallback(i161, 2), i162.slice(2));
        deepEquals(sliceFallback(i161, 65535), i162.slice(65535));
        deepEquals(sliceFallback(i161, -1), i162.slice(-1));
      });
      it('Int32Array', () => {
        const i321 = new Int32Array(5);
        const i322 = new Int32Array(5);
        deepEquals(sliceFallback(i321, 2), i322.slice(2));
        deepEquals(sliceFallback(i321, 65537), i322.slice(65537));
        deepEquals(sliceFallback(i321, -1), i322.slice(-1));
      });
      it('Float32Array', () => {
        const f321 = new Float32Array(5);
        const f322 = new Float32Array(5);
        deepEquals(sliceFallback(f321, 2), f322.slice(2));
        deepEquals(sliceFallback(f321, 65537), f322.slice(65537));
        deepEquals(sliceFallback(f321, -1), f322.slice(-1));
      });
      it('Float64Array', () => {
        const f641 = new Float64Array(5);
        const f642 = new Float64Array(5);
        deepEquals(sliceFallback(f641, 2), f642.slice(2));
        deepEquals(sliceFallback(f641, 65537), f642.slice(65537));
        deepEquals(sliceFallback(f641, -1), f642.slice(-1));
      });
      it('Uint8ClampedArray', () => {
        const u8Clamped1 = new Uint8ClampedArray(5);
        const u8Clamped2 = new Uint8ClampedArray(5);
        deepEquals(sliceFallback(u8Clamped1, 2), u8Clamped2.slice(2));
        deepEquals(sliceFallback(u8Clamped1, 65537), u8Clamped2.slice(65537));
        deepEquals(sliceFallback(u8Clamped1, -1), u8Clamped2.slice(-1));
      });
    });
    it('start', () => {
      const arr = new Uint32Array([1, 2, 3, 4, 5]);
      deepEquals(sliceFallback(arr, -1), arr.slice(-1));
      deepEquals(sliceFallback(arr, 0), arr.slice(0));
      deepEquals(sliceFallback(arr, 1), arr.slice(1));
      deepEquals(sliceFallback(arr, 2), arr.slice(2));
      deepEquals(sliceFallback(arr, 3), arr.slice(3));
      deepEquals(sliceFallback(arr, 4), arr.slice(4));
      deepEquals(sliceFallback(arr, 5), arr.slice(5));
    });
    it('end', () => {
      const arr = new Uint32Array([1, 2, 3, 4, 5]);
      deepEquals(sliceFallback(arr, -1, -2), arr.slice(-1, -2));
      deepEquals(sliceFallback(arr, 0, -2), arr.slice(0, -2));
      deepEquals(sliceFallback(arr, 1, -2), arr.slice(1, -2));
      deepEquals(sliceFallback(arr, 2, -2), arr.slice(2, -2));
      deepEquals(sliceFallback(arr, 3, -2), arr.slice(3, -2));
      deepEquals(sliceFallback(arr, 4, -2), arr.slice(4, -2));
      deepEquals(sliceFallback(arr, 5, -2), arr.slice(5, -2));

      deepEquals(sliceFallback(arr, -1, 3), arr.slice(-1, 3));
      deepEquals(sliceFallback(arr, 0, 3), arr.slice(0, 3));
      deepEquals(sliceFallback(arr, 1, 3), arr.slice(1, 3));
      deepEquals(sliceFallback(arr, 2, 3), arr.slice(2, 3));
      deepEquals(sliceFallback(arr, 3, 3), arr.slice(3, 3));
      deepEquals(sliceFallback(arr, 4, 3), arr.slice(4, 3));
      deepEquals(sliceFallback(arr, 5, 3), arr.slice(5, 3));

      deepEquals(sliceFallback(arr, -1, 8), arr.slice(-1, 8));
      deepEquals(sliceFallback(arr, 0, 8), arr.slice(0, 8));
      deepEquals(sliceFallback(arr, 1, 8), arr.slice(1, 8));
      deepEquals(sliceFallback(arr, 2, 8), arr.slice(2, 8));
      deepEquals(sliceFallback(arr, 3, 8), arr.slice(3, 8));
      deepEquals(sliceFallback(arr, 4, 8), arr.slice(4, 8));
      deepEquals(sliceFallback(arr, 5, 8), arr.slice(5, 8));
    });
  });
});
