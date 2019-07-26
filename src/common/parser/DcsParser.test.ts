/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { DcsParser, DcsHandlerFactory } from 'common/parser/DcsParser';
import { IDcsHandler, IParams } from 'common/parser/Types';
import { utf32ToString, StringToUtf32 } from 'common/input/TextDecoder';
import { Params } from 'common/parser/Params';
import { PAYLOAD_LIMIT } from 'common/parser/Constants';

function toUtf32(s: string): Uint32Array {
  const utf32 = new Uint32Array(s.length);
  const decoder = new StringToUtf32();
  const length = decoder.decode(s, utf32);
  return utf32.subarray(0, length);
}

class TestHandler implements IDcsHandler {
  constructor(public output: any[], public msg: string, public returnFalse: boolean = false) {}
  hook(collect: string, params: IParams, flag: number): void {
    this.output.push([this.msg, 'HOOK', params.toArray(), collect, flag]);
  }
  put(data: Uint32Array, start: number, end: number): void {
    this.output.push([this.msg, 'PUT', utf32ToString(data, start, end)]);
  }
  unhook(success: boolean): void | boolean {
    this.output.push([this.msg, 'UNHOOK', success]);
    if (this.returnFalse) {
      return false;
    }
  }
}

describe('DcsParser', () => {
  let parser: DcsParser;
  let reports: any[] = [];
  beforeEach(() => {
    reports = [];
    parser = new DcsParser();
    parser.setDcsHandlerFallback((id, action, data) => {
      if (data.params) {
        data.params = data.params.toArray();
      }
      reports.push([id, action, data]);
    });
  });
  describe('handler registration', () => {
    it('setDcsHandler', () => {
      parser.setDcsHandler('+p', new TestHandler(reports, 'th'));
      parser.hook('+', Params.fromArray([1, 2, 3]), 'p'.charCodeAt(0));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32('the mouse!');
      parser.put(data, 0, data.length);
      parser.unhook(true);
      assert.deepEqual(reports, [
        // messages from TestHandler
        ['th', 'HOOK', [1, 2, 3], '+', 'p'.charCodeAt(0)],
        ['th', 'PUT', 'Here comes'],
        ['th', 'PUT', 'the mouse!'],
        ['th', 'UNHOOK', true]
      ]);
    });
    it('clearDcsHandler', () => {
      parser.setDcsHandler('+p', new TestHandler(reports, 'th'));
      parser.clearDcsHandler('+p');
      parser.hook('+', Params.fromArray([1, 2, 3]), 'p'.charCodeAt(0));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32('the mouse!');
      parser.put(data, 0, data.length);
      parser.unhook(true);
      assert.deepEqual(reports, [
        // messages from fallback handler
        ['+p', 'HOOK', {collect: '+', params: [1, 2, 3], flag: 'p'.charCodeAt(0)}],
        ['+p', 'PUT', 'Here comes'],
        ['+p', 'PUT', 'the mouse!'],
        ['+p', 'UNHOOK', true]
      ]);
    });
    it('addDcsHandler', () => {
      parser.setDcsHandler('+p', new TestHandler(reports, 'th1'));
      parser.addDcsHandler('+p', new TestHandler(reports, 'th2'));
      parser.hook('+', Params.fromArray([1, 2, 3]), 'p'.charCodeAt(0));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32('the mouse!');
      parser.put(data, 0, data.length);
      parser.unhook(true);
      assert.deepEqual(reports, [
        ['th2', 'HOOK', [1, 2, 3], '+', 'p'.charCodeAt(0)],
        ['th1', 'HOOK', [1, 2, 3], '+', 'p'.charCodeAt(0)],
        ['th2', 'PUT', 'Here comes'],
        ['th1', 'PUT', 'Here comes'],
        ['th2', 'PUT', 'the mouse!'],
        ['th1', 'PUT', 'the mouse!'],
        ['th2', 'UNHOOK', true],
        ['th1', 'UNHOOK', false]  // false due being already handled by th2!
      ]);
    });
    it('addDcsHandler with return false', () => {
      parser.setDcsHandler('+p', new TestHandler(reports, 'th1'));
      parser.addDcsHandler('+p', new TestHandler(reports, 'th2', true));
      parser.hook('+', Params.fromArray([1, 2, 3]), 'p'.charCodeAt(0));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32('the mouse!');
      parser.put(data, 0, data.length);
      parser.unhook(true);
      assert.deepEqual(reports, [
        ['th2', 'HOOK', [1, 2, 3], '+', 'p'.charCodeAt(0)],
        ['th1', 'HOOK', [1, 2, 3], '+', 'p'.charCodeAt(0)],
        ['th2', 'PUT', 'Here comes'],
        ['th1', 'PUT', 'Here comes'],
        ['th2', 'PUT', 'the mouse!'],
        ['th1', 'PUT', 'the mouse!'],
        ['th2', 'UNHOOK', true],
        ['th1', 'UNHOOK', true]  // true since th2 indicated to keep bubbling
      ]);
    });
    it('dispose handlers', () => {
      parser.setDcsHandler('+p', new TestHandler(reports, 'th1'));
      const dispo = parser.addDcsHandler('+p', new TestHandler(reports, 'th2', true));
      dispo.dispose();
      parser.hook('+', Params.fromArray([1, 2, 3]), 'p'.charCodeAt(0));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32('the mouse!');
      parser.put(data, 0, data.length);
      parser.unhook(true);
      assert.deepEqual(reports, [
        ['th1', 'HOOK', [1, 2, 3], '+', 'p'.charCodeAt(0)],
        ['th1', 'PUT', 'Here comes'],
        ['th1', 'PUT', 'the mouse!'],
        ['th1', 'UNHOOK', true]
      ]);
    });
  });
  describe('DcsHandlerFactory', () => {
    it('should be called once on end(true)', () => {
      parser.setDcsHandler('+p', new DcsHandlerFactory((params, data) => reports.push([params.toArray(), data])));
      parser.hook('+', Params.fromArray([1, 2, 3]), 'p'.charCodeAt(0));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32(' the mouse!');
      parser.put(data, 0, data.length);
      parser.unhook(true);
      assert.deepEqual(reports, [[[1, 2, 3], 'Here comes the mouse!']]);
    });
    it('should not be called on end(false)', () => {
      parser.setDcsHandler('+p', new DcsHandlerFactory((params, data) => reports.push([params.toArray(), data])));
      parser.hook('+', Params.fromArray([1, 2, 3]), 'p'.charCodeAt(0));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32(' the mouse!');
      parser.put(data, 0, data.length);
      parser.unhook(false);
      assert.deepEqual(reports, []);
    });
    it('should be disposable', () => {
      parser.setDcsHandler('+p', new DcsHandlerFactory((params, data) => reports.push(['one', params.toArray(), data])));
      const dispo = parser.addDcsHandler('+p', new DcsHandlerFactory((params, data) => reports.push(['two', params.toArray(), data])));
      parser.hook('+', Params.fromArray([1, 2, 3]), 'p'.charCodeAt(0));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32(' the mouse!');
      parser.put(data, 0, data.length);
      parser.unhook(true);
      assert.deepEqual(reports, [['two', [1, 2, 3], 'Here comes the mouse!']]);
      dispo.dispose();
      parser.hook('+', Params.fromArray([1, 2, 3]), 'p'.charCodeAt(0));
      data = toUtf32('some other');
      parser.put(data, 0, data.length);
      data = toUtf32(' data');
      parser.put(data, 0, data.length);
      parser.unhook(true);
      assert.deepEqual(reports, [['two', [1, 2, 3], 'Here comes the mouse!'], ['one', [1, 2, 3], 'some other data']]);
    });
    it('should respect return false', () => {
      parser.setDcsHandler('+p', new DcsHandlerFactory((params, data) => reports.push(['one', params.toArray(), data])));
      parser.addDcsHandler('+p', new DcsHandlerFactory((params, data) => { reports.push(['two', params.toArray(), data]); return false; }));
      parser.hook('+', Params.fromArray([1, 2, 3]), 'p'.charCodeAt(0));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32(' the mouse!');
      parser.put(data, 0, data.length);
      parser.unhook(true);
      assert.deepEqual(reports, [['two', [1, 2, 3], 'Here comes the mouse!'], ['one', [1, 2, 3], 'Here comes the mouse!']]);
    });
    it('should work up to payload limit', function(): void {
      this.timeout(10000);
      parser.setDcsHandler('+p', new DcsHandlerFactory((params, data) => reports.push([params.toArray(), data])));
      parser.hook('+', Params.fromArray([1, 2, 3]), 'p'.charCodeAt(0));
      const data = toUtf32('A'.repeat(1000));
      for (let i = 0; i < PAYLOAD_LIMIT; i += 1000) {
        parser.put(data, 0, data.length);
      }
      parser.unhook(true);
      assert.deepEqual(reports, [[[1, 2, 3], 'A'.repeat(PAYLOAD_LIMIT)]]);
    });
    it('should abort for payload limit +1', function(): void {
      this.timeout(10000);
      parser.setDcsHandler('+p', new DcsHandlerFactory((params, data) => reports.push([params.toArray(), data])));
      parser.hook('+', Params.fromArray([1, 2, 3]), 'p'.charCodeAt(0));
      let data = toUtf32('A'.repeat(1000));
      for (let i = 0; i < PAYLOAD_LIMIT; i += 1000) {
        parser.put(data, 0, data.length);
      }
      data = toUtf32('A');
      parser.put(data, 0, data.length);
      parser.unhook(true);
      assert.deepEqual(reports, []);
    });
  });
});
