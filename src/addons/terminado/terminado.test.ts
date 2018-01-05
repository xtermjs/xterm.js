/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert, expect } from 'chai';

import * as terminado from './terminado'

class MockTerminal {}

describe('terminado addon', () => {
  describe('apply', () => {
    it('should do register the `terminadoAttach` and `terminadoDetach` methods', () => {
      terminado.apply(MockTerminal);
      assert.equal(typeof (<any>MockTerminal).prototype.terminadoAttach, 'function');
      assert.equal(typeof (<any>MockTerminal).prototype.terminadoDetach, 'function');
    });
  });
});
