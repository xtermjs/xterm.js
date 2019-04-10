/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import * as attach from 'src/addons/attach/attach';
import { Terminal } from 'src/public/Terminal';

describe('Terminal', () => {
  it('should apply addons with Terminal.applyAddon', () => {
    Terminal.applyAddon(attach);
    // Test that addon was applied successfully, adding attach to Terminal's
    // prototype.
    assert.equal(typeof (<any>Terminal).prototype.attach, 'function');
  });
});
