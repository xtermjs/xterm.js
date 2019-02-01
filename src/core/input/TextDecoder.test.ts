/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { StringToUtf32, stringFromCodePoint, utf32ToString } from './TextDecoder';

describe('text encodings', () => {
  it('stringFromCodePoint/utf32ToString', () => {
    const s = 'abcdefg';
    const data = new Uint32Array(s.length);
    for (let i = 0; i < s.length; ++i) {
      data[i] = s.charCodeAt(i);
      assert.equal(stringFromCodePoint(data[i]), s[i]);
    }
    assert.equal(utf32ToString(data), s);
  });

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
          assert.equal(utf32ToString(target, 0, length), String.fromCharCode(i));
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
          assert.equal(utf32ToString(target, 0, length), s);
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
          decoded += utf32ToString(target, written);
        }
        assert(decoded, 'Ä€𝄞Ö𝄞€Ü𝄞€');
      });
    });
  });
});
