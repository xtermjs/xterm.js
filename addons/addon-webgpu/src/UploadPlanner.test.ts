/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { DirtyCellUploadTracker, planAtlasUploads } from './UploadPlanner';

describe('DirtyCellUploadTracker', () => {
  it('plans and commits an exact single-cell upload', () => {
    const tracker = new DirtyCellUploadTracker(10, 4, 20);
    tracker.mark(3, 2);
    assert.deepEqual(tracker.plan(), {
      ranges: [{ byteOffset: 460, byteLength: 20 }],
      sourceRangeCount: 1,
      dirtyCellCount: 1,
      sourceUploadByteLength: 20,
      uploadByteLength: 20,
      overfetchByteLength: 0
    });
    tracker.commit();
    assert.deepEqual(tracker.plan(), {
      ranges: [],
      sourceRangeCount: 0,
      dirtyCellCount: 0,
      sourceUploadByteLength: 0,
      uploadByteLength: 0,
      overfetchByteLength: 0
    });
  });

  it('merges nearby ranges but preserves distant ranges', () => {
    const tracker = new DirtyCellUploadTracker(32, 1, 20);
    tracker.mark(0, 0);
    tracker.mark(13, 0);
    tracker.mark(31, 0);
    assert.deepEqual(tracker.plan(), {
      ranges: [
        { byteOffset: 0, byteLength: 280 },
        { byteOffset: 620, byteLength: 20 }
      ],
      sourceRangeCount: 2,
      dirtyCellCount: 3,
      sourceUploadByteLength: 300,
      uploadByteLength: 300,
      overfetchByteLength: 240
    });
  });

  it('merges contiguous ranges across a row boundary', () => {
    const tracker = new DirtyCellUploadTracker(4, 2, 20);
    tracker.mark(3, 0);
    tracker.mark(0, 1);
    assert.deepEqual(tracker.plan().ranges, [{ byteOffset: 60, byteLength: 40 }]);
  });

  it('plans a full upload after markAll and clears it after commit', () => {
    const tracker = new DirtyCellUploadTracker(5, 3, 20);
    tracker.markAll();
    assert.deepEqual(tracker.plan(), {
      ranges: [{ byteOffset: 0, byteLength: 300 }],
      sourceRangeCount: 1,
      dirtyCellCount: 15,
      sourceUploadByteLength: 300,
      uploadByteLength: 300,
      overfetchByteLength: 0
    });
    tracker.commit();
    assert.deepEqual(tracker.plan(), {
      ranges: [],
      sourceRangeCount: 0,
      dirtyCellCount: 0,
      sourceUploadByteLength: 0,
      uploadByteLength: 0,
      overfetchByteLength: 0
    });
  });

  it('keeps ranges beyond the fixed merge gap separate', () => {
    const tracker = new DirtyCellUploadTracker(120, 1, 20);
    for (let x = 0; x < 50; x++) tracker.mark(x, 0);
    for (let x = 65; x < 115; x++) tracker.mark(x, 0);
    const plan = tracker.plan();
    assert.equal(plan.sourceRangeCount, 2);
    assert.deepEqual(plan.ranges, [
      { byteOffset: 0, byteLength: 1000 },
      { byteOffset: 1300, byteLength: 1000 }
    ]);
    assert.equal(plan.sourceUploadByteLength, 2000);
    assert.equal(plan.overfetchByteLength, 0);
  });

  it('retains dirty state until commit', () => {
    const tracker = new DirtyCellUploadTracker(10, 2, 20);
    tracker.mark(4, 1);
    const first = tracker.plan();
    const retry = tracker.plan();
    assert.deepEqual(retry, first);
  });
});

describe('planAtlasUploads', () => {
  it('keeps distant dirty rectangles separate', () => {
    const plan = planAtlasUploads(256, 256, [
      { x: 0, y: 0, width: 4, height: 4, version: 1 },
      { x: 200, y: 200, width: 4, height: 4, version: 2 }
    ]);
    assert.lengthOf(plan.rects, 2);
    assert.equal(plan.uploadPixels, 32);
    assert.isFalse(plan.isFullUpload);
  });

  it('uses a bounding rectangle when it is cheaper than many copies', () => {
    const rects = Array.from({ length: 8 }, (_, i) => ({ x: i * 4, y: 0, width: 2, height: 2, version: i + 1 }));
    const plan = planAtlasUploads(256, 256, rects);
    assert.deepEqual(plan.rects, [{ x: 0, y: 0, width: 30, height: 2 }]);
    assert.equal(plan.sourceRectCount, 8);
  });

  it('uses a full upload when it has the lowest cost', () => {
    const plan = planAtlasUploads(64, 64, [
      { x: 0, y: 0, width: 32, height: 64, version: 1 },
      { x: 32, y: 0, width: 32, height: 64, version: 2 }
    ]);
    assert.deepEqual(plan.rects, [{ x: 0, y: 0, width: 64, height: 64 }]);
    assert.isTrue(plan.isFullUpload);
  });

  it('uses a full upload when dirty history is unavailable', () => {
    const plan = planAtlasUploads(32, 16, undefined);
    assert.deepEqual(plan, {
      rects: [{ x: 0, y: 0, width: 32, height: 16 }],
      sourceRectCount: 0,
      uploadPixels: 512,
      isFullUpload: true
    });
  });

  it('prefers fewer calls when upload costs tie', () => {
    const plan = planAtlasUploads(8192, 1, [
      { x: 0, y: 0, width: 1, height: 1, version: 1 },
      { x: 4097, y: 0, width: 1, height: 1, version: 2 }
    ]);
    assert.deepEqual(plan.rects, [{ x: 0, y: 0, width: 4098, height: 1 }]);
    assert.equal(plan.uploadPixels, 4098);
  });
});
