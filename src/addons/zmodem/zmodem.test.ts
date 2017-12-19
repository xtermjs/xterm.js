/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert, expect } from 'chai';

import * as zmodem from './zmodem'

class MockTerminal {}

describe('zmodem addon', () => {
  describe('apply', () => {
    it('should do register the `zmodemAttach` method and `zmodemBrowser` attribute', () => {
      zmodem.apply(MockTerminal);
      assert.equal(typeof (<any>MockTerminal).prototype.zmodemAttach, 'function');
      assert.equal(typeof (<any>MockTerminal).prototype.zmodemBrowser, 'object');
    });
  });
});
