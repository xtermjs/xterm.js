/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { AttributeData } from '../buffer/AttributeData';
import { BufferService } from './BufferService';
import { OptionsService } from './OptionsService';
import { MockLogService } from '../TestUtils.test';

describe('BufferService', () => {
  describe('scroll', () => {
    const eraseAttr = new AttributeData();

    it('should decrement ydisp when the buffer is full and the user has scrolled up', () => {
      const optionsService = new OptionsService({ rows: 3, cols: 10, scrollback: 2 });
      const bufferService = new BufferService(optionsService, new MockLogService());
      const buffer = bufferService.buffer;

      while (!buffer.lines.isFull) {
        bufferService.scroll(eraseAttr);
      }
      assert.strictEqual(buffer.lines.length, 5);

      bufferService.isUserScrolling = true;
      buffer.ydisp = 2;
      const ybaseBefore = buffer.ybase;

      bufferService.scroll(eraseAttr);

      assert.strictEqual(buffer.ybase, ybaseBefore);
      assert.strictEqual(buffer.ydisp, 1);
    });

    it('should not advance ydisp with ybase while the user has scrolled up and the buffer is not full', () => {
      const optionsService = new OptionsService({ rows: 3, cols: 10, scrollback: 2 });
      const bufferService = new BufferService(optionsService, new MockLogService());
      const buffer = bufferService.buffer;

      bufferService.isUserScrolling = true;
      buffer.ydisp = 0;
      const ybaseBefore = buffer.ybase;

      bufferService.scroll(eraseAttr);

      assert.strictEqual(buffer.ybase, ybaseBefore + 1);
      assert.strictEqual(buffer.ydisp, 0);
    });

    it('should follow ybase with ydisp when the user is not scrolling', () => {
      const optionsService = new OptionsService({ rows: 3, cols: 10, scrollback: 2 });
      const bufferService = new BufferService(optionsService, new MockLogService());
      const buffer = bufferService.buffer;

      while (!buffer.lines.isFull) {
        bufferService.scroll(eraseAttr);
      }

      bufferService.isUserScrolling = false;
      bufferService.scroll(eraseAttr);

      assert.strictEqual(buffer.ydisp, buffer.ybase);
    });
  });
});
