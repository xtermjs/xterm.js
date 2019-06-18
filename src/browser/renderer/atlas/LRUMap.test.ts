/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { LRUMap } from 'browser/renderer/atlas/LRUMap';

describe('LRUMap', () => {
  it('can be used to store and retrieve values', () => {
    const map = new LRUMap(10);
    map.set(1, 'valuea');
    map.set(2, 'valueb');
    map.set(3, 'valuec');
    assert.strictEqual(map.get(1), 'valuea');
    assert.strictEqual(map.get(2), 'valueb');
    assert.strictEqual(map.get(3), 'valuec');
  });

  it('maintains a size from insertions', () => {
    const map = new LRUMap(10);
    assert.strictEqual(map.size, 0);
    map.set(1, 'value');
    assert.strictEqual(map.size, 1);
    map.set(2, 'value');
    assert.strictEqual(map.size, 2);
  });

  it('deletes the oldest entry when the capacity is exceeded', () => {
    const map = new LRUMap(4);
    map.set(1, 'value');
    map.set(2, 'value');
    map.set(3, 'value');
    map.set(4, 'value');
    map.set(5, 'value');
    assert.isNull(map.get(1));
    assert.isNotNull(map.get(2));
    assert.isNotNull(map.get(3));
    assert.isNotNull(map.get(4));
    assert.isNotNull(map.get(5));
    assert.strictEqual(map.size, 4);
  });

  it('prevents a recently accessed entry from getting deleted', () => {
    const map = new LRUMap(2);
    map.set(1, 'value');
    map.set(2, 'value');
    map.get(1);
    // a would normally get deleted here, except that we called get()
    map.set(3, 'value');
    assert.isNotNull(map.get(1));
    // b got deleted instead of a
    assert.isNull(map.get(2));
    assert.isNotNull(map.get(3));
  });

  it('supports mutation', () => {
    const map = new LRUMap(10);
    map.set(1, 'oldvalue');
    map.set(1, 'newvalue');
    // mutation doesn't change the size
    assert.strictEqual(map.size, 1);
    assert.strictEqual(map.get(1), 'newvalue');
  });
});
