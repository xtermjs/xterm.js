/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { ITerminal } from './Interfaces';
import { BufferSet } from './BufferSet';
import { Buffer } from './Buffer';
import { MockTerminal } from './utils/TestUtils.test';

describe('BufferSet', () => {
  let terminal: ITerminal;
  let bufferSet: BufferSet;

  beforeEach(() => {
    terminal = new MockTerminal();
    terminal.cols = 80;
    terminal.rows = 24;
    terminal.options.scrollback = 1000;
    bufferSet = new BufferSet(terminal);
  });

  describe('constructor', () => {
    it('should create two different buffers: alt and normal', () => {
      assert.instanceOf(bufferSet.normal, Buffer);
      assert.instanceOf(bufferSet.alt, Buffer);
      assert.notEqual(bufferSet.normal, bufferSet.alt);
    });
  });

  describe('activateNormalBuffer', () => {
    beforeEach(() => {
      bufferSet.activateNormalBuffer();
    });

    it('should set the normal buffer as the currently active buffer', () => {
      assert.equal(bufferSet.active, bufferSet.normal);
    });
  });

  describe('activateAltBuffer', () => {
    beforeEach(() => {
      bufferSet.activateAltBuffer();
    });

    it('should set the alt buffer as the currently active buffer', () => {
      assert.equal(bufferSet.active, bufferSet.alt);
    });
  });
});
