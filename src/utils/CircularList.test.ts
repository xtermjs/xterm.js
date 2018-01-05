/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { CircularList } from './CircularList';

class TestCircularList<T> extends CircularList<T> {
  public get array(): T[] { return this._array; }
}

describe('CircularList', () => {
  describe('push', () => {
    it('should push values onto the array', () => {
      const list = new CircularList<string>(5);
      list.push('1');
      list.push('2');
      list.push('3');
      list.push('4');
      list.push('5');
      assert.equal(list.get(0), '1');
      assert.equal(list.get(1), '2');
      assert.equal(list.get(2), '3');
      assert.equal(list.get(3), '4');
      assert.equal(list.get(4), '5');
    });

    it('should push old values from the start out of the array when max length is reached', () => {
      const list = new CircularList<string>(2);
      list.push('1');
      list.push('2');
      assert.equal(list.get(0), '1');
      assert.equal(list.get(1), '2');
      list.push('3');
      assert.equal(list.get(0), '2');
      assert.equal(list.get(1), '3');
      list.push('4');
      assert.equal(list.get(0), '3');
      assert.equal(list.get(1), '4');
    });
  });

  describe('maxLength', () => {
    it('should increase the size of the list', () => {
      const list = new CircularList<string>(2);
      list.push('1');
      list.push('2');
      assert.equal(list.get(0), '1');
      assert.equal(list.get(1), '2');
      list.maxLength = 4;
      list.push('3');
      list.push('4');
      assert.equal(list.get(0), '1');
      assert.equal(list.get(1), '2');
      assert.equal(list.get(2), '3');
      assert.equal(list.get(3), '4');
      list.push('wrapped');
      assert.equal(list.get(0), '2');
      assert.equal(list.get(1), '3');
      assert.equal(list.get(2), '4');
      assert.equal(list.get(3), 'wrapped');
    });

    it('should return the maximum length of the list', () => {
      const list = new CircularList<string>(2);
      assert.equal(list.maxLength, 2);
      list.push('1');
      list.push('2');
      assert.equal(list.maxLength, 2);
      list.push('3');
      assert.equal(list.maxLength, 2);
      list.maxLength = 4;
      assert.equal(list.maxLength, 4);
    });
  });

  describe('length', () => {
    it('should return the current length of the list, capped at the maximum length', () => {
      const list = new CircularList<string>(2);
      assert.equal(list.length, 0);
      list.push('1');
      assert.equal(list.length, 1);
      list.push('2');
      assert.equal(list.length, 2);
      list.push('3');
      assert.equal(list.length, 2);
    });
  });

  describe('splice', () => {
    it('should delete items', () => {
      const list = new CircularList<string>(2);
      list.push('1');
      list.push('2');
      list.splice(0, 1);
      assert.equal(list.length, 1);
      assert.equal(list.get(0), '2');
      list.push('3');
      list.splice(1, 1);
      assert.equal(list.length, 1);
      assert.equal(list.get(0), '2');
    });

    it('should insert items', () => {
      const list = new CircularList<string>(2);
      list.push('1');
      list.splice(0, 0, '2');
      assert.equal(list.length, 2);
      assert.equal(list.get(0), '2');
      assert.equal(list.get(1), '1');
      list.splice(1, 0, '3');
      assert.equal(list.length, 2);
      assert.equal(list.get(0), '3');
      assert.equal(list.get(1), '1');
    });

    it('should delete items then insert items', () => {
      const list = new CircularList<string>(3);
      list.push('1');
      list.push('2');
      list.splice(0, 1, '3', '4');
      assert.equal(list.length, 3);
      assert.equal(list.get(0), '3');
      assert.equal(list.get(1), '4');
      assert.equal(list.get(2), '2');
    });

    it('should wrap the array correctly when more items are inserted than deleted', () => {
      const list = new CircularList<string>(3);
      list.push('1');
      list.push('2');
      list.splice(1, 0, '3', '4');
      assert.equal(list.length, 3);
      assert.equal(list.get(0), '3');
      assert.equal(list.get(1), '4');
      assert.equal(list.get(2), '2');
    });
  });

  describe('trimStart', () => {
    it('should remove items from the beginning of the list', () => {
      const list = new CircularList<string>(5);
      list.push('1');
      list.push('2');
      list.push('3');
      list.push('4');
      list.push('5');
      list.trimStart(1);
      assert.equal(list.length, 4);
      assert.deepEqual(list.get(0), '2');
      assert.deepEqual(list.get(1), '3');
      assert.deepEqual(list.get(2), '4');
      assert.deepEqual(list.get(3), '5');
      list.trimStart(2);
      assert.equal(list.length, 2);
      assert.deepEqual(list.get(0), '4');
      assert.deepEqual(list.get(1), '5');
    });

    it('should remove all items if the requested trim amount is larger than the list\'s length', () => {
      const list = new CircularList<string>(5);
      list.push('1');
      list.trimStart(2);
      assert.equal(list.length, 0);
    });
  });

  describe('shiftElements', () => {
    it('should not mutate the list when count is 0', () => {
      const list = new CircularList<number>(5);
      list.push(1);
      list.push(2);
      list.shiftElements(0, 0, 1);
      assert.equal(list.length, 2);
      assert.equal(list.get(0), 1);
      assert.equal(list.get(1), 2);
    });

    it('should throw for invalid args', () => {
      const list = new CircularList<number>(5);
      list.push(1);
      assert.throws(() => list.shiftElements(-1, 1, 1), 'start argument out of range');
      assert.throws(() => list.shiftElements(1, 1, 1), 'start argument out of range');
      assert.throws(() => list.shiftElements(0, 1, -1), 'Cannot shift elements in list beyond index 0');
    });

    it('should shift an element forward', () => {
      const list = new CircularList<number>(5);
      list.push(1);
      list.push(2);
      list.shiftElements(0, 1, 1);
      assert.equal(list.length, 2);
      assert.equal(list.get(0), 1);
      assert.equal(list.get(1), 1);
    });

    it('should shift elements forward', () => {
      const list = new CircularList<number>(5);
      list.push(1);
      list.push(2);
      list.push(3);
      list.push(4);
      list.shiftElements(0, 2, 2);
      assert.equal(list.length, 4);
      assert.equal(list.get(0), 1);
      assert.equal(list.get(1), 2);
      assert.equal(list.get(2), 1);
      assert.equal(list.get(3), 2);
    });

    it('should shift elements forward, expanding the list if needed', () => {
      const list = new CircularList<number>(5);
      list.push(1);
      list.push(2);
      list.shiftElements(0, 2, 2);
      assert.equal(list.length, 4);
      assert.equal(list.get(0), 1);
      assert.equal(list.get(1), 2);
      assert.equal(list.get(2), 1);
      assert.equal(list.get(3), 2);
    });

    it('should shift elements forward, wrapping the list if needed', () => {
      const list = new CircularList<number>(5);
      list.push(1);
      list.push(2);
      list.push(3);
      list.push(4);
      list.push(5);
      list.shiftElements(2, 2, 3);
      assert.equal(list.length, 5);
      assert.equal(list.get(0), 3);
      assert.equal(list.get(1), 4);
      assert.equal(list.get(2), 5);
      assert.equal(list.get(3), 3);
      assert.equal(list.get(4), 4);
    });

    it('should shift an element backwards', () => {
      const list = new CircularList<number>(5);
      list.push(1);
      list.push(2);
      list.shiftElements(1, 1, -1);
      assert.equal(list.length, 2);
      assert.equal(list.get(0), 2);
      assert.equal(list.get(1), 2);
    });

    it('should shift elements backwards', () => {
      const list = new CircularList<number>(5);
      list.push(1);
      list.push(2);
      list.push(3);
      list.push(4);
      list.shiftElements(2, 2, -2);
      assert.equal(list.length, 4);
      assert.equal(list.get(0), 3);
      assert.equal(list.get(1), 4);
      assert.equal(list.get(2), 3);
      assert.equal(list.get(3), 4);
    });
  });
});
