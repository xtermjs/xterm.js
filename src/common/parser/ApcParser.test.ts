/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { ApcParser, ApcHandler } from 'common/parser/ApcParser';
import { StringToUtf32, utf32ToString } from 'common/input/TextDecoder';
import { IApcHandler } from 'common/parser/Types';
import { PAYLOAD_LIMIT } from 'common/parser/Constants';

function toUtf32(s: string): Uint32Array {
  const utf32 = new Uint32Array(s.length);
  const decoder = new StringToUtf32();
  const length = decoder.decode(s, utf32);
  return utf32.subarray(0, length);
}

class TestHandler implements IApcHandler {
  public id: number;
  public output: [string, number, string, (boolean | string)?][];
  public msg: string;
  public returnFalse: boolean;

  constructor(
    id: number,
    output: [string, number, string, (boolean | string)?][],
    msg: string,
    returnFalse: boolean = false
  ) {
    this.id = id;
    this.output = output;
    this.msg = msg;
    this.returnFalse = returnFalse;
  }
  public start(): void {
    this.output.push([this.msg, this.id, 'START']);
  }
  public put(data: Uint32Array, start: number, end: number): void {
    this.output.push([this.msg, this.id, 'PUT', utf32ToString(data, start, end)]);
  }
  public end(success: boolean): boolean {
    this.output.push([this.msg, this.id, 'END', success]);
    if (this.returnFalse) {
      return false;
    }
    return true;
  }
}

describe('ApcParser', () => {
  let parser: ApcParser;
  let reports: [number, string, (boolean | string | undefined)?][] = [];

  beforeEach(() => {
    reports = [];
    parser = new ApcParser();
    parser.setHandlerFallback((id: number, action: 'START' | 'PUT' | 'END', data?: string | boolean) => {
      reports.push([id, action, data]);
    });
  });

  describe('identifier parsing', () => {
    it('single character identifier', () => {
      parser.start();
      const data = toUtf32('Gf=100,a=T;payload');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, [
        [0x47, 'START', undefined],  // 0x47 = 'G'
        [0x47, 'PUT', 'f=100,a=T;payload'],
        [0x47, 'END', true]
      ]);
    });

    it('identifier with no payload', () => {
      parser.start();
      const data = toUtf32('G');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, [
        [0x47, 'START', undefined],
        [0x47, 'END', true]
      ]);
    });

    it('identifier with chunked payload', () => {
      parser.start();
      let data = toUtf32('Gf=100');
      parser.put(data, 0, data.length);
      data = toUtf32(',a=T');
      parser.put(data, 0, data.length);
      data = toUtf32(';payload');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, [
        [0x47, 'START', undefined],
        [0x47, 'PUT', 'f=100'],
        [0x47, 'PUT', ',a=T'],
        [0x47, 'PUT', ';payload'],
        [0x47, 'END', true]
      ]);
    });

    it('empty APC sequence', () => {
      parser.start();
      parser.end(true);
      assert.deepEqual(reports, []);
    });
  });

  describe('handler registration', () => {
    let handlerReports: [string, number, string, (boolean | string)?][];

    beforeEach(() => {
      handlerReports = [];
    });

    it('registerHandler for specific identifier', () => {
      const G_CODE = 0x47;  // 'G'
      parser.registerHandler(G_CODE, new TestHandler(G_CODE, handlerReports, 'kitty'));
      parser.start();
      const data = toUtf32('Gf=100,a=T;imagedata');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(handlerReports, [
        ['kitty', G_CODE, 'START'],
        ['kitty', G_CODE, 'PUT', 'f=100,a=T;imagedata'],
        ['kitty', G_CODE, 'END', true]
      ]);
      assert.deepEqual(reports, []);
    });

    it('unregistered identifier falls back', () => {
      const G_CODE = 0x47;  // 'G'
      const X_CODE = 0x58;  // 'X'
      parser.registerHandler(G_CODE, new TestHandler(G_CODE, handlerReports, 'kitty'));
      parser.start();
      const data = toUtf32('Xsome data');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(handlerReports, []);
      assert.deepEqual(reports, [
        [X_CODE, 'START', undefined],
        [X_CODE, 'PUT', 'some data'],
        [X_CODE, 'END', true]
      ]);
    });

    it('clearHandler removes handler', () => {
      const G_CODE = 0x47;
      parser.registerHandler(G_CODE, new TestHandler(G_CODE, handlerReports, 'kitty'));
      parser.clearHandler(G_CODE);
      parser.start();
      const data = toUtf32('Gf=100');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(handlerReports, []);
      assert.deepEqual(reports, [
        [G_CODE, 'START', undefined],
        [G_CODE, 'PUT', 'f=100'],
        [G_CODE, 'END', true]
      ]);
    });

    it('multiple handlers for same identifier', () => {
      const G_CODE = 0x47;
      parser.registerHandler(G_CODE, new TestHandler(G_CODE, handlerReports, 'handler1'));
      parser.registerHandler(G_CODE, new TestHandler(G_CODE, handlerReports, 'handler2'));
      parser.start();
      const data = toUtf32('Gdata');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(handlerReports, [
        ['handler2', G_CODE, 'START'],
        ['handler1', G_CODE, 'START'],
        ['handler2', G_CODE, 'PUT', 'data'],
        ['handler1', G_CODE, 'PUT', 'data'],
        ['handler2', G_CODE, 'END', true],
        ['handler1', G_CODE, 'END', false]
      ]);
    });

    it('handler returning false allows fallthrough', () => {
      const G_CODE = 0x47;
      parser.registerHandler(G_CODE, new TestHandler(G_CODE, handlerReports, 'handler1'));
      parser.registerHandler(G_CODE, new TestHandler(G_CODE, handlerReports, 'handler2', true));
      parser.start();
      const data = toUtf32('Gdata');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(handlerReports, [
        ['handler2', G_CODE, 'START'],
        ['handler1', G_CODE, 'START'],
        ['handler2', G_CODE, 'PUT', 'data'],
        ['handler1', G_CODE, 'PUT', 'data'],
        ['handler2', G_CODE, 'END', true],
        ['handler1', G_CODE, 'END', true]
      ]);
    });

    it('dispose removes handler', () => {
      const G_CODE = 0x47;
      parser.registerHandler(G_CODE, new TestHandler(G_CODE, handlerReports, 'handler1'));
      const disposable = parser.registerHandler(G_CODE, new TestHandler(G_CODE, handlerReports, 'handler2'));
      disposable.dispose();
      parser.start();
      const data = toUtf32('Gdata');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(handlerReports, [
        ['handler1', G_CODE, 'START'],
        ['handler1', G_CODE, 'PUT', 'data'],
        ['handler1', G_CODE, 'END', true]
      ]);
    });
  });

  describe('ApcHandler convenience class', () => {
    it('should be called once on end(true)', () => {
      const G_CODE = 0x47;
      const results: [number, string][] = [];
      parser.registerHandler(G_CODE, new ApcHandler((data: string) => {
        results.push([G_CODE, data]);
        return true;
      }));
      parser.start();
      let data = toUtf32('Gf=100');
      parser.put(data, 0, data.length);
      data = toUtf32(',a=T;payload');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(results, [[G_CODE, 'f=100,a=T;payload']]);
    });

    it('should not be called on end(false)', () => {
      const G_CODE = 0x47;
      const results: [number, string][] = [];
      parser.registerHandler(G_CODE, new ApcHandler((data: string) => {
        results.push([G_CODE, data]);
        return true;
      }));
      parser.start();
      const data = toUtf32('Gf=100,a=T;payload');
      parser.put(data, 0, data.length);
      parser.end(false);
      assert.deepEqual(results, []);
    });

    it('should handle payload up to limit', function(): void {
      this.timeout(30000);
      const G_CODE = 0x47;
      const results: [number, string][] = [];
      parser.registerHandler(G_CODE, new ApcHandler((data: string) => {
        results.push([G_CODE, data]);
        return true;
      }));
      parser.start();
      let data = toUtf32('G');
      parser.put(data, 0, data.length);
      data = toUtf32('A'.repeat(1000));
      for (let i = 0; i < PAYLOAD_LIMIT; i += 1000) {
        parser.put(data, 0, data.length);
      }
      parser.end(true);
      assert.deepEqual(results, [[G_CODE, 'A'.repeat(PAYLOAD_LIMIT)]]);
    });

    it('should abort for payload over limit', function(): void {
      this.timeout(30000);
      const G_CODE = 0x47;
      const results: [number, string][] = [];
      parser.registerHandler(G_CODE, new ApcHandler((data: string) => {
        results.push([G_CODE, data]);
        return true;
      }));
      parser.start();
      let data = toUtf32('G');
      parser.put(data, 0, data.length);
      data = toUtf32('A'.repeat(1000));
      for (let i = 0; i < PAYLOAD_LIMIT; i += 1000) {
        parser.put(data, 0, data.length);
      }
      data = toUtf32('A');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(results, []);
    });
  });

  describe('reset behavior', () => {
    let handlerReports: [string, number, string, (boolean | string)?][];

    beforeEach(() => {
      handlerReports = [];
    });

    it('reset during payload cleans up handlers', () => {
      const G_CODE = 0x47;
      parser.registerHandler(G_CODE, new TestHandler(G_CODE, handlerReports, 'kitty'));
      parser.start();
      const data = toUtf32('Gf=100');
      parser.put(data, 0, data.length);
      parser.reset();
      assert.deepEqual(handlerReports, [
        ['kitty', G_CODE, 'START'],
        ['kitty', G_CODE, 'PUT', 'f=100'],
        ['kitty', G_CODE, 'END', false]
      ]);
    });
  });
});

describe('ApcParser - async tests', () => {
  let parser: ApcParser;
  let reports: [number, string, (boolean | string | undefined)?][] = [];

  beforeEach(() => {
    reports = [];
    parser = new ApcParser();
    parser.setHandlerFallback((id: number, action: 'START' | 'PUT' | 'END', data?: string | boolean) => {
      reports.push([id, action, data]);
    });
  });

  async function endP(parser: ApcParser, success: boolean): Promise<void> {
    let result: void | Promise<boolean>;
    let prev: boolean | undefined;
    while (result = parser.end(success, prev)) {
      prev = await result;
    }
  }

  describe('async ApcHandler', () => {
    it('should handle async handler', async () => {
      const G_CODE = 0x47;
      const results: [number, string][] = [];
      parser.registerHandler(G_CODE, new ApcHandler(async (data: string) => {
        await new Promise(res => setTimeout(res, 10));
        results.push([G_CODE, data]);
        return true;
      }));
      parser.start();
      const data = toUtf32('Gf=100,a=T');
      parser.put(data, 0, data.length);
      await endP(parser, true);
      assert.deepEqual(results, [[G_CODE, 'f=100,a=T']]);
    });
  });
});
