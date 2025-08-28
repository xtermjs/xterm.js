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
    it('should sync scroll position when switching from alt back to normal buffer', () => {
      bufferSet.activateNormalBuffer();

      const originalYDisp = 50;
      bufferSet.normal.ydisp = originalYDisp;
      bufferSet.normal.ybase = 100;

      // Track onScroll events fired by the buffer service
      let scrollEventFired = false;
      let scrollEventPosition = -1;

      const mockBufferService = (bufferSet as any)._bufferService as MockBufferService;
      const originalOnScroll = mockBufferService.onScroll;

      // Mock the onScroll event to track when it's called
      const scrollEmitter = new Emitter<number>();
      mockBufferService.onScroll = scrollEmitter.event;

      // Override syncScrollPosition to actually fire the event
      mockBufferService.syncScrollPosition = () => {
        scrollEventFired = true;
        scrollEventPosition = bufferSet.normal.ydisp;
        scrollEmitter.fire(bufferSet.normal.ydisp);
      };


      bufferSet.activateAltBuffer();
      assert.equal(bufferSet.normal.ydisp, originalYDisp, 'Normal buffer ydisp should be preserved');

      // Reset scroll event tracking
      scrollEventFired = false;
      scrollEventPosition = -1;

      bufferSet.activateNormalBuffer();
      assert.equal(bufferSet.normal.ydisp, originalYDisp, 'Normal buffer ydisp should be restored');
      assert.equal(scrollEventFired, true, 'syncScrollPosition should have fired scroll event');
      assert.equal(scrollEventPosition, originalYDisp, 'Scroll event should contain correct position');
      assert.equal(bufferSet.active, bufferSet.normal, 'Normal buffer should be active');
    });

    it('should preserve normal buffer scroll position even when alt buffer has different position', () => {
      bufferSet.activateNormalBuffer();
      const normalScrollPos = 80;
      bufferSet.normal.ydisp = normalScrollPos;
      bufferSet.normal.ybase = 150;

      bufferSet.activateAltBuffer();
      bufferSet.alt.ydisp = 0;
      bufferSet.alt.ybase = 0;

      const mockBufferService = (bufferSet as any)._bufferService as MockBufferService;
      let syncedPosition = -1;

      // Track the position that gets synced
      mockBufferService.syncScrollPosition = () => {
        syncedPosition = bufferSet.normal.ydisp;
      };

      bufferSet.activateNormalBuffer();
      assert.equal(bufferSet.normal.ydisp, normalScrollPos, 'Normal buffer should maintain its scroll position');
      assert.equal(syncedPosition, normalScrollPos, 'syncScrollPosition should sync with normal buffer position');
      assert.notEqual(syncedPosition, bufferSet.alt.ydisp, 'Sync position should not match alt buffer position');
    });
  });
});
