/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import UnicodeTrie from './unicode-trie';

const HEADER_LENGTH = 12;

/**
 * Wraps `data` in a single final DEFLATE "stored" block (BFINAL=1, BTYPE=00).
 * tiny-inflate accepts these, which lets this test build a valid trie image
 * without pulling in a compressor.
 */
function storedDeflate(data: Uint8Array): Uint8Array {
  const result = new Uint8Array(5 + data.length);
  result[0] = 0x01;                            // BFINAL=1, BTYPE=00 (stored)
  result[1] = data.length & 0xff;              // LEN, little endian
  result[2] = (data.length >> 8) & 0xff;
  result[3] = ~data.length & 0xff;             // NLEN, one's complement of LEN
  result[4] = (~data.length >> 8) & 0xff;
  result.set(data, 5);
  return result;
}

/**
 * Builds a trie image in the serialized format the constructor expects: a 12
 * byte little endian header (highStart, errorValue, uncompressedLength)
 * followed by the doubly deflated trie body.
 *
 * `uncompressedLength` sizes the scratch buffer used for *both* inflate
 * passes, so it must also fit the intermediate result. Stored blocks add 5
 * bytes per pass rather than shrinking, hence the padding.
 */
function buildTrieImage(highStart: number, errorValue: number, body: Uint32Array): Uint8Array {
  const bodyBytes = new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  const payload = storedDeflate(storedDeflate(bodyBytes));
  const image = new Uint8Array(HEADER_LENGTH + payload.length);
  const header = new DataView(image.buffer, 0, HEADER_LENGTH);
  header.setUint32(0, highStart, true);
  header.setUint32(4, errorValue, true);
  header.setUint32(8, bodyBytes.length + 8, true);
  image.set(payload, HEADER_LENGTH);
  return image;
}

/** Places `image` at `byteOffset` within a larger buffer and returns a view of it. */
function viewAtOffset(image: Uint8Array, byteOffset: number): Uint8Array {
  const backing = new Uint8Array(image.length + byteOffset);
  backing.set(image, byteOffset);
  return backing.subarray(byteOffset);
}

describe('UnicodeTrie', () => {
  const HIGH_START = 0x110000;
  const ERROR_VALUE = 0xdeadbeef;

  // Deterministic body, kept small valued so every computed index stays in range.
  const body = new Uint32Array(0x1000);
  for (let i = 0; i < body.length; i++) {
    body[i] = i & 0xff;
  }
  const image = buildTrieImage(HIGH_START, ERROR_VALUE, body);

  it('reads a trie whose data starts at byte 0 of its buffer', () => {
    const trie = new UnicodeTrie(image);
    assert.strictEqual(trie.get(-1) >>> 0, ERROR_VALUE);
    assert.strictEqual(trie.get(0x110000) >>> 0, ERROR_VALUE);
  });

  // A Uint8Array need not start at byte 0 of its ArrayBuffer. In node,
  // `Buffer.from(str, 'base64')` returns a view into a shared 8 KiB pool
  // whenever the result is smaller than half of `Buffer.poolSize`, so any
  // earlier small allocation pushes the trie to a non-zero byteOffset. The
  // header must be read relative to that offset.
  describe('reading a trie whose data does not start at byte 0 of its buffer', () => {
    for (const byteOffset of [1, 2, 3, 4, 8, 16, 33, 64]) {
      it(`honours byteOffset ${byteOffset}`, () => {
        const trie = new UnicodeTrie(viewAtOffset(image, byteOffset));
        assert.strictEqual(trie.get(-1) >>> 0, ERROR_VALUE);
        assert.strictEqual(trie.get(0x110000) >>> 0, ERROR_VALUE);
      });
    }

    it('resolves code points identically regardless of byteOffset', () => {
      const expected = new UnicodeTrie(image);
      const shifted = new UnicodeTrie(viewAtOffset(image, 3));
      for (const codePoint of [0x0, 0x41, 0x7f, 0x300, 0xd7ff, 0xd800, 0xdbff, 0xdc00, 0xffff, 0x10000, 0x1f469, 0x10ffff]) {
        assert.strictEqual(shifted.get(codePoint), expected.get(codePoint), `code point 0x${codePoint.toString(16)}`);
      }
    });
  });
});
