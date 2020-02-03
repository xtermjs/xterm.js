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
      assert.equal(moveToCellSequence(1, 3, bufferService, false), '\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(2, 3, bufferService, false), '\x1b[D');
      assert.equal(moveToCellSequence(4, 3, bufferService, false), '\x1b[C');
      assert.equal(moveToCellSequence(5, 3, bufferService, false), '\x1b[C\x1b[C');
    });
    it('should wrap around entire row instead of doing up and down when the Y value differs', () => {
      assert.equal(moveToCellSequence(1, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(2, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(3, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(4, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(5, 1, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(1, 2, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(2, 2, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(3, 2, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(4, 2, bufferService, false), '\x1b[D\x1b[D\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(5, 2, bufferService, false), '\x1b[D\x1b[D\x1b[D');
      assert.equal(moveToCellSequence(1, 4, bufferService, false), '\x1b[C\x1b[C\x1b[C');
      assert.equal(moveToCellSequence(2, 4, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C');
      assert.equal(moveToCellSequence(3, 4, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C');
      assert.equal(moveToCellSequence(4, 4, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C');
      assert.equal(moveToCellSequence(5, 4, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C');
      assert.equal(moveToCellSequence(1, 5, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C');
      assert.equal(moveToCellSequence(2, 5, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C');
      assert.equal(moveToCellSequence(3, 5, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C');
      assert.equal(moveToCellSequence(4, 5, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C');
      assert.equal(moveToCellSequence(5, 5, bufferService, false), '\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C\x1b[C');
    });
    it('should use the correct character for application cursor', () => {
      assert.equal(moveToCellSequence(3, 1, bufferService, true), '\x1bOD\x1bOD\x1bOD\x1bOD\x1bOD\x1bOD\x1bOD\x1bOD\x1bOD\x1bOD');
      assert.equal(moveToCellSequence(3, 2, bufferService, true), '\x1bOD\x1bOD\x1bOD\x1bOD\x1bOD');
      assert.equal(moveToCellSequence(2, 3, bufferService, true), '\x1bOD');
      assert.equal(moveToCellSequence(4, 3, bufferService, true), '\x1bOC');
      assert.equal(moveToCellSequence(3, 4, bufferService, true), '\x1bOC\x1bOC\x1bOC\x1bOC\x1bOC');
      assert.equal(moveToCellSequence(3, 5, bufferService, true), '\x1bOC\x1bOC\x1bOC\x1bOC\x1bOC\x1bOC\x1bOC\x1bOC\x1bOC\x1bOC');
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
