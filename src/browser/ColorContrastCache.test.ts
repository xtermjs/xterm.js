/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { ColorContrastCache } from 'browser/ColorContrastCache';

describe('ColorContrastCache', () => {
  let cache: ColorContrastCache;

  beforeEach(() => {
    cache = new ColorContrastCache();
  });

  it('should save and get color values', () => {
    assert.strictEqual(cache.getColor(0x01, 0x00), undefined);
    cache.setColor(0x01, 0x01, null);
    assert.strictEqual(cache.getColor(0x01, 0x01), null);
    cache.setColor(0x01, 0x02, { css: '#030303', rgba: 0x030303ff});
    assert.deepEqual(cache.getColor(0x01, 0x02), { css: '#030303', rgba: 0x030303ff});
  });

  it('should save and get css values', () => {
    assert.strictEqual(cache.getCss(0x01, 0x00), undefined);
    cache.setCss(0x01, 0x01, null);
    assert.strictEqual(cache.getCss(0x01, 0x01), null);
    cache.setCss(0x01, 0x02, '#030303');
    assert.deepEqual(cache.getCss(0x01, 0x02), '#030303');
  });

  it('should clear all values on clear', () => {
    cache.setColor(0x01, 0x01, null);
    cache.setColor(0x01, 0x02, { css: '#030303', rgba: 0x030303ff});
    cache.setCss(0x01, 0x01, null);
    cache.setCss(0x01, 0x02, '#030303');
    cache.clear();
    assert.strictEqual(cache.getColor(0x01, 0x01), undefined);
    assert.strictEqual(cache.getColor(0x01, 0x02), undefined);
    assert.strictEqual(cache.getCss(0x01, 0x01), undefined);
    assert.strictEqual(cache.getCss(0x01, 0x02), undefined);
  });
});
