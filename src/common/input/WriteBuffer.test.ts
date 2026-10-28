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
    it('flushSync from a single write callback parses and acknowledges once', async () => {
      let calls = 0;
      await new Promise<void>(resolve => {
        wb.write('abc', () => {
          calls++;
          cbStack.push('abc');
          if (calls === 1) {
            wb.flushSync();
          }
          resolve();
        });
      });
      assert.equal(calls, 1);
      assert.deepEqual(stack, ['abc']);
      assert.deepEqual(cbStack, ['abc']);
      await new Promise<void>(resolve => {
        wb.write('z', () => {
          cbStack.push('z');
          resolve();
        });
      });
      assert.equal(calls, 1);
      assert.deepEqual(stack, ['abc', 'z']);
      assert.deepEqual(cbStack, ['abc', 'z']);
    });
    it('flushSync from a bytes write callback does not replay the chunk', async () => {
      let calls = 0;
      await new Promise<void>(resolve => {
        wb.write(toBytes('abc'), () => {
          calls++;
          if (calls === 1) {
            wb.flushSync();
          }
          resolve();
        });
      });
      assert.equal(calls, 1);
      assert.deepEqual(stack.map(v => fromBytes(v as Uint8Array)), ['abc']);
    });
    it('flushSync from a middle chunk callback does not replay or skip', async () => {
      await new Promise<void>(resolve => {
        wb.write('a', () => cbStack.push('a'));
        wb.write('b', () => {
          cbStack.push('b');
          wb.flushSync();
        });
        wb.write('c', () => cbStack.push('c'));
        wb.write('d', () => {
          cbStack.push('d');
          resolve();
        });
      });
      assert.deepEqual(stack, ['a', 'b', 'c', 'd']);
      assert.deepEqual(cbStack, ['a', 'b', 'c', 'd']);
    });
    it('flushSync at each chunk boundary keeps order and fires each callback once', async () => {
      const chunks = ['a', 'b', 'c', 'd'];
      await new Promise<void>(resolve => {
        for (const chunk of chunks) {
          wb.write(chunk, () => {
            cbStack.push(chunk);
            wb.flushSync();
            if (chunk === 'd') {
              resolve();
            }
          });
        }
      });
      assert.deepEqual(stack, chunks);
      assert.deepEqual(cbStack, chunks);
    });
    it('nested write inside a callback is parsed once and keeps order', async () => {
      await new Promise<void>(resolve => {
        wb.write('a', () => {
          cbStack.push('a');
          wb.write('nested', () => {
            cbStack.push('nested');
            resolve();
          });
          wb.flushSync();
        });
        wb.write('b', () => cbStack.push('b'));
      });
      assert.deepEqual(stack, ['a', 'b', 'nested']);
      assert.deepEqual(cbStack, ['a', 'b', 'nested']);
    });
    it('data written after a re-entrant flushSync is still parsed once', async () => {
      await new Promise<void>(resolve => {
        wb.write('a', () => {
          cbStack.push('a');
          wb.flushSync();
          wb.write('after', () => {
            cbStack.push('after');
            resolve();
          });
        });
        wb.write('b', () => cbStack.push('b'));
      });
      assert.deepEqual(stack, ['a', 'b', 'after']);
      assert.deepEqual(cbStack, ['a', 'b', 'after']);
    });
    it('flushSync does not replay chunks already parsed earlier in the batch', async () => {
      const count = 8;
      await new Promise<void>(resolve => {
        for (let i = 0; i < count; i++) {
          const chunk = String(i);
          wb.write(chunk, () => {
            cbStack.push(chunk);
            if (i === 3) {
              wb.flushSync();
            }
            if (i === count - 1) {
              resolve();
            }
          });
        }
      });
      assert.deepEqual(stack, ['0', '1', '2', '3', '4', '5', '6', '7']);
      assert.deepEqual(cbStack, ['0', '1', '2', '3', '4', '5', '6', '7']);
    });
    it('flushSync processes empty chunks and the data after them', () => {
      wb.write('a', () => cbStack.push('a'));
      wb.write('', () => cbStack.push('empty'));
      wb.write('b', () => cbStack.push('b'));
      wb.flushSync();
      assert.deepEqual(stack, ['a', '', 'b']);
      assert.deepEqual(cbStack, ['a', 'empty', 'b']);
    });
    it('flushSync from the parse action does not reparse the in-flight chunk', async () => {
      let entered = 0;
      wb = new WriteBuffer(data => {
        stack.push(data);
        if (data === 'a' && ++entered === 1) {
          wb.flushSync();
        }
      });
      await new Promise<void>(resolve => {
        wb.write('a', () => cbStack.push('a'));
        wb.write('b', () => cbStack.push('b'));
        wb.write('c', () => {
          cbStack.push('c');
          resolve();
        });
      });
      assert.equal(entered, 1);
      assert.deepEqual(stack, ['a', 'b', 'c']);
      assert.deepEqual(cbStack, ['a', 'b', 'c']);
    });
    it('flushSync during writeSync does not reprocess or drop chunks', () => {
      wb = new WriteBuffer(data => {
        stack.push(data);
        if (data === 'b') {
          wb.flushSync();
        }
      });
      wb.write('a', () => cbStack.push('a'));
      wb.write('b', () => cbStack.push('b'));
      wb.write('c', () => cbStack.push('c'));
      wb.writeSync('d');
      assert.deepEqual(stack, ['a', 'b', 'c', 'd']);
      assert.deepEqual(cbStack, ['a', 'b', 'c']);
    });
    it('writeSync during flushSync keeps chunk order', () => {
      wb = new WriteBuffer(data => {
        stack.push(data);
        if (data === 'b') {
          wb.writeSync('injected');
        }
      });
      wb.write('a');
      wb.write('b');
      wb.write('c');
      wb.flushSync();
      assert.deepEqual(stack, ['a', 'b', 'c', 'injected']);
    });
    it('flushSync while an async handler is pending does not reparse or drop later chunks', async () => {
      let resolveChunk!: (value: boolean) => void;
      let invocations = 0;
      wb = new WriteBuffer(data => {
        invocations++;
        if (data === 'a' && invocations === 1) {
          return new Promise<boolean>(r => { resolveChunk = r; });
        }
        stack.push(data);
      });
      wb.write('a', () => cbStack.push('a'));
      wb.write('b', () => cbStack.push('b'));
      await new Promise<void>(r => setTimeout(r, 0));
      assert.equal(invocations, 1);
      wb.flushSync();
      assert.equal(invocations, 1);
      assert.deepEqual(stack, []);
      assert.deepEqual(cbStack, []);
      resolveChunk(true);
      await new Promise<void>(r => setTimeout(r, 30));
      assert.deepEqual(stack, ['a', 'b']);
      assert.deepEqual(cbStack, ['a', 'b']);
      assert.equal(invocations, 3);
    });
    it('flushSync resumes an async handler without firing its callback early', async () => {
      let resolveChunk!: (value: boolean) => void;
      let invocations = 0;
      wb = new WriteBuffer(data => {
        invocations++;
        if (data === 'b' && invocations === 2) {
          return new Promise<boolean>(r => { resolveChunk = r; });
        }
        stack.push(data);
      });
      wb.write('a', () => cbStack.push('a'));
      wb.write('b', () => cbStack.push('b'));
      wb.write('c', () => cbStack.push('c'));
      wb.flushSync();
      assert.deepEqual(stack, ['a']);
      assert.deepEqual(cbStack, ['a']);
      assert.equal(invocations, 2);
      resolveChunk(true);
      await new Promise<void>(r => setTimeout(r, 30));
      assert.deepEqual(stack, ['a', 'b', 'c']);
      assert.deepEqual(cbStack, ['a', 'b', 'c']);
      assert.equal(invocations, 4);
    });
  });
});
