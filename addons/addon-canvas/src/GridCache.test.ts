/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { GridCache } from './GridCache';

describe('GridCache', () => {
  let grid: GridCache<number>;

  beforeEach(() => {
    grid = new GridCache<number>();
  });

  describe('constructor', () => {
    it('should create an empty cache', () => {
      assert.equal(grid.cache.length, 0);
    });
  });

  describe('resize', () => {
    it('should fill all new elements with null', () => {
      grid.resize(2, 2);
      assert.equal(grid.cache.length, 2);
      assert.equal(grid.cache[0].length, 2);
      assert.equal(grid.cache[0][0], null);
      assert.equal(grid.cache[0][1], null);
      assert.equal(grid.cache[1].length, 2);
      assert.equal(grid.cache[1][0], null);
      assert.equal(grid.cache[1][1], null);
      grid.resize(3, 2);
      assert.equal(grid.cache.length, 3);
      assert.equal(grid.cache[2][0], null);
      assert.equal(grid.cache[2][1], null);
    });

    it('should remove rows/cols from the cache when reduced', () => {
      grid.resize(2, 2);
      grid.resize(1, 1);
      assert.equal(grid.cache.length, 1);
      assert.equal(grid.cache[0].length, 1);
    });

    it('should not touch existing cache entries if they fit in the new cache', () => {
      grid.resize(1, 1);
      assert.equal(grid.cache[0][0], null);
      grid.cache[0][0] = 1;
      grid.resize(2, 1);
      assert.equal(grid.cache[0][0], 1);
    });
  });

  describe('clear', () => {
    it('should make all entries null', () => {
      grid.resize(1, 1);
      grid.cache[0][0] = 1;
      grid.clear();
      assert.equal(grid.cache[0][0], null);
    });
  });
});
