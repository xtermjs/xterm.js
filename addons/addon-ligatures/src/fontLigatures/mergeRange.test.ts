/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import mergeRange from './mergeRange';

describe('addon-ligatures - mergeRange', () => {
  it('inserts a new range before the existing ones', () => {
    const result = mergeRange([[1, 2], [2, 3]], 0, 1);
    assert.deepEqual(result, [[0, 1], [1, 2], [2, 3]]);
  });

  it('inserts in between two ranges', () => {
    const result = mergeRange([[0, 2], [4, 6]], 2, 4);
    assert.deepEqual(result, [[0, 2], [2, 4], [4, 6]]);
  });

  it('inserts after the last range', () => {
    const result = mergeRange([[0, 2], [4, 6]], 6, 8);
    assert.deepEqual(result, [[0, 2], [4, 6], [6, 8]]);
  });

  it('extends the beginning of a range', () => {
    const result = mergeRange([[0, 2], [4, 6]], 3, 5);
    assert.deepEqual(result, [[0, 2], [3, 6]]);
  });

  it('extends the end of a range', () => {
    const result = mergeRange([[0, 2], [4, 6]], 1, 4);
    assert.deepEqual(result, [[0, 4], [4, 6]]);
  });

  it('extends the last range', () => {
    const result = mergeRange([[0, 2], [4, 6]], 5, 7);
    assert.deepEqual(result, [[0, 2], [4, 7]]);
  });

  it('connects two ranges', () => {
    const result = mergeRange([[0, 2], [4, 6]], 1, 5);
    assert.deepEqual(result, [[0, 6]]);
  });

  it('connects more than two ranges', () => {
    const result = mergeRange([[0, 2], [4, 6], [8, 10], [12, 14]], 1, 10);
    assert.deepEqual(result, [[0, 10], [12, 14]]);
  });
});
