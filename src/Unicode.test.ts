/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { createUnicodeRangeJoiner } from './Unicode';

describe('createUnicodeRangeJoiner', () => {
  it('should join charcaters within the range', () => {
    // Join a-z
    const joiner = createUnicodeRangeJoiner(97, 122);
    assert.deepEqual(joiner('ABCabc aBc abC Abc'), [
      [3, 6],   // abc
      [11, 13], // ab
      [16, 18]  // bc
    ]);
  });
});
