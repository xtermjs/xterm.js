/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { Terminal } from './Terminal';
import * as attach from '../addons/attach/attach';

describe('Terminal', () => {
  it('should apply addons with Terminal.applyAddon', () => {
    Terminal.applyAddon(attach);
    // Test that addon was applied successfully, adding attach to Terminal's
    // prototype.
    assert.equal(typeof (<any>Terminal).prototype.attach, 'function');
  });
});
