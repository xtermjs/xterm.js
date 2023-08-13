/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { SortedList } from 'common/SortedList';

const deepStrictEqual = assert.deepStrictEqual;

describe('SortedList', () => {
  let list: SortedList<number>;
  function assertList(expected: number[]): void {
    deepStrictEqual(Array.from(list.values()), expected);
  }

  beforeEach(() => {
    list = new SortedList<number>(e => e);
  });

  describe('insert', () => {
    it('should maintain sorted values', () => {
      list.insert(10);
      assertList([10]);
      list.insert(8);
      assertList([8, 10]);
      list.insert(15);
      assertList([8, 10, 15]);
      list.insert(2);
      assertList([2, 8, 10, 15]);
      list.insert(1);
      assertList([1, 2, 8, 10, 15]);
      list.insert(6);
      assertList([1, 2, 6, 8, 10, 15]);
    });
    it('should allow duplicates of the same key', () => {
      list.insert(5);
      assertList([5]);
      list.insert(5);
      assertList([5, 5]);
      list.insert(8);
      assertList([5, 5, 8]);
      list.insert(5);
      assertList([5, 5, 5, 8]);
      list.insert(8);
      assertList([5, 5, 5, 8, 8]);
      list.insert(6);
      assertList([5, 5, 5, 6, 8, 8]);
    });
  });
  it('delete', () => {
    list.insert(1);
    list.insert(2);
    list.insert(4);
    list.insert(3);
    list.insert(5);
    assertList([1, 2, 3, 4, 5]);
    list.delete(1);
    assertList([2, 3, 4, 5]);
    list.delete(3);
    assertList([2, 4, 5]);
    list.delete(4);
    assertList([2, 5]);
    list.delete(5);
    assertList([2]);
    list.delete(2);
    assertList([]);
  });
  it('getKeyIterator', () => {
    list.insert(5);
    list.insert(5);
    list.insert(8);
    list.insert(5);
    list.insert(8);
    list.insert(6);
    assertList([5, 5, 5, 6, 8, 8]);
    deepStrictEqual(Array.from(list.getKeyIterator(1)), []);
    deepStrictEqual(Array.from(list.getKeyIterator(5)), [5, 5, 5]);
    deepStrictEqual(Array.from(list.getKeyIterator(6)), [6]);
    deepStrictEqual(Array.from(list.getKeyIterator(8)), [8, 8]);
    deepStrictEqual(Array.from(list.getKeyIterator(9)), []);
  });
  it('clear', () => {
    list.insert(1);
    list.insert(2);
    list.insert(4);
    list.insert(3);
    list.insert(5);
    list.clear();
    assertList([]);
  });
  it('custom key', () => {
    const customList = new SortedList<{ key: number }>(e => e.key);
    customList.insert({ key: 5 });
    customList.insert({ key: 2 });
    customList.insert({ key: 10 });
    customList.insert({ key: 5 });
    customList.insert({ key: 6 });
    deepStrictEqual(Array.from(customList.values()), [
      { key: 2 },
      { key: 5 },
      { key: 5 },
      { key: 6 },
      { key: 10 }
    ]);
  });
  describe('values', () => {
    it('should iterate correctly when list items change during iteration', () => {
      list.insert(1);
      list.insert(2);
      list.insert(3);
      list.insert(4);
      const visited: number[] = [];
      for (const item of list.values()) {
        visited.push(item);
        list.delete(item);
      }
      deepStrictEqual(visited, [1, 2, 3, 4]);
    });
  });
});
