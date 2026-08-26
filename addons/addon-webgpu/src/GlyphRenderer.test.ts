/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { PACKED_CELL_BYTES, PACKED_CELL_WORDS, packI16Pair, packU16Pair, unpackI16 } from './GlyphRenderer';

describe('GlyphRenderer packed cells', () => {
  it('uses a compact five-word cell record', () => {
    assert.equal(PACKED_CELL_WORDS, 5);
    assert.equal(PACKED_CELL_BYTES, 20);
  });

  it('round trips signed glyph offsets', () => {
    const packed = packI16Pair(-32768, 32767);
    assert.equal(unpackI16(packed), -32768);
    assert.equal(unpackI16(packed >>> 16), 32767);
  });

  it('clamps values to their packed ranges', () => {
    const signed = packI16Pair(-40000, 40000);
    assert.equal(unpackI16(signed), -32768);
    assert.equal(unpackI16(signed >>> 16), 32767);

    const unsigned = packU16Pair(-1, 70000);
    assert.equal(unsigned & 0xffff, 0);
    assert.equal(unsigned >>> 16, 0xffff);
  });
});
