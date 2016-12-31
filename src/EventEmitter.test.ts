import { assert } from 'chai';
import { EventEmitter } from './EventEmitter';

describe('EventEmitter', () => {
  let eventEmitter: EventEmitter;

  beforeEach(() => {
    eventEmitter = new EventEmitter();
  });

  describe('once', () => {
    it('should trigger the listener only once', () => {
      let count = 0;
      const listener = () => count++;
      eventEmitter.once('test', listener);
      eventEmitter.emit('test');
      assert.equal(count, 1);
      eventEmitter.emit('test');
      assert.equal(count, 1);
    });
  });

  describe('emit', () => {
    it('should emit events to listeners', () => {
      let count1 = 0;
      let count2 = 0;
      const listener1 = () => count1++;
      const listener2 = () => count2++;
      eventEmitter.on('test', listener1);
      eventEmitter.on('test', listener2);
      eventEmitter.emit('test');
      assert.equal(count1, 1);
      assert.equal(count2, 1);
      eventEmitter.emit('test');
      assert.equal(count1, 2);
      assert.equal(count2, 2);
    });

    it('should manage multiple listener types', () => {
      let count1 = 0;
      let count2 = 0;
      const listener1 = () => count1++;
      const listener2 = () => count2++;
      eventEmitter.on('test', listener1);
      eventEmitter.on('foo', listener2);
      eventEmitter.emit('test');
      assert.equal(count1, 1);
      assert.equal(count2, 0);
      eventEmitter.emit('foo');
      assert.equal(count1, 1);
      assert.equal(count2, 1);
    });
  });

  describe('listeners', () => {
    it('should return listeners for the type requested', () => {
      assert.equal(eventEmitter.listeners('test').length, 0);
      const listener = () => {};
      eventEmitter.on('test', listener);
      assert.deepEqual(eventEmitter.listeners('test'), [listener]);
    });
  });

  describe('off', () => {
    it('should remove the specific listener', () => {
      const listener1 = () => {};
      const listener2 = () => {};
      eventEmitter.on('foo', listener1);
      eventEmitter.on('foo', listener2);
      assert.equal(eventEmitter.listeners('foo').length, 2);
      eventEmitter.off('foo', listener1);
      assert.deepEqual(eventEmitter.listeners('foo'), [listener2]);
    });
  });

  describe('removeAllListeners', () => {
    it('should clear all listeners', () => {
      eventEmitter.on('foo', () => {});
      assert.equal(eventEmitter.listeners('foo').length, 1);
      eventEmitter.removeAllListeners('foo');
      assert.equal(eventEmitter.listeners('foo').length, 0);
    });
  });
});
