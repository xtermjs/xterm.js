/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { fill } from './TypedArrayUtils';

type TypedArray = Uint8Array | Uint16Array | Uint32Array | Uint8ClampedArray
  | Int8Array | Int16Array | Int32Array
  | Float32Array | Float64Array;

// we explicitly test against the looping version in the test cases
function loopFill(array: TypedArray, value: number, start: number = 0, end?: number | undefined): TypedArray {
  if (start >= array.length) {
    return array;
  }
  start = (array.length + start) % array.length;
  if (end === undefined) {
    end = array.length;
  }
  if (end >= array.length) {
    end = array.length;
  } else {
    end = (array.length + end) % array.length;
  }
  for (let i = start; i < end; ++i) {
    array[i] = value;
  }
  return array;
}

describe('polyfill conformance tests', function(): void {

  function deepEquals(a: TypedArray, b: TypedArray): void {
    assert.equal(a.length, b.length);
    for (let i = 0; i < a.length; ++i) {
      assert.equal(a[i], b[i]);
    }
  }

  describe('TypedArray.fill', function(): void {
    it('should work with all typed array types', function(): void {
      const u81 = new Uint8Array(5);
      const u82 = new Uint8Array(5);
      deepEquals(fill(u81, 2), u82.fill(2));
      deepEquals(fill(u81, -1), u82.fill(-1));
      const u161 = new Uint16Array(5);
      const u162 = new Uint16Array(5);
      deepEquals(fill(u161, 2), u162.fill(2));
      deepEquals(fill(u161, 65535), u162.fill(65535));
      deepEquals(fill(u161, -1), u162.fill(-1));
      const u321 = new Uint32Array(5);
      const u322 = new Uint32Array(5);
      deepEquals(fill(u321, 2), u322.fill(2));
      deepEquals(fill(u321, 65537), u322.fill(65537));
      deepEquals(fill(u321, -1), u322.fill(-1));
      const i81 = new Int8Array(5);
      const i82 = new Int8Array(5);
      deepEquals(fill(i81, 2), i82.fill(2));
      deepEquals(fill(i81, -1), i82.fill(-1));
      const i161 = new Int16Array(5);
      const i162 = new Int16Array(5);
      deepEquals(fill(i161, 2), i162.fill(2));
      deepEquals(fill(i161, 65535), i162.fill(65535));
      deepEquals(fill(i161, -1), i162.fill(-1));
      const i321 = new Int32Array(5);
      const i322 = new Int32Array(5);
      deepEquals(fill(i321, 2), i322.fill(2));
      deepEquals(fill(i321, 65537), i322.fill(65537));
      deepEquals(fill(i321, -1), i322.fill(-1));
      const f321 = new Float32Array(5);
      const f322 = new Float32Array(5);
      deepEquals(fill(f321, 1.2345), f322.fill(1.2345));
      const f641 = new Float64Array(5);
      const f642 = new Float64Array(5);
      deepEquals(fill(f641, 1.2345), f642.fill(1.2345));
      const u8Clamped1 = new Uint8ClampedArray(5);
      const u8Clamped2 = new Uint8ClampedArray(5);
      deepEquals(fill(u8Clamped1, 2), u8Clamped2.fill(2));
      deepEquals(fill(u8Clamped1, 257), u8Clamped2.fill(257));
    });
    it('should work with all typed array types - explicit looping', function(): void {
      const u81 = new Uint8Array(5);
      const u82 = new Uint8Array(5);
      deepEquals(loopFill(u81, 2), u82.fill(2));
      deepEquals(loopFill(u81, -1), u82.fill(-1));
      const u161 = new Uint16Array(5);
      const u162 = new Uint16Array(5);
      deepEquals(loopFill(u161, 2), u162.fill(2));
      deepEquals(loopFill(u161, 65535), u162.fill(65535));
      deepEquals(loopFill(u161, -1), u162.fill(-1));
      const u321 = new Uint32Array(5);
      const u322 = new Uint32Array(5);
      deepEquals(loopFill(u321, 2), u322.fill(2));
      deepEquals(loopFill(u321, 65537), u322.fill(65537));
      deepEquals(loopFill(u321, -1), u322.fill(-1));
      const i81 = new Int8Array(5);
      const i82 = new Int8Array(5);
      deepEquals(loopFill(i81, 2), i82.fill(2));
      deepEquals(loopFill(i81, -1), i82.fill(-1));
      const i161 = new Int16Array(5);
      const i162 = new Int16Array(5);
      deepEquals(loopFill(i161, 2), i162.fill(2));
      deepEquals(loopFill(i161, 65535), i162.fill(65535));
      deepEquals(loopFill(i161, -1), i162.fill(-1));
      const i321 = new Int32Array(5);
      const i322 = new Int32Array(5);
      deepEquals(loopFill(i321, 2), i322.fill(2));
      deepEquals(loopFill(i321, 65537), i322.fill(65537));
      deepEquals(loopFill(i321, -1), i322.fill(-1));
      const f321 = new Float32Array(5);
      const f322 = new Float32Array(5);
      deepEquals(loopFill(f321, 1.2345), f322.fill(1.2345));
      const f641 = new Float64Array(5);
      const f642 = new Float64Array(5);
      deepEquals(loopFill(f641, 1.2345), f642.fill(1.2345));
      const u8Clamped1 = new Uint8ClampedArray(5);
      const u8Clamped2 = new Uint8ClampedArray(5);
      deepEquals(loopFill(u8Clamped1, 2), u8Clamped2.fill(2));
      deepEquals(loopFill(u8Clamped1, 257), u8Clamped2.fill(257));
    });
    it('start offset', function(): void {
      for (let i = -2; i < 10; ++i) {
        const u81 = new Uint8Array(5);
        const u82 = new Uint8Array(5);
        const u83 = new Uint8Array(5);
        deepEquals(fill(u81, 2, i), u83.fill(2, i));
        deepEquals(fill(u81, -1, i), u83.fill(-1, i));
        deepEquals(loopFill(u82, 2, i), u83.fill(2, i));
        deepEquals(loopFill(u82, -1, i), u83.fill(-1, i));
      }
    });
    it('end offset', function(): void {
      for (let i = -2; i < 10; ++i) {
        const u81 = new Uint8Array(5);
        const u82 = new Uint8Array(5);
        const u83 = new Uint8Array(5);
        deepEquals(fill(u81, 2, 0, i), u83.fill(2, 0, i));
        deepEquals(fill(u81, -1, 0, i), u83.fill(-1, 0, i));
        deepEquals(loopFill(u82, 2, 0, i), u83.fill(2, 0, i));
        deepEquals(loopFill(u82, -1, 0, i), u83.fill(-1, 0, i));
      }
    });
    it('start/end offset', function(): void {
      for (let i = -2; i < 10; ++i) {
        for (let j = -2; j < 10; ++j) {
          const u81 = new Uint8Array(5);
          const u82 = new Uint8Array(5);
          const u83 = new Uint8Array(5);
          deepEquals(fill(u81, 2, i, j), u83.fill(2, i, j));
          deepEquals(fill(u81, -1, i, j), u83.fill(-1, i, j));
          deepEquals(loopFill(u82, 2, i, j), u83.fill(2, i, j));
          deepEquals(loopFill(u82, -1, i, j), u83.fill(-1, i, j));
        }
      }
    });
  });
});
