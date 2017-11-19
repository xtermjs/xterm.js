/**
 * Copyright (c) 2014 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert, expect } from 'chai';

import * as fullscreen from './fullscreen'

class MockTerminal {}

describe('fullscreen addon', () => {
  describe('apply', () => {
    it('should do register the `toggleFullscreen` method', () => {
      fullscreen.apply(MockTerminal);
      assert.equal(typeof (<any>MockTerminal).prototype.toggleFullScreen, 'function');
    });
  });
});
