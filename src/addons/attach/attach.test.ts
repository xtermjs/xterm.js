/**
 * Copyright (c) 2014 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert, expect } from 'chai';

import * as attach from './attach'

class MockTerminal {}

describe('attach addon', () => {
  describe('apply', () => {
    it('should do register the `attach` and `detach` methods', () => {
      attach.apply(MockTerminal);
      assert.equal(typeof (<any>MockTerminal).prototype.attach, 'function');
      assert.equal(typeof (<any>MockTerminal).prototype.detach, 'function');
    });
  });
});
