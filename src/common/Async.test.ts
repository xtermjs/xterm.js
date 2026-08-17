/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { MacrotaskTimer } from './Async';

describe('MacrotaskTimer', () => {
  let timer: MacrotaskTimer;

  beforeEach(() => {
    timer = new MacrotaskTimer();
  });

  afterEach(() => {
    timer.dispose();
  });

  it('runs the runner on a zero delay', done => {
    timer.cancelAndSet(() => done(), 0);
  });

  it('runs the runner on a non-zero delay', done => {
    timer.cancelAndSet(() => done(), 5);
  });

  it('cancelAndSet cancels a previously scheduled zero-delay runner', done => {
    let firstRan = false;
    timer.cancelAndSet(() => { firstRan = true; }, 0);
    timer.cancelAndSet(() => {
      assert.isFalse(firstRan);
      done();
    }, 0);
  });

  it('cancelAndSet cancels a previously scheduled timeout runner', done => {
    let firstRan = false;
    timer.cancelAndSet(() => { firstRan = true; }, 20);
    timer.cancelAndSet(() => {
      assert.isFalse(firstRan);
      done();
    }, 0);
    setTimeout(() => {
      assert.isFalse(firstRan);
    }, 30);
  });

  it('cancel prevents a scheduled zero-delay runner from running', done => {
    let ran = false;
    timer.cancelAndSet(() => { ran = true; }, 0);
    timer.cancel();
    setTimeout(() => {
      assert.isFalse(ran);
      done();
    }, 20);
  });

  it('cancel prevents a scheduled timeout runner from running', done => {
    let ran = false;
    timer.cancelAndSet(() => { ran = true; }, 10);
    timer.cancel();
    setTimeout(() => {
      assert.isFalse(ran);
      done();
    }, 20);
  });

  it('dispose prevents a scheduled runner from running', done => {
    let ran = false;
    timer.cancelAndSet(() => { ran = true; }, 0);
    timer.dispose();
    setTimeout(() => {
      assert.isFalse(ran);
      done();
    }, 20);
  });

  it('throws when cancelAndSet is called after dispose', () => {
    timer.dispose();
    assert.throws(() => timer.cancelAndSet(() => {}, 0));
  });

  it('supports repeated zero-delay scheduling without leaking handles', done => {
    let count = 0;
    const schedule = (): void => {
      timer.cancelAndSet(() => {
        count++;
        if (count < 20) {
          schedule();
        } else {
          done();
        }
      }, 0);
    };
    schedule();
  });
});
