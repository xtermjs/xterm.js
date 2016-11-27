import { assert } from 'chai';
import { CircularList } from './CircularList';

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
});
