/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { DecorationLineCache, DecorationService } from './DecorationService';
import { IMarker } from '../primitives/buffer/Types';
import { Disposable } from '../primitives/Lifecycle';
import { Emitter } from '../primitives/Event';
import { MockLogService, MockBufferService, MockOptionsService } from '../TestUtils.test';
import { Buffer } from '../primitives/buffer/Buffer';
import { DEFAULT_ATTR_DATA } from '../primitives/buffer/BufferLine';

describe('DecorationService', () => {
  let bufferService: MockBufferService;
  let service: DecorationService;

  beforeEach(() => {
    bufferService = new MockBufferService(80, 24, new MockOptionsService());
    service = new DecorationService(new MockLogService(), bufferService);
  });

  it('should set isDisposed to true after dispose', () => {
    const decoration = service.registerDecoration({
      marker: bufferService.buffer.addMarker(1)
    });
    assert.ok(decoration);
    assert.isFalse(decoration!.isDisposed);
    decoration!.dispose();
    assert.isTrue(decoration!.isDisposed);
  });

  describe('forEachDecorationAtCell', () => {
    it('should find decoration at its marker line', () => {
      const decoration = service.registerDecoration({
        marker: bufferService.buffer.addMarker(5),
        width: 10
      });
      assert.ok(decoration);
      const found: typeof decoration[] = [];
      service.forEachDecorationAtCell(0, 5, undefined, d => found.push(d));
      assert.strictEqual(found.length, 1);
    });

    it('should find decoration with height > 1 on subsequent lines', () => {
      const decoration = service.registerDecoration({
        marker: bufferService.buffer.addMarker(5),
        width: 10,
        height: 3
      });
      assert.ok(decoration);

      const foundAt5: typeof decoration[] = [];
      service.forEachDecorationAtCell(0, 5, undefined, d => foundAt5.push(d));
      assert.strictEqual(foundAt5.length, 1);

      const foundAt6: typeof decoration[] = [];
      service.forEachDecorationAtCell(0, 6, undefined, d => foundAt6.push(d));
      assert.strictEqual(foundAt6.length, 1);

      const foundAt7: typeof decoration[] = [];
      service.forEachDecorationAtCell(0, 7, undefined, d => foundAt7.push(d));
      assert.strictEqual(foundAt7.length, 1);

      const foundAt8: typeof decoration[] = [];
      service.forEachDecorationAtCell(0, 8, undefined, d => foundAt8.push(d));
      assert.strictEqual(foundAt8.length, 0);
    });

    it('should not find decoration outside its x range', () => {
      const decoration = service.registerDecoration({
        marker: bufferService.buffer.addMarker(5),
        x: 5,
        width: 3,
        height: 2
      });
      assert.ok(decoration);
      const foundAtX4: typeof decoration[] = [];
      service.forEachDecorationAtCell(4, 5, undefined, d => foundAtX4.push(d));
      assert.strictEqual(foundAtX4.length, 0);

      const foundAtX5: typeof decoration[] = [];
      service.forEachDecorationAtCell(5, 5, undefined, d => foundAtX5.push(d));
      assert.strictEqual(foundAtX5.length, 1);

      const foundAtX7: typeof decoration[] = [];
      service.forEachDecorationAtCell(7, 6, undefined, d => foundAtX7.push(d));
      assert.strictEqual(foundAtX7.length, 1);

      const foundAtX8: typeof decoration[] = [];
      service.forEachDecorationAtCell(8, 5, undefined, d => foundAtX8.push(d));
      assert.strictEqual(foundAtX8.length, 0);
    });

    it('should find multi-line decoration when single-line decorations exist on other lines', () => {
      const buffer = bufferService.buffer;
      (buffer as Buffer).fillViewportRows();

      for (let i = 0; i < buffer.lines.length; i++) {
        service.registerDecoration({
          marker: buffer.addMarker(i),
          width: 5
        });
      }
      const multiLine = service.registerDecoration({
        marker: buffer.addMarker(10),
        width: 10,
        height: 3
      });
      assert.ok(multiLine);

      const found: typeof multiLine[] = [];
      service.forEachDecorationAtCell(0, 11, undefined, d => found.push(d));
      assert.include(found, multiLine);
    });
  });

  describe('getDecorationsAtCell', () => {
    it('should find decoration with height > 1 on subsequent lines', () => {
      const decoration = service.registerDecoration({
        marker: bufferService.buffer.addMarker(5),
        width: 10,
        height: 3
      });
      assert.ok(decoration);

      assert.strictEqual([...service.getDecorationsAtCell(0, 5)].length, 1);
      assert.strictEqual([...service.getDecorationsAtCell(0, 6)].length, 1);
      assert.strictEqual([...service.getDecorationsAtCell(0, 7)].length, 1);
      assert.strictEqual([...service.getDecorationsAtCell(0, 8)].length, 0);
    });
  });

  describe('DecorationLineCache', () => {
    it('should return undefined for lines with no indexed decorations', () => {
      const cache = new DecorationLineCache();
      assert.isUndefined(cache.getDecorationsOnLine(0));
    });
  });

  describe('line index maintenance', () => {
    it('should keep lookups correct after buffer trim', () => {
      const buffer = bufferService.buffer;
      (buffer as Buffer).fillViewportRows();

      const marker = buffer.addMarker(buffer.lines.length - 1);
      const decoration = service.registerDecoration({ marker, width: 10 });
      assert.ok(decoration);

      buffer.lines.onTrimEmitter.fire(1);

      const found: typeof decoration[] = [];
      service.forEachDecorationAtCell(0, marker.line, undefined, d => found.push(d));
      assert.strictEqual(found.length, 1);
    });

    it('should remove decoration from line index when marker is trimmed off buffer', () => {
      const buffer = bufferService.buffer;
      (buffer as Buffer).fillViewportRows();

      const marker = buffer.addMarker(0);
      const decoration = service.registerDecoration({ marker, width: 10 });
      assert.ok(decoration);

      buffer.lines.onTrimEmitter.fire(1);
      assert.isTrue(marker.isDisposed);
      assert.isTrue(decoration!.isDisposed);

      const found: typeof decoration[] = [];
      service.forEachDecorationAtCell(0, 0, undefined, d => found.push(d));
      assert.strictEqual(found.length, 0);
    });

    it('should keep multi-line decoration indexed after line insert', async () => {
      const buffer = bufferService.buffer;
      (buffer as Buffer).fillViewportRows();

      const marker = buffer.addMarker(3);
      const decoration = service.registerDecoration({ marker, width: 10, height: 3 });
      assert.ok(decoration);

      buffer.lines.splice(5, 0, buffer.getBlankLine(DEFAULT_ATTR_DATA));
      await new Promise<void>(resolve => queueMicrotask(resolve));

      const foundOnSpan: typeof decoration[] = [];
      for (let line = marker.line; line < marker.line + 3; line++) {
        service.forEachDecorationAtCell(0, line, undefined, d => foundOnSpan.push(d));
      }
      assert.include(foundOnSpan, decoration);

      const foundOutsideSpan: typeof decoration[] = [];
      service.forEachDecorationAtCell(0, marker.line + 3, undefined, d => foundOutsideSpan.push(d));
      assert.strictEqual(foundOutsideSpan.length, 0);
    });
  });
});
