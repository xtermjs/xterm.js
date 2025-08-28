/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { BufferSet } from 'common/buffer/BufferSet';
import { Buffer } from 'common/buffer/Buffer';
import { MockOptionsService, MockBufferService } from 'common/TestUtils.test';
import { Emitter } from 'vs/base/common/event';

describe('BufferSet', () => {
  let bufferSet: BufferSet;

  beforeEach(() => {
    bufferSet = new BufferSet(
      new MockOptionsService({ scrollback: 1000 }),
      new MockBufferService(80, 24)
    );
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

  describe('cursor handling when swapping buffers', () => {
    beforeEach(() => {
      bufferSet.normal.x = 0;
      bufferSet.normal.y = 0;
      bufferSet.alt.x = 0;
      bufferSet.alt.y = 0;
    });

    it('should keep the cursor stationary when activating alt buffer', () => {
      bufferSet.activateNormalBuffer();
      bufferSet.active.x = 30;
      bufferSet.active.y = 10;
      bufferSet.activateAltBuffer();
      assert.equal(bufferSet.active.x, 30);
      assert.equal(bufferSet.active.y, 10);
    });
    it('should keep the cursor stationary when activating normal buffer', () => {
      bufferSet.activateAltBuffer();
      bufferSet.active.x = 30;
      bufferSet.active.y = 10;
      bufferSet.activateNormalBuffer();
      assert.equal(bufferSet.active.x, 30);
      assert.equal(bufferSet.active.y, 10);
    });
  });

  describe('markers', () => {
    it('should clear the markers when the buffer is switched', () => {
      bufferSet.activateAltBuffer();
      bufferSet.alt.addMarker(1);
      assert.equal(bufferSet.alt.markers.length, 1);
      bufferSet.activateNormalBuffer();
      assert.equal(bufferSet.alt.markers.length, 0);
    });
  });

  describe('scroll position synchronization', () => {
    it('should call syncScrollPosition when switching from alt back to normal buffer', () => {
      bufferSet.activateNormalBuffer();

      const originalYDisp = 50;
      bufferSet.normal.ydisp = originalYDisp;
      bufferSet.normal.ybase = 100;
      const mockBufferService = (bufferSet as any)._bufferService as MockBufferService;

      let syncScrollPositionCalled = false;
      const originalSyncScrollPosition = mockBufferService.syncScrollPosition.bind(mockBufferService);
      mockBufferService.syncScrollPosition = () => {
        syncScrollPositionCalled = true;
        originalSyncScrollPosition();
      };

      bufferSet.activateAltBuffer();
      assert.equal(bufferSet.normal.ydisp, originalYDisp, 'Normal buffer ydisp should be preserved');
      syncScrollPositionCalled = false;
      bufferSet.activateNormalBuffer();

      assert.equal(bufferSet.normal.ydisp, originalYDisp, 'Normal buffer ydisp should be restored');
      assert.equal(syncScrollPositionCalled, true, 'activateNormalBuffer should call syncScrollPosition');
      assert.equal(bufferSet.active, bufferSet.normal, 'Normal buffer should be active');
    });

    it('should preserve normal buffer scroll position when switching back from alt buffer', () => {
      bufferSet.activateNormalBuffer();
      const normalScrollPos = 80;
      bufferSet.normal.ydisp = normalScrollPos;
      bufferSet.normal.ybase = 150;

      bufferSet.activateAltBuffer();
      bufferSet.alt.ydisp = 0;
      bufferSet.alt.ybase = 0;
      bufferSet.activateNormalBuffer();

      assert.equal(bufferSet.normal.ydisp, normalScrollPos, 'Normal buffer should maintain its scroll position');
      assert.equal(bufferSet.active, bufferSet.normal, 'Normal buffer should be active');
      assert.notEqual(bufferSet.normal.ydisp, bufferSet.alt.ydisp, 'Normal and alt buffer should have different scroll positions');
    });

    it('should fire scroll event with correct position when syncScrollPosition is called', () => {
      const mockBufferService = (bufferSet as any)._bufferService as MockBufferService;

      bufferSet.activateNormalBuffer();
      const testScrollPosition = 42;

      mockBufferService.buffer.ydisp = testScrollPosition;
      assert.equal(mockBufferService.buffer.ydisp, testScrollPosition, 'Active buffer ydisp should be set correctly');

      let scrollEventFired = false;
      let scrollEventPosition = -1;

      mockBufferService.onScroll((position: number) => {
        scrollEventFired = true;
        scrollEventPosition = position;
      });

      mockBufferService.syncScrollPosition();
      assert.equal(scrollEventFired, true, 'syncScrollPosition should fire scroll event');
      assert.equal(scrollEventPosition, testScrollPosition, `Scroll event should contain current buffer ydisp`);
    });
  });
});
