/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { DEFAULT_ATTR_DATA } from './primitives/buffer/BufferLine';
import { updateWindowsModeWrappedState } from './WindowsMode';
import { BufferService } from './services/BufferService';
import { OptionsService } from './services/OptionsService';
import { MockLogService } from './TestUtils.test';

describe('WindowsMode', () => {
  describe('updateWindowsModeWrappedState', () => {
    it('should mark the next line wrapped when the previous line ends in a non-whitespace character', () => {
      const bufferService = new BufferService(new OptionsService({ rows: 5, cols: 10 }), new MockLogService());
      const buffer = bufferService.buffer;
      const previousLine = buffer.lines.get(buffer.ybase)!;
      for (let i = 0; i < bufferService.cols; i++) {
        previousLine!.setCellFromCodepoint(i, 'a'.charCodeAt(0), 1, DEFAULT_ATTR_DATA);
      }
      buffer.y = 1;

      updateWindowsModeWrappedState(bufferService);

      assert.strictEqual(buffer.lines.get(buffer.ybase + 1)!.isWrapped, true);
    });

    it('should not mark the next line wrapped when the previous line ends in whitespace', () => {
      const bufferService = new BufferService(new OptionsService({ rows: 5, cols: 10 }), new MockLogService());
      const buffer = bufferService.buffer;
      const previousLine = buffer.lines.get(buffer.ybase)!;
      for (let i = 0; i < bufferService.cols - 1; i++) {
        previousLine!.setCellFromCodepoint(i, 'a'.charCodeAt(0), 1, DEFAULT_ATTR_DATA);
      }
      previousLine!.setCellFromCodepoint(bufferService.cols - 1, ' '.charCodeAt(0), 1, DEFAULT_ATTR_DATA);
      buffer.y = 1;

      updateWindowsModeWrappedState(bufferService);

      assert.strictEqual(buffer.lines.get(buffer.ybase + 1)!.isWrapped, false);
    });

    it('should not mark the next line wrapped when the previous line ends in a null cell', () => {
      const bufferService = new BufferService(new OptionsService({ rows: 5, cols: 10 }), new MockLogService());
      const buffer = bufferService.buffer;
      buffer.y = 1;

      updateWindowsModeWrappedState(bufferService);

      assert.strictEqual(buffer.lines.get(buffer.ybase + 1)!.isWrapped, false);
    });
  });
});
