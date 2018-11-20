/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { fill } from './TypedArrayUtils';

type TypedArray = Uint8Array | Uint16Array | Uint32Array | Uint8ClampedArray
  | Int8Array | Int16Array | Int32Array
  | Float32Array | Float64Array;

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

function deepEquals(a: TypedArray, b: TypedArray) {
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; ++i) {
    assert.equal(a[i], b[i]);
  }
}


describe('polyfill conformance tests', function(): void {
  describe('TypedArray.fill', function(): void {
    it('should work with all typed array types', function(): void {
      const u8_1 = new Uint8Array(5);
      const u8_2 = new Uint8Array(5);
      deepEquals(fill(u8_1, 2), u8_2.fill(2));
      deepEquals(fill(u8_1, -1), u8_2.fill(-1));
      const u16_1 = new Uint16Array(5);
      const u16_2 = new Uint16Array(5);
      deepEquals(fill(u16_1, 2), u16_2.fill(2));
      deepEquals(fill(u16_1, 65535), u16_2.fill(65535));
      deepEquals(fill(u16_1, -1), u16_2.fill(-1));
      const u32_1 = new Uint32Array(5);
      const u32_2 = new Uint32Array(5);
      deepEquals(fill(u32_1, 2), u32_2.fill(2));
      deepEquals(fill(u32_1, 65537), u32_2.fill(65537));
      deepEquals(fill(u32_1, -1), u32_2.fill(-1));
      const i8_1 = new Int8Array(5);
      const i8_2 = new Int8Array(5);
      deepEquals(fill(i8_1, 2), i8_2.fill(2));
      deepEquals(fill(i8_1, -1), i8_2.fill(-1));
      const i16_1 = new Int16Array(5);
      const i16_2 = new Int16Array(5);
      deepEquals(fill(i16_1, 2), i16_2.fill(2));
      deepEquals(fill(i16_1, 65535), i16_2.fill(65535));
      deepEquals(fill(i16_1, -1), i16_2.fill(-1));
      const i32_1 = new Int32Array(5);
      const i32_2 = new Int32Array(5);
      deepEquals(fill(i32_1, 2), i32_2.fill(2));
      deepEquals(fill(i32_1, 65537), i32_2.fill(65537));
      deepEquals(fill(i32_1, -1), i32_2.fill(-1));
      const f32_1 = new Float32Array(5);
      const f32_2 = new Float32Array(5);
      deepEquals(fill(f32_1, 1.2345), f32_2.fill(1.2345));
      const f64_1 = new Float64Array(5);
      const f64_2 = new Float64Array(5);
      deepEquals(fill(f64_1, 1.2345), f64_2.fill(1.2345));
      const u8Clamped_1 = new Uint8ClampedArray(5);
      const u8Clamped_2 = new Uint8ClampedArray(5);
      deepEquals(fill(u8Clamped_1, 2), u8Clamped_2.fill(2));
      deepEquals(fill(u8Clamped_1, 257), u8Clamped_2.fill(257));
    });
    it('should work with all typed array types - explicit looping', function(): void {
      const u8_1 = new Uint8Array(5);
      const u8_2 = new Uint8Array(5);
      deepEquals(loopFill(u8_1, 2), u8_2.fill(2));
      deepEquals(loopFill(u8_1, -1), u8_2.fill(-1));
      const u16_1 = new Uint16Array(5);
      const u16_2 = new Uint16Array(5);
      deepEquals(loopFill(u16_1, 2), u16_2.fill(2));
      deepEquals(loopFill(u16_1, 65535), u16_2.fill(65535));
      deepEquals(loopFill(u16_1, -1), u16_2.fill(-1));
      const u32_1 = new Uint32Array(5);
      const u32_2 = new Uint32Array(5);
      deepEquals(loopFill(u32_1, 2), u32_2.fill(2));
      deepEquals(loopFill(u32_1, 65537), u32_2.fill(65537));
      deepEquals(loopFill(u32_1, -1), u32_2.fill(-1));
      const i8_1 = new Int8Array(5);
      const i8_2 = new Int8Array(5);
      deepEquals(loopFill(i8_1, 2), i8_2.fill(2));
      deepEquals(loopFill(i8_1, -1), i8_2.fill(-1));
      const i16_1 = new Int16Array(5);
      const i16_2 = new Int16Array(5);
      deepEquals(loopFill(i16_1, 2), i16_2.fill(2));
      deepEquals(loopFill(i16_1, 65535), i16_2.fill(65535));
      deepEquals(loopFill(i16_1, -1), i16_2.fill(-1));
      const i32_1 = new Int32Array(5);
      const i32_2 = new Int32Array(5);
      deepEquals(loopFill(i32_1, 2), i32_2.fill(2));
      deepEquals(loopFill(i32_1, 65537), i32_2.fill(65537));
      deepEquals(loopFill(i32_1, -1), i32_2.fill(-1));
      const f32_1 = new Float32Array(5);
      const f32_2 = new Float32Array(5);
      deepEquals(loopFill(f32_1, 1.2345), f32_2.fill(1.2345));
      const f64_1 = new Float64Array(5);
      const f64_2 = new Float64Array(5);
      deepEquals(loopFill(f64_1, 1.2345), f64_2.fill(1.2345));
      const u8Clamped_1 = new Uint8ClampedArray(5);
      const u8Clamped_2 = new Uint8ClampedArray(5);
      deepEquals(loopFill(u8Clamped_1, 2), u8Clamped_2.fill(2));
      deepEquals(loopFill(u8Clamped_1, 257), u8Clamped_2.fill(257));
    });
    it('start offset', function(): void {
      for (let i = -2; i < 10; ++i) {
        const u8_1 = new Uint8Array(5);
        const u8_2 = new Uint8Array(5);
        const u8_3 = new Uint8Array(5);
        deepEquals(fill(u8_1, 2, i), u8_3.fill(2, i));
        deepEquals(fill(u8_1, -1, i), u8_3.fill(-1, i));
        deepEquals(loopFill(u8_2, 2, i), u8_3.fill(2, i));
        deepEquals(loopFill(u8_2, -1, i), u8_3.fill(-1, i));
      }
    });
    it('end offset', function(): void {
      for (let i = -2; i < 10; ++i) {
        const u8_1 = new Uint8Array(5);
        const u8_2 = new Uint8Array(5);
        const u8_3 = new Uint8Array(5);
        deepEquals(fill(u8_1, 2, 0, i), u8_3.fill(2, 0, i));
        deepEquals(fill(u8_1, -1, 0, i), u8_3.fill(-1, 0, i));
        deepEquals(loopFill(u8_2, 2, 0, i), u8_3.fill(2, 0, i));
        deepEquals(loopFill(u8_2, -1, 0, i), u8_3.fill(-1, 0, i));
      }
    });
    it('start/end offset', function(): void {
      for (let i = -2; i < 10; ++i) {
        for (let j = -2; j < 10; ++j) {
          const u8_1 = new Uint8Array(5);
          const u8_2 = new Uint8Array(5);
          const u8_3 = new Uint8Array(5);
          deepEquals(fill(u8_1, 2, i, j), u8_3.fill(2, i, j));
          deepEquals(fill(u8_1, -1, i, j), u8_3.fill(-1, i, j));
          deepEquals(loopFill(u8_2, 2, i, j), u8_3.fill(2, i, j));
          deepEquals(loopFill(u8_2, -1, i, j), u8_3.fill(-1, i, j));
        }
      }
    });
  });
});
