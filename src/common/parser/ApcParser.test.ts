/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { ApcParser, ApcHandler } from 'common/parser/ApcParser';
import { StringToUtf32, utf32ToString } from 'common/input/TextDecoder';
import { IApcHandler, IFunctionIdentifier } from 'common/parser/Types';

function toUtf32(s: string): Uint32Array {
  const utf32 = new Uint32Array(s.length);
  const decoder = new StringToUtf32();
  const length = decoder.decode(s, utf32);
  return utf32.subarray(0, length);
}

function identifier(id: IFunctionIdentifier): number {
  let res = 0;
  if (id.prefix) {
    if (id.prefix.length > 1) {
      throw new Error('only one byte as prefix supported');
    }
    res = id.prefix.charCodeAt(0);
    if (res && 0x3c > res || res > 0x3f) {
      throw new Error('prefix must be in range 0x3c .. 0x3f');
    }
  }
  if (id.intermediates) {
    if (id.intermediates.length > 2) {
      throw new Error('only two bytes as intermediates are supported');
    }
    for (let i = 0; i < id.intermediates.length; ++i) {
      const intermediate = id.intermediates.charCodeAt(i);
      if (0x20 > intermediate || intermediate > 0x2f) {
        throw new Error('intermediate must be in range 0x20 .. 0x2f');
      }
      res <<= 8;
      res |= intermediate;
    }
  }
  if (id.final.length !== 1) {
    throw new Error('final must be a single byte');
  }
  const finalCode = id.final.charCodeAt(0);
  if (0x40 > finalCode || finalCode > 0x7e) {
    throw new Error('final must be in range 0x40 .. 0x7e');
  }
  res <<= 8;
  res |= finalCode;

  return res;
}

class TestHandler implements IApcHandler {
  constructor(public output: any[], public msg: string, public returnFalse: boolean = false) {}
  public start(): void {
    this.output.push([this.msg, 'START']);
  }
  public put(data: Uint32Array, start: number, end: number): void {
    this.output.push([this.msg, 'PUT', utf32ToString(data, start, end)]);
  }
  public end(success: boolean): boolean {
    this.output.push([this.msg, 'END', success]);
    if (this.returnFalse) {
      return false;
    }
    return true;
  }
}

describe('ApcParser', () => {
  let parser: ApcParser;
  let reports: any[] = [];
  beforeEach(() => {
    reports = [];
    parser = new ApcParser();
    parser.setHandlerFallback((id, action, data) => reports.push([id, action, data]));
  });
  describe('handler registration', () => {
    it('setApcHandler', () => {
      parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new TestHandler(reports, 'th'));
      parser.start(identifier({intermediates: '+', final: 'p'}));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32('the mouse!');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, [
        // messages from TestHandler
        ['th', 'START'],
        ['th', 'PUT', 'Here comes'],
        ['th', 'PUT', 'the mouse!'],
        ['th', 'END', true]
      ]);
    });
    it('clearApcHandler', () => {
      parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new TestHandler(reports, 'th'));
      parser.clearHandler(identifier({intermediates: '+', final: 'p'}));
      parser.start(identifier({intermediates: '+', final: 'p'}));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32('the mouse!');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, [
        // messages from fallback handler
        [identifier({intermediates: '+', final: 'p'}), 'START', undefined],
        [identifier({intermediates: '+', final: 'p'}), 'PUT', 'Here comes'],
        [identifier({intermediates: '+', final: 'p'}), 'PUT', 'the mouse!'],
        [identifier({intermediates: '+', final: 'p'}), 'END', true]
      ]);
    });
    it('addApcHandler', () => {
      parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new TestHandler(reports, 'th1'));
      parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new TestHandler(reports, 'th2'));
      parser.start(identifier({intermediates: '+', final: 'p'}));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32('the mouse!');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, [
        ['th2', 'START'],
        ['th1', 'START'],
        ['th2', 'PUT', 'Here comes'],
        ['th1', 'PUT', 'Here comes'],
        ['th2', 'PUT', 'the mouse!'],
        ['th1', 'PUT', 'the mouse!'],
        ['th2', 'END', true],
        ['th1', 'END', false]  // false due being already handled by th2!
      ]);
    });
    it('addApcHandler with return false', () => {
      parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new TestHandler(reports, 'th1'));
      parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new TestHandler(reports, 'th2', true));
      parser.start(identifier({intermediates: '+', final: 'p'}));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32('the mouse!');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, [
        ['th2', 'START'],
        ['th1', 'START'],
        ['th2', 'PUT', 'Here comes'],
        ['th1', 'PUT', 'Here comes'],
        ['th2', 'PUT', 'the mouse!'],
        ['th1', 'PUT', 'the mouse!'],
        ['th2', 'END', true],
        ['th1', 'END', true]  // true since th2 indicated to keep bubbling
      ]);
    });
    it('dispose handlers', () => {
      parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new TestHandler(reports, 'th1'));
      const dispo = parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new TestHandler(reports, 'th2', true));
      dispo.dispose();
      parser.start(identifier({intermediates: '+', final: 'p'}));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32('the mouse!');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, [
        ['th1', 'START'],
        ['th1', 'PUT', 'Here comes'],
        ['th1', 'PUT', 'the mouse!'],
        ['th1', 'END', true]
      ]);
    });
  });
  describe('ApcHandlerFactory', () => {
    const TEST_PAYLOAD_LIMIT = 100;
    const CHUNK_SIZE = 10;
    let originalPayloadLimit: number;

    beforeEach(() => {
      const handlerConstructor = ApcHandler as unknown as { _payloadLimit: number };
      originalPayloadLimit = handlerConstructor._payloadLimit;
      handlerConstructor._payloadLimit = TEST_PAYLOAD_LIMIT;
    });

    afterEach(() => {
      const handlerConstructor = ApcHandler as unknown as { _payloadLimit: number };
      handlerConstructor._payloadLimit = originalPayloadLimit;
    });

    it('should be called once on end(true)', () => {
      parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new ApcHandler(data => { reports.push(data); return true; }));
      parser.start(identifier({intermediates: '+', final: 'p'}));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32(' the mouse!');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, ['Here comes the mouse!']);
    });
    it('should not be called on end(false)', () => {
      parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new ApcHandler(data => { reports.push(data); return true; }));
      parser.start(identifier({intermediates: '+', final: 'p'}));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32(' the mouse!');
      parser.put(data, 0, data.length);
      parser.end(false);
      assert.deepEqual(reports, []);
    });
    it('should be disposable', () => {
      parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new ApcHandler(data => { reports.push(['one', data]); return true; }));
      const dispo = parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new ApcHandler(data => { reports.push(['two', data]); return true; }));
      parser.start(identifier({intermediates: '+', final: 'p'}));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32(' the mouse!');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, [['two', 'Here comes the mouse!']]);
      dispo.dispose();
      parser.start(identifier({intermediates: '+', final: 'p'}));
      data = toUtf32('some other');
      parser.put(data, 0, data.length);
      data = toUtf32(' data');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, [['two', 'Here comes the mouse!'], ['one', 'some other data']]);
    });
    it('should respect return false', () => {
      parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new ApcHandler(data => { reports.push(['one', data]); return true; }));
      parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new ApcHandler(data => { reports.push(['two', data]); return false; }));
      parser.start(identifier({intermediates: '+', final: 'p'}));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32(' the mouse!');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, [['two', 'Here comes the mouse!'], ['one', 'Here comes the mouse!']]);
    });
    it('should work up to payload limit', function(): void {
      this.timeout(30000);
      parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new ApcHandler(data => { reports.push(data); return true; }));
      parser.start(identifier({intermediates: '+', final: 'p'}));
      const data = toUtf32('A'.repeat(CHUNK_SIZE));
      for (let i = 0; i < TEST_PAYLOAD_LIMIT; i += CHUNK_SIZE) {
        parser.put(data, 0, data.length);
      }
      parser.end(true);
      assert.deepEqual(reports, ['A'.repeat(TEST_PAYLOAD_LIMIT)]);
    });
    it('should abort for payload limit +1', function(): void {
      this.timeout(30000);
      parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new ApcHandler(data => { reports.push(data); return true; }));
      parser.start(identifier({intermediates: '+', final: 'p'}));
      let data = toUtf32('A'.repeat(CHUNK_SIZE));
      for (let i = 0; i < TEST_PAYLOAD_LIMIT; i += CHUNK_SIZE) {
        parser.put(data, 0, data.length);
      }
      data = toUtf32('A');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, []);
    });
  });
});


class TestHandlerAsync implements IApcHandler {
  constructor(public output: any[], public msg: string, public returnFalse: boolean = false) {}
  public start(): void {
    this.output.push([this.msg, 'START']);
  }
  public put(data: Uint32Array, start: number, end: number): void {
    this.output.push([this.msg, 'PUT', utf32ToString(data, start, end)]);
  }
  public async end(success: boolean): Promise<boolean> {
    // simple sleep to check in tests whether ordering gets messed up
    await Promise.resolve();
    this.output.push([this.msg, 'END', success]);
    if (this.returnFalse) {
      return false;
    }
    return true;
  }
}
async function unhookP(parser: ApcParser, success: boolean): Promise<void> {
  let result: void | Promise<boolean>;
  let prev: boolean | undefined;
  while (result = parser.end(success, prev)) {
    prev = await result;
  }
}


describe('ApcParser - async tests', () => {
  let parser: ApcParser;
  let reports: any[] = [];
  beforeEach(() => {
    reports = [];
    parser = new ApcParser();
    parser.setHandlerFallback((id, action, data) => reports.push([id, action, data]));
  });
  describe('sync and async mixed', () => {
    describe('sync | async | sync', () => {
      it('first should run, cleanup action for others', async () => {
        parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new TestHandler(reports, 's1', false));
        parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new TestHandlerAsync(reports, 'a1', false));
        parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new TestHandler(reports, 's2', false));
        parser.start(identifier({intermediates: '+', final: 'p'}));
        let data = toUtf32('Here comes');
        parser.put(data, 0, data.length);
        data = toUtf32('the mouse!');
        parser.put(data, 0, data.length);
        await unhookP(parser, true);
        assert.deepEqual(reports, [
          // messages from TestHandler
          ['s2', 'START'],
          ['a1', 'START'],
          ['s1', 'START'],
          ['s2', 'PUT', 'Here comes'],
          ['a1', 'PUT', 'Here comes'],
          ['s1', 'PUT', 'Here comes'],
          ['s2', 'PUT', 'the mouse!'],
          ['a1', 'PUT', 'the mouse!'],
          ['s1', 'PUT', 'the mouse!'],
          ['s2', 'END', true],
          ['a1', 'END', false],  // important: a1 before s1
          ['s1', 'END', false]
        ]);
      });
      it('all should run', async () => {
        parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new TestHandler(reports, 's1', true));
        parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new TestHandlerAsync(reports, 'a1', true));
        parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new TestHandler(reports, 's2', true));
        parser.start(identifier({intermediates: '+', final: 'p'}));
        let data = toUtf32('Here comes');
        parser.put(data, 0, data.length);
        data = toUtf32('the mouse!');
        parser.put(data, 0, data.length);
        await unhookP(parser, true);
        assert.deepEqual(reports, [
          // messages from TestHandler
          ['s2', 'START'],
          ['a1', 'START'],
          ['s1', 'START'],
          ['s2', 'PUT', 'Here comes'],
          ['a1', 'PUT', 'Here comes'],
          ['s1', 'PUT', 'Here comes'],
          ['s2', 'PUT', 'the mouse!'],
          ['a1', 'PUT', 'the mouse!'],
          ['s1', 'PUT', 'the mouse!'],
          ['s2', 'END', true],
          ['a1', 'END', true],  // important: a1 before s1
          ['s1', 'END', true]
        ]);
      });
    });
    describe('async | sync | async', () => {
      it('first should run, cleanup action for others', async () => {
        parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new TestHandlerAsync(reports, 'a1', false));
        parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new TestHandler(reports, 's1', false));
        parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new TestHandlerAsync(reports, 'a2', false));
        parser.start(identifier({intermediates: '+', final: 'p'}));
        let data = toUtf32('Here comes');
        parser.put(data, 0, data.length);
        data = toUtf32('the mouse!');
        parser.put(data, 0, data.length);
        await unhookP(parser, true);
        assert.deepEqual(reports, [
          // messages from TestHandler
          ['a2', 'START'],
          ['s1', 'START'],
          ['a1', 'START'],
          ['a2', 'PUT', 'Here comes'],
          ['s1', 'PUT', 'Here comes'],
          ['a1', 'PUT', 'Here comes'],
          ['a2', 'PUT', 'the mouse!'],
          ['s1', 'PUT', 'the mouse!'],
          ['a1', 'PUT', 'the mouse!'],
          ['a2', 'END', true],
          ['s1', 'END', false],  // important: s1 between a2 .. a1
          ['a1', 'END', false]
        ]);
      });
      it('all should run', async () => {
        parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new TestHandlerAsync(reports, 'a1', true));
        parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new TestHandler(reports, 's1', true));
        parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new TestHandlerAsync(reports, 'a2', true));
        parser.start(identifier({intermediates: '+', final: 'p'}));
        let data = toUtf32('Here comes');
        parser.put(data, 0, data.length);
        data = toUtf32('the mouse!');
        parser.put(data, 0, data.length);
        await unhookP(parser, true);
        assert.deepEqual(reports, [
          // messages from TestHandler
          ['a2', 'START'],
          ['s1', 'START'],
          ['a1', 'START'],
          ['a2', 'PUT', 'Here comes'],
          ['s1', 'PUT', 'Here comes'],
          ['a1', 'PUT', 'Here comes'],
          ['a2', 'PUT', 'the mouse!'],
          ['s1', 'PUT', 'the mouse!'],
          ['a1', 'PUT', 'the mouse!'],
          ['a2', 'END', true],
          ['s1', 'END', true],  // important: s1 between a2 .. a1
          ['a1', 'END', true]
        ]);
      });
    });
    describe('ApcHandlerFactory', () => {
      it('should be called once on end(true)', async () => {
        parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new ApcHandler(async data => { reports.push(data); return true; }));
        parser.start(identifier({intermediates: '+', final: 'p'}));
        let data = toUtf32('Here comes');
        parser.put(data, 0, data.length);
        data = toUtf32(' the mouse!');
        parser.put(data, 0, data.length);
        await unhookP(parser, true);
        assert.deepEqual(reports, ['Here comes the mouse!']);
      });
      it('should not be called on end(false)', async () => {
        parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new ApcHandler(async data => { reports.push(data); return true; }));
        parser.start(identifier({intermediates: '+', final: 'p'}));
        let data = toUtf32('Here comes');
        parser.put(data, 0, data.length);
        data = toUtf32(' the mouse!');
        parser.put(data, 0, data.length);
        await unhookP(parser, false);
        assert.deepEqual(reports, []);
      });
      it('should be disposable', async () => {
        parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new ApcHandler(async data => { reports.push(['one', data]); return true; }));
        const dispo = parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new ApcHandler(async data => { reports.push(['two', data]); return true; }));
        parser.start(identifier({intermediates: '+', final: 'p'}));
        let data = toUtf32('Here comes');
        parser.put(data, 0, data.length);
        data = toUtf32(' the mouse!');
        parser.put(data, 0, data.length);
        await unhookP(parser, true);
        assert.deepEqual(reports, [['two', 'Here comes the mouse!']]);
        dispo.dispose();
        parser.start(identifier({intermediates: '+', final: 'p'}));
        data = toUtf32('some other');
        parser.put(data, 0, data.length);
        data = toUtf32(' data');
        parser.put(data, 0, data.length);
        await unhookP(parser, true);
        assert.deepEqual(reports, [['two', 'Here comes the mouse!'], ['one', 'some other data']]);
      });
      it('should respect return false', async () => {
        parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new ApcHandler(async data => { reports.push(['one', data]); return true; }));
        parser.registerHandler(identifier({intermediates: '+', final: 'p'}), new ApcHandler(async data => { reports.push(['two', data]); return false; }));
        parser.start(identifier({intermediates: '+', final: 'p'}));
        let data = toUtf32('Here comes');
        parser.put(data, 0, data.length);
        data = toUtf32(' the mouse!');
        parser.put(data, 0, data.length);
        await unhookP(parser, true);
        assert.deepEqual(reports, [['two', 'Here comes the mouse!'], ['one', 'Here comes the mouse!']]);
      });
    });
  });
});
