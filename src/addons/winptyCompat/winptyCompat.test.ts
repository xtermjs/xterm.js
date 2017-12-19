/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert, expect } from 'chai';

import * as winptyCompat from './winptyCompat'

class MockTerminal {}

describe('winptyCompat addon', () => {
  describe('apply', () => {
    it('should do register the `winptyCompatInit` method', () => {
      winptyCompat.apply(MockTerminal);
      assert.equal(typeof (<any>MockTerminal).prototype.winptyCompatInit, 'function');
    });
  });
});
