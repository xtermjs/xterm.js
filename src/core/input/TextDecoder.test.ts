/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { StringToUtf32, stringFromCodePoint } from './TextDecoder';


// convert UTF32 codepoints to string
function toString(data: Uint32Array, length: number): string {
  if ((String as any).fromCodePoint) {
    return (String as any).fromCodePoint.apply(null, data.subarray(0, length));
  }
  let result = '';
  for (let i = 0; i < length; ++i) {
    result += stringFromCodePoint(data[i]);
  }
  return result;
}

describe('StringToUtf32 Decoder', () => {
  describe('full codepoint test', () => {
    it('0..65535', () => {
      const decoder = new StringToUtf32();
      const target = new Uint32Array(5);
      for (let i = 0; i < 65536; ++i) {
        // skip surrogate pairs
        if (i >= 0xD800 && i <= 0xDFFF) {
          continue;
        }
        const length = decoder.decode(String.fromCharCode(i), target);
        assert.equal(length, 1);
        assert.equal(target[0], i);
        assert.equal(toString(target, length), String.fromCharCode(i));
        decoder.clear();
      }
    });
    it('65536..0x10FFFF (surrogates)', function(): void {
      this.timeout(20000);
      const decoder = new StringToUtf32();
      const target = new Uint32Array(5);
      for (let i = 65536; i < 0x10FFFF; ++i) {
        const codePoint = i - 0x10000;
        const s = String.fromCharCode((codePoint >> 10) + 0xD800) + String.fromCharCode((codePoint % 0x400) + 0xDC00);
        const length = decoder.decode(s, target);
        assert.equal(length, 1);
        assert.equal(target[0], i);
        assert.equal(toString(target, length), s);
        decoder.clear();
      }
    });
  });
  describe('stream handling', () => {
    it('surrogates mixed advance by 1', () => {
      const decoder = new StringToUtf32();
      const target = new Uint32Array(5);
      const input = 'Ä€𝄞Ö𝄞€Ü𝄞€';
      let decoded = '';
      for (let i = 0; i < input.length; ++i) {
        const written = decoder.decode(input[i], target);
        decoded += toString(target, written);
      }
      assert(decoded, 'Ä€𝄞Ö𝄞€Ü𝄞€');
    });
  });
});
