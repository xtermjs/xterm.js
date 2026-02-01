/**
 * Copyright (c) 2024-2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { Emitter } from 'common/Event';

describe('Emitter', () => {
  it('should fire with 0 listeners without error', () => {
    const emitter = new Emitter<number>();
    emitter.fire(42);
  });

  it('should fire with 1 listener', () => {
    const emitter = new Emitter<number>();
    let received: number | undefined;
    emitter.event(e => { received = e; });
    emitter.fire(42);
    assert.strictEqual(received, 42);
  });

  it('should fire with 1 listener using thisArgs', () => {
    const emitter = new Emitter<number>();
    const obj = { value: 0, handler(e: number) { this.value = e; } };
    emitter.event(obj.handler, obj);
    emitter.fire(42);
    assert.strictEqual(obj.value, 42);
  });

  it('should fire with multiple listeners', () => {
    const emitter = new Emitter<number>();
    const results: number[] = [];
    emitter.event(e => results.push(e * 1));
    emitter.event(e => results.push(e * 2));
    emitter.event(e => results.push(e * 3));
    emitter.fire(10);
    assert.deepEqual(results, [10, 20, 30]);
  });

  it('should handle listener removal during fire', () => {
    const emitter = new Emitter<number>();
    const results: string[] = [];
    emitter.event(() => results.push('first'));
    const disposable = emitter.event(() => {
      results.push('second');
      disposable.dispose();
    });
    emitter.event(() => results.push('third'));
    emitter.fire(1);
    assert.deepEqual(results, ['first', 'second', 'third']);
  });

  it('should not fire after dispose', () => {
    const emitter = new Emitter<number>();
    let called = false;
    emitter.event(() => { called = true; });
    emitter.dispose();
    emitter.fire(42);
    assert.strictEqual(called, false);
  });

  it('should allow disposing a listener', () => {
    const emitter = new Emitter<number>();
    let count = 0;
    const disposable = emitter.event(() => { count++; });
    emitter.fire(1);
    disposable.dispose();
    emitter.fire(2);
    assert.strictEqual(count, 1);
  });
});
