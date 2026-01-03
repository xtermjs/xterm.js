/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { DecorationService } from './DecorationService';
import { IMarker } from 'common/Types';
import { Disposable } from 'vs/base/common/lifecycle';
import { Emitter } from 'vs/base/common/event';

function createFakeMarker(line: number): IMarker {
  return Object.freeze(new class extends Disposable {
    public readonly id = 1;
    public readonly line = line;
    public readonly isDisposed = false;
    public readonly onDispose = new Emitter<void>().event;
  }());
}

const fakeMarker: IMarker = createFakeMarker(1);

describe('DecorationService', () => {
  it('should set isDisposed to true after dispose', () => {
    const service = new DecorationService();
    const decoration = service.registerDecoration({
      marker: fakeMarker
    });
    assert.ok(decoration);
    assert.isFalse(decoration!.isDisposed);
    decoration!.dispose();
    assert.isTrue(decoration!.isDisposed);
  });

  describe('forEachDecorationAtCell', () => {
    it('should find decoration at its marker line', () => {
      const service = new DecorationService();
      const decoration = service.registerDecoration({
        marker: createFakeMarker(5),
        width: 10
      });
      assert.ok(decoration);

      const found: typeof decoration[] = [];
      service.forEachDecorationAtCell(0, 5, undefined, d => found.push(d));
      assert.strictEqual(found.length, 1);
    });

    it('should find decoration with height > 1 on subsequent lines', () => {
      const service = new DecorationService();
      const decoration = service.registerDecoration({
        marker: createFakeMarker(5),
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
      const service = new DecorationService();
      const decoration = service.registerDecoration({
        marker: createFakeMarker(5),
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
  });

  describe('getDecorationsAtCell', () => {
    it('should find decoration with height > 1 on subsequent lines', () => {
      const service = new DecorationService();
      const decoration = service.registerDecoration({
        marker: createFakeMarker(5),
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
});
