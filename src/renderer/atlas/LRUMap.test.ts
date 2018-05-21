/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import LRUMap from './LRUMap';

describe('LRUMap', () => {
  it('can be used to store and retrieve values', () => {
    const map = new LRUMap(10);
    map.set('keya', 'valuea');
    map.set('keyb', 'valueb');
    map.set('keyc', 'valuec');
    assert.strictEqual(map.get('keya'), 'valuea');
    assert.strictEqual(map.get('keyb'), 'valueb');
    assert.strictEqual(map.get('keyc'), 'valuec');
  });

  it('maintains a size from insertions', () => {
    const map = new LRUMap(10);
    assert.strictEqual(map.size, 0);
    map.set('a', 'value');
    assert.strictEqual(map.size, 1);
    map.set('b', 'value');
    assert.strictEqual(map.size, 2);
  });

  it('deletes the oldest entry when the capacity is exceeded', () => {
    const map = new LRUMap(4);
    map.set('a', 'value');
    map.set('b', 'value');
    map.set('c', 'value');
    map.set('d', 'value');
    map.set('e', 'value');
    assert.isNull(map.get('a'));
    assert.isNotNull(map.get('b'));
    assert.isNotNull(map.get('c'));
    assert.isNotNull(map.get('d'));
    assert.isNotNull(map.get('e'));
    assert.strictEqual(map.size, 4);
  });

  it('prevents a recently accessed entry from getting deleted', () => {
    const map = new LRUMap(2);
    map.set('a', 'value');
    map.set('b', 'value');
    map.get('a');
    // a would normally get deleted here, except that we called get()
    map.set('c', 'value');
    assert.isNotNull(map.get('a'));
    // b got deleted instead of a
    assert.isNull(map.get('b'));
    assert.isNotNull(map.get('c'));
  });

  it('supports mutation', () => {
    const map = new LRUMap(10);
    map.set('keya', 'oldvalue');
    map.set('keya', 'newvalue');
    // mutation doesn't change the size
    assert.strictEqual(map.size, 1);
    assert.strictEqual(map.get('keya'), 'newvalue');
  });
});
