/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { MacrotaskTimer } from './Async';

describe('MacrotaskTimer', () => {
  const originalScheduler = Object.getOwnPropertyDescriptor(globalThis, 'scheduler');
  let queue: MacrotaskTimer;
  let tasks: (() => Promise<void>)[];
  let signals: AbortSignal[];
  beforeEach(() => {
    tasks = [];
    signals = [];
    Object.defineProperty(globalThis, 'scheduler', { configurable: true, value: {
      postTask(callback: () => void, options: { signal: AbortSignal, priority: string }): Promise<void> {
        assert.equal(options.priority, 'user-visible');
        signals.push(options.signal);
        return new Promise<void>((resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
          tasks.push(async () => {
            if (!options.signal.aborted) {
              try { callback(); resolve(); } catch (error) { reject(error); }
            }
            await Promise.resolve();
          });
        });
      }
    } });
    queue = new MacrotaskTimer();
  });
  afterEach(() => {
    queue.dispose();
    if (originalScheduler) {
      Object.defineProperty(globalThis, 'scheduler', originalScheduler);
    } else {
      Reflect.deleteProperty(globalThis, 'scheduler');
    }
  });

  it('defers work and cancels replaced tasks', async () => {
    const calls: number[] = [];
    queue.cancelAndSet(() => calls.push(1));
    queue.cancelAndSet(() => calls.push(2));
    assert.deepEqual(calls, []);
    assert.isTrue(signals[0].aborted);
    await tasks[0]();
    await tasks[1]();
    assert.deepEqual(calls, [2]);
  });

  it('can schedule the next task from a running task', async () => {
    const calls: number[] = [];
    queue.cancelAndSet(() => {
      calls.push(1);
      queue.cancelAndSet(() => calls.push(2));
    });
    await tasks[0]();
    assert.isFalse(signals[0].aborted);
    assert.deepEqual(calls, [1]);
    await tasks[1]();
    assert.deepEqual(calls, [1, 2]);
  });

  it('cancels pending work on dispose', async () => {
    let calls = 0;
    queue.cancelAndSet(() => calls++);
    queue.dispose();
    queue.dispose();
    await tasks[0]();
    assert.equal(calls, 0);
    assert.throws(() => queue.cancelAndSet(() => {}), /disposed/);
  });

  it('reports callback errors even when the callback disposes the queue', async () => {
    const originalMicrotask = globalThis.queueMicrotask;
    const errors: (() => void)[] = [];
    globalThis.queueMicrotask = callback => { errors.push(callback); };
    try {
      const error = new Error('task failure');
      queue.cancelAndSet(() => { queue.dispose(); throw error; });
      await tasks[0]();
      assert.lengthOf(errors, 1);
      assert.throws(errors[0], 'task failure');
    } finally {
      globalThis.queueMicrotask = originalMicrotask;
    }
  });

  it('falls back to a timer without the scheduler API', async () => {
    Reflect.deleteProperty(globalThis, 'scheduler');
    let ran = false;
    const done = new Promise<void>(resolve => queue.cancelAndSet(() => { ran = true; resolve(); }));
    assert.isFalse(ran);
    await done;
    assert.isTrue(ran);
  });

  it('cancels the fallback timer', async () => {
    Reflect.deleteProperty(globalThis, 'scheduler');
    let ran = false;
    queue.cancelAndSet(() => { ran = true; });
    queue.cancel();
    await new Promise<void>(resolve => setTimeout(resolve, 10));
    assert.isFalse(ran);
  });
});
