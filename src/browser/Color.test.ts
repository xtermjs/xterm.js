/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { blend } from 'browser/Color';

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
});
