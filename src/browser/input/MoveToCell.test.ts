/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { IBufferService } from 'common/services/Services';
import { MockBufferService } from 'common/TestUtils.test';
import { moveToCellSequence } from './MoveToCell';

describe('MoveToCell', () => {
  let bufferService: IBufferService;

  beforeEach(() => {
    bufferService = new MockBufferService(5, 5);
    bufferService.buffer.x = 3;
    bufferService.buffer.y = 3;
  });

  describe('normal buffer', () => {
    it('should use the right directional escape sequences', () => {
      assert.equal(moveToCellSequence(2, 3, bufferService, false), '\x1b[D');
      assert.equal(moveToCellSequence(4, 3, bufferService, false), '\x1b[C');
    });
    it('should ignore the Y value', () => {
      assert.equal(moveToCellSequence(1, 1, bufferService, false), '\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(1, 2, bufferService, false), '\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(1, 3, bufferService, false), '\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(1, 4, bufferService, false), '\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(1, 5, bufferService, false), '\x1b[D\x1b[D');
    });
    it('should use the correct character for application cursor', () => {
      assert.equal(moveToCellSequence(2, 1, bufferService, false), '\x1b[D');
      assert.equal(moveToCellSequence(2, 1, bufferService, true), '\x1bOD');
    });
  });

  describe('alt buffer', () => {
    beforeEach(() => {
      bufferService.buffers.activateAltBuffer();
      bufferService.buffer.x = 3;
      bufferService.buffer.y = 3;
    });

    it('should move the cursor across rows', () => {
      assert.equal(moveToCellSequence(4, 4, bufferService, false), '\x1b[B\x1b[C');
    });
  });
});
