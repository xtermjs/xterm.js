/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { WriteBuffer } from './WriteBuffer';

// eslint-disable-next-line @typescript-eslint/naming-convention
declare let Buffer: any;

function toBytes(s: string): Uint8Array {
  return Buffer.from(s);
}

function fromBytes(bytes: Uint8Array): string {
  return bytes.toString();
}

describe('WriteBuffer', () => {
  let wb: WriteBuffer;
  let stack: (string | Uint8Array)[] = [];
  let cbStack: string[] = [];
  beforeEach(() => {
    stack = [];
    cbStack = [];
    wb = new WriteBuffer(data => { stack.push(data); });
  });
  afterEach(() => wb.dispose());
  describe('time slicing', () => {
    let now: number;
    let originalNow: PropertyDescriptor | undefined;
    beforeEach(() => {
      now = 100;
      originalNow = Object.getOwnPropertyDescriptor(performance, 'now');
      Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
    });
    afterEach(() => {
      if (originalNow) {
        Object.defineProperty(performance, 'now', originalNow);
      } else {
        Reflect.deleteProperty(performance, 'now');
      }
    });

    it('yields between slices and preserves callbacks including reentrant and empty writes', async () => {
      wb.dispose();
      wb = new WriteBuffer(data => { stack.push(data); now += 13; });
      const slices: number[] = [];
      wb.onWriteParsed(() => slices.push(stack.length));
      const done = new Promise<void>(resolve => {
        wb.write('a', () => { cbStack.push('a'); wb.write('', () => { cbStack.push('empty'); resolve(); }); });
        wb.write('b', () => cbStack.push('b'));
      });
      assert.deepEqual(stack, []);
      await done;
      assert.deepEqual(stack, ['a', 'b', '']);
      assert.deepEqual(cbStack, ['a', 'b', 'empty']);
      assert.deepEqual(slices, [1, 2, 3]);
    });

    it('resumes a slow async handler with its result before subsequent input', async () => {
      let resume!: (value: boolean) => void;
      let began!: () => void;
      const started = new Promise<void>(resolve => { began = resolve; });
      const pending = new Promise<boolean>(resolve => { resume = resolve; });
      const results: (boolean | undefined)[] = [];
      wb.dispose();
      wb = new WriteBuffer((data, result) => {
        stack.push(data);
        results.push(result);
        if (stack.length === 1) { began(); return pending; }
      });
      const done = new Promise<void>(resolve => {
        wb.write('a', () => cbStack.push('a'));
        wb.write('b', () => { cbStack.push('b'); resolve(); });
      });
      await started;
      assert.deepEqual(cbStack, []);
      now += 13;
      resume(false);
      await done;
      assert.deepEqual(stack, ['a', 'a', 'b']);
      assert.isFalse(results[1]);
      assert.deepEqual(cbStack, ['a', 'b']);
    });

    it('does not resume an in-flight async handler after disposal', async () => {
      let resume!: (value: boolean) => void;
      let began!: () => void;
      const started = new Promise<void>(resolve => { began = resolve; });
      const pending = new Promise<boolean>(resolve => { resume = resolve; });
      wb.dispose();
      wb = new WriteBuffer(data => { stack.push(data); began(); return pending; });
      wb.write('a', () => cbStack.push('a'));
      wb.write('b');
      await started;
      wb.dispose();
      now += 13;
      resume(true);
      await new Promise<void>(resolve => setTimeout(resolve, 10));
      assert.deepEqual(stack, ['a']);
      assert.deepEqual(cbStack, []);
    });
  });
  describe('write input', () => {
    it('string', done => {
      wb.write('a._');
      wb.write('b.x', () => { cbStack.push('b'); });
      wb.write('c._');
      wb.write('d.x', () => { cbStack.push('d'); });
      wb.write('e', () => {
        assert.deepEqual(stack, ['a._', 'b.x', 'c._', 'd.x', 'e']);
        assert.deepEqual(cbStack, ['b', 'd']);
        done();
      });
    });
    it('bytes', done => {
      wb.write(toBytes('a._'));
      wb.write(toBytes('b.x'), () => { cbStack.push('b'); });
      wb.write(toBytes('c._'));
      wb.write(toBytes('d.x'), () => { cbStack.push('d'); });
      wb.write(toBytes('e'), () => {
        assert.deepEqual(stack.map(val => typeof val === 'string' ? '' :  fromBytes(val)), ['a._', 'b.x', 'c._', 'd.x', 'e']);
        assert.deepEqual(cbStack, ['b', 'd']);
        done();
      });
    });
    it('string/bytes mixed', done => {
      wb.write('a._');
      wb.write('b.x', () => { cbStack.push('b'); });
      wb.write(toBytes('c._'));
      wb.write(toBytes('d.x'), () => { cbStack.push('d'); });
      wb.write(toBytes('e'), () => {
        assert.deepEqual(stack.map(val => typeof val === 'string' ? val :  fromBytes(val)), ['a._', 'b.x', 'c._', 'd.x', 'e']);
        assert.deepEqual(cbStack, ['b', 'd']);
        done();
      });
    });
    it('write callback works for empty chunks', done => {
      wb.write('a', () => { cbStack.push('a'); });
      wb.write('', () => { cbStack.push('b'); });
      wb.write(toBytes('c'), () => { cbStack.push('c'); });
      wb.write(new Uint8Array(0), () => { cbStack.push('d'); });
      wb.write('e', () => {
        assert.deepEqual(stack.map(val => typeof val === 'string' ? val :  fromBytes(val)), ['a', '', 'c', '', 'e']);
        assert.deepEqual(cbStack, ['a', 'b', 'c', 'd']);
        done();
      });
    });
    it('writeSync', done => {
      wb.write('a', () => { cbStack.push('a'); });
      wb.write('b', () => { cbStack.push('b'); });
      wb.write('c', () => { cbStack.push('c'); });
      wb.writeSync('d');
      assert.deepEqual(stack, ['a', 'b', 'c', 'd']);
      assert.deepEqual(cbStack, ['a', 'b', 'c']);
      wb.write('x', () => { cbStack.push('x'); });
      wb.write('', () => {
        assert.deepEqual(stack, ['a', 'b', 'c', 'd', 'x', '']);
        assert.deepEqual(cbStack, ['a', 'b', 'c', 'x']);
        done();
      });
    });
    it('writeSync called from action does not overflow callstack - issue #3265', () => {
      wb = new WriteBuffer(data => {
        const num = parseInt(data as string);
        if (num < 10000) {
          wb.writeSync('' + (num + 1));
        }
      });
      wb.writeSync('1');
    });
    it('writeSync maxSubsequentCalls argument', () => {
      let last: string = '';
      wb = new WriteBuffer(data => {
        last = data as string;
        const num = parseInt(data as string);
        if (num < 1000000) {
          wb.writeSync('' + (num + 1), 10);
        }
      });
      wb.writeSync('1', 10);
      assert.equal(last, '11'); // 1 + 10 sub calls = 11
    });
    it('flushSync processes all pending writes', done => {
      wb.write('a', () => { cbStack.push('a'); });
      wb.write('b', () => { cbStack.push('b'); });
      wb.write('c', () => { cbStack.push('c'); });
      wb.flushSync();
      assert.deepEqual(stack, ['a', 'b', 'c']);
      assert.deepEqual(cbStack, ['a', 'b', 'c']);
      wb.write('x', () => { cbStack.push('x'); });
      wb.write('', () => {
        assert.deepEqual(stack, ['a', 'b', 'c', 'x', '']);
        assert.deepEqual(cbStack, ['a', 'b', 'c', 'x']);
        done();
      });
    });
    it('flushSync with no pending writes is a no-op', () => {
      wb.flushSync();
      assert.deepEqual(stack, []);
      assert.deepEqual(cbStack, []);
    });
    it('flushSync fires onWriteParsed', () => {
      let parsed = 0;
      wb.onWriteParsed(() => parsed++);
      wb.write('a');
      wb.write('b');
      assert.equal(parsed, 0);
      wb.flushSync();
      assert.equal(parsed, 1);
    });
    it('flushSync with no pending writes does not fire onWriteParsed', () => {
      let parsed = 0;
      wb.onWriteParsed(() => parsed++);
      wb.flushSync();
      assert.equal(parsed, 0);
    });
    it('dispose cancels scheduled innerWrite', done => {
      wb.write('a');
      wb.dispose();
      setTimeout(() => {
        assert.deepEqual(stack, []);
        done();
      }, 20);
    });
    it('dispose does not fire onWriteParsed for pending writes', done => {
      let parsed = 0;
      wb.onWriteParsed(() => parsed++);
      wb.write('a');
      wb.dispose();
      setTimeout(() => {
        assert.equal(parsed, 0);
        done();
      }, 20);
    });
    it('write after dispose is a no-op', done => {
      wb.dispose();
      wb.write('a');
      setTimeout(() => {
        assert.deepEqual(stack, []);
        done();
      }, 20);
    });
    it('dispose is idempotent', done => {
      wb.write('a');
      wb.dispose();
      wb.dispose();
      setTimeout(() => {
        assert.deepEqual(stack, []);
        done();
      }, 20);
    });
    it('async handler continuation is skipped after dispose', done => {
      let resolve!: (value: boolean) => void;
      const pending = new Promise<boolean>(r => { resolve = r; });
      wb = new WriteBuffer(() => pending);
      wb.write('a');
      wb.dispose();
      resolve(true);
      setTimeout(() => {
        assert.deepEqual(stack, []);
        done();
      }, 20);
    });
    it('handleUserInput still processes first chunk synchronously', () => {
      wb.handleUserInput();
      wb.write('a');
      assert.deepEqual(stack, ['a']);
    });
    it('flushSync after dispose is a no-op', done => {
      wb.write('a');
      wb.dispose();
      wb.flushSync();
      setTimeout(() => {
        assert.deepEqual(stack, []);
        done();
      }, 20);
    });
    it('writeSync after dispose is a no-op', () => {
      wb.dispose();
      wb.writeSync('a');
      assert.deepEqual(stack, []);
    });
  });
});
