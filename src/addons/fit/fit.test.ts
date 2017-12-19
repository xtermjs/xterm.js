/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert, expect } from 'chai';

import * as fit from './fit'

class MockTerminal {}

describe('fit addon', () => {
  describe('apply', () => {
    it('should do register the `proposeGeometry` and `fit` methods', () => {
      fit.apply(MockTerminal);
      assert.equal(typeof (<any>MockTerminal).prototype.proposeGeometry, 'function');
      assert.equal(typeof (<any>MockTerminal).prototype.fit, 'function');
    });
  });
});
