/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { perfContext, before, RuntimeCase } from 'xterm-benchmark';
import { Emitter } from 'common/Event';

const ITERATIONS = 1_000_000;

perfContext('Emitter.fire()', () => {
  perfContext('0 listeners', () => {
    let emitter: Emitter<number>;
    before(() => {
      emitter = new Emitter<number>();
    });
    new RuntimeCase('', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        emitter.fire(i);
      }
      return { payloadSize: ITERATIONS };
    }, { fork: false }).showAverageRuntime();
  });

  perfContext('1 listener', () => {
    let emitter: Emitter<number>;
    let sum = 0;
    before(() => {
      emitter = new Emitter<number>();
      emitter.event(e => { sum += e; });
    });
    new RuntimeCase('', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        emitter.fire(i);
      }
      return { payloadSize: ITERATIONS, sum };
    }, { fork: false }).showAverageRuntime();
  });

  perfContext('2 listeners', () => {
    let emitter: Emitter<number>;
    let sum = 0;
    before(() => {
      emitter = new Emitter<number>();
      emitter.event(e => { sum += e; });
      emitter.event(e => { sum += e * 2; });
    });
    new RuntimeCase('', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        emitter.fire(i);
      }
      return { payloadSize: ITERATIONS, sum };
    }, { fork: false }).showAverageRuntime();
  });

  perfContext('5 listeners', () => {
    let emitter: Emitter<number>;
    let sum = 0;
    before(() => {
      emitter = new Emitter<number>();
      for (let j = 0; j < 5; j++) {
        emitter.event(e => { sum += e; });
      }
    });
    new RuntimeCase('', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        emitter.fire(i);
      }
      return { payloadSize: ITERATIONS, sum };
    }, { fork: false }).showAverageRuntime();
  });
});
