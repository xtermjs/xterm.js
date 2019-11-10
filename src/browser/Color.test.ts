/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { blend, fromCss, toPaddedHex, toCss } from 'browser/Color';

describe('Color', () => {
  describe('blend', () => {
    it('should blend colors based on the alpha channel', () => {
      assert.deepEqual(blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFF00', rgba: 0xFFFFFF00 }), { css: '#000000', rgba: 0x000000FF });
      assert.deepEqual(blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFF10', rgba: 0xFFFFFF10 }), { css: '#101010', rgba: 0x101010FF });
      assert.deepEqual(blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFF20', rgba: 0xFFFFFF20 }), { css: '#202020', rgba: 0x202020FF });
      assert.deepEqual(blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFF30', rgba: 0xFFFFFF30 }), { css: '#303030', rgba: 0x303030FF });
      assert.deepEqual(blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFF40', rgba: 0xFFFFFF40 }), { css: '#404040', rgba: 0x404040FF });
      assert.deepEqual(blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFF50', rgba: 0xFFFFFF50 }), { css: '#505050', rgba: 0x505050FF });
      assert.deepEqual(blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFF60', rgba: 0xFFFFFF60 }), { css: '#606060', rgba: 0x606060FF });
      assert.deepEqual(blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFF70', rgba: 0xFFFFFF70 }), { css: '#707070', rgba: 0x707070FF });
      assert.deepEqual(blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFF80', rgba: 0xFFFFFF80 }), { css: '#808080', rgba: 0x808080FF });
      assert.deepEqual(blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFF90', rgba: 0xFFFFFF90 }), { css: '#909090', rgba: 0x909090FF });
      assert.deepEqual(blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFFA0', rgba: 0xFFFFFFA0 }), { css: '#a0a0a0', rgba: 0xA0A0A0FF });
      assert.deepEqual(blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFFB0', rgba: 0xFFFFFFB0 }), { css: '#b0b0b0', rgba: 0xB0B0B0FF });
      assert.deepEqual(blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFFC0', rgba: 0xFFFFFFC0 }), { css: '#c0c0c0', rgba: 0xC0C0C0FF });
      assert.deepEqual(blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFFD0', rgba: 0xFFFFFFD0 }), { css: '#d0d0d0', rgba: 0xD0D0D0FF });
      assert.deepEqual(blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFFE0', rgba: 0xFFFFFFE0 }), { css: '#e0e0e0', rgba: 0xE0E0E0FF });
      assert.deepEqual(blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFFF0', rgba: 0xFFFFFFF0 }), { css: '#f0f0f0', rgba: 0xF0F0F0FF });
      assert.deepEqual(blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFFFF', rgba: 0xFFFFFFFF }), { css: '#FFFFFFFF', rgba: 0xFFFFFFFF });
    });
  });

  describe('fromCss', () => {
    it('should covert a CSS string to an IColor', () => {
      assert.deepEqual(fromCss('#000000'), { css: '#000000', rgba: 0x000000FF });
      assert.deepEqual(fromCss('#101010'), { css: '#101010', rgba: 0x101010FF });
      assert.deepEqual(fromCss('#202020'), { css: '#202020', rgba: 0x202020FF });
      assert.deepEqual(fromCss('#303030'), { css: '#303030', rgba: 0x303030FF });
      assert.deepEqual(fromCss('#404040'), { css: '#404040', rgba: 0x404040FF });
      assert.deepEqual(fromCss('#505050'), { css: '#505050', rgba: 0x505050FF });
      assert.deepEqual(fromCss('#606060'), { css: '#606060', rgba: 0x606060FF });
      assert.deepEqual(fromCss('#707070'), { css: '#707070', rgba: 0x707070FF });
      assert.deepEqual(fromCss('#808080'), { css: '#808080', rgba: 0x808080FF });
      assert.deepEqual(fromCss('#909090'), { css: '#909090', rgba: 0x909090FF });
      assert.deepEqual(fromCss('#a0a0a0'), { css: '#a0a0a0', rgba: 0xa0a0a0FF });
      assert.deepEqual(fromCss('#b0b0b0'), { css: '#b0b0b0', rgba: 0xb0b0b0FF });
      assert.deepEqual(fromCss('#c0c0c0'), { css: '#c0c0c0', rgba: 0xc0c0c0FF });
      assert.deepEqual(fromCss('#d0d0d0'), { css: '#d0d0d0', rgba: 0xd0d0d0FF });
      assert.deepEqual(fromCss('#e0e0e0'), { css: '#e0e0e0', rgba: 0xe0e0e0FF });
      assert.deepEqual(fromCss('#f0f0f0'), { css: '#f0f0f0', rgba: 0xf0f0f0FF });
      assert.deepEqual(fromCss('#ffffff'), { css: '#ffffff', rgba: 0xffffffFF });
    });
  });

  describe('toPaddedHex', () => {
    it('should convert numbers to 2-digit hex values', () => {
      assert.equal(toPaddedHex(0x00), '00');
      assert.equal(toPaddedHex(0x10), '10');
      assert.equal(toPaddedHex(0x20), '20');
      assert.equal(toPaddedHex(0x30), '30');
      assert.equal(toPaddedHex(0x40), '40');
      assert.equal(toPaddedHex(0x50), '50');
      assert.equal(toPaddedHex(0x60), '60');
      assert.equal(toPaddedHex(0x70), '70');
      assert.equal(toPaddedHex(0x80), '80');
      assert.equal(toPaddedHex(0x90), '90');
      assert.equal(toPaddedHex(0xa0), 'a0');
      assert.equal(toPaddedHex(0xb0), 'b0');
      assert.equal(toPaddedHex(0xc0), 'c0');
      assert.equal(toPaddedHex(0xd0), 'd0');
      assert.equal(toPaddedHex(0xe0), 'e0');
      assert.equal(toPaddedHex(0xf0), 'f0');
      assert.equal(toPaddedHex(0xff), 'ff');
    });
  });

  describe('toCss', () => {
    it('should convert an rgb array to css hex string', () => {
      assert.equal(toCss(0x00, 0x00, 0x00), '#000000');
      assert.equal(toCss(0x10, 0x10, 0x10), '#101010');
      assert.equal(toCss(0x20, 0x20, 0x20), '#202020');
      assert.equal(toCss(0x30, 0x30, 0x30), '#303030');
      assert.equal(toCss(0x40, 0x40, 0x40), '#404040');
      assert.equal(toCss(0x50, 0x50, 0x50), '#505050');
      assert.equal(toCss(0x60, 0x60, 0x60), '#606060');
      assert.equal(toCss(0x70, 0x70, 0x70), '#707070');
      assert.equal(toCss(0x80, 0x80, 0x80), '#808080');
      assert.equal(toCss(0x90, 0x90, 0x90), '#909090');
      assert.equal(toCss(0xa0, 0xa0, 0xa0), '#a0a0a0');
      assert.equal(toCss(0xb0, 0xb0, 0xb0), '#b0b0b0');
      assert.equal(toCss(0xc0, 0xc0, 0xc0), '#c0c0c0');
      assert.equal(toCss(0xd0, 0xd0, 0xd0), '#d0d0d0');
      assert.equal(toCss(0xe0, 0xe0, 0xe0), '#e0e0e0');
      assert.equal(toCss(0xf0, 0xf0, 0xf0), '#f0f0f0');
      assert.equal(toCss(0xff, 0xff, 0xff), '#ffffff');
    });
  });
});
