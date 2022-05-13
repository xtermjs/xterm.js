/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { ColorZoneStore } from 'browser/decorations/ColorZoneStore';

const optionsRedFull = {
  overviewRulerOptions: {
    color: 'red',
    position: 'full' as 'full'
  }
};

describe('ColorZoneStore', () => {
  let store: ColorZoneStore;

  beforeEach(() => {
    store = new ColorZoneStore();
    store.setPadding({
      full: 1,
      left: 1,
      center: 1,
      right: 1
    });
  });

  it('should merge adjacent zones', () => {
    store.addDecoration({
      marker: { line: 0 },
      options: optionsRedFull
    });
    store.addDecoration({
      marker: { line: 1 },
      options: optionsRedFull
    });
    assert.deepStrictEqual(store.zones, [
      {
        color: 'red',
        position: 'full',
        startBufferLine: 0,
        endBufferLine: 1
      }
    ]);
  });

  it('should not merge non-adjacent zones', () => {
    store.addDecoration({
      marker: { line: 0 },
      options: optionsRedFull
    });
    store.addDecoration({
      marker: { line: 2 },
      options: optionsRedFull
    });
    assert.deepStrictEqual(store.zones, [
      {
        color: 'red',
        position: 'full',
        startBufferLine: 0,
        endBufferLine: 0
      },
      {
        color: 'red',
        position: 'full',
        startBufferLine: 2,
        endBufferLine: 2
      }
    ]);
  });

  it('should reuse zone objects', () => {
    const obj = {
      marker: { line: 0 },
      options: optionsRedFull
    };
    store.addDecoration(obj);
    const zone = store.zones[0];
    store.clear();
    store.addDecoration({
      marker: { line: 1 },
      options: optionsRedFull
    });
    // The object reference should be the same
    assert.equal(zone, store.zones[0]);
  });
});
