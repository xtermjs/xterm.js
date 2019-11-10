/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as puppeteer from 'puppeteer';
import deepEqual = require('deep-equal');

export async function pollFor<T>(page: puppeteer.Page, evalOrFn: string | (() => Promise<T>), val: T, preFn?: () => Promise<void>): Promise<void> {
  if (preFn) {
    await preFn();
  }
  const result = typeof evalOrFn === 'string' ? await page.evaluate(evalOrFn) : await evalOrFn();
  if (!deepEqual(result, val)) {
    return new Promise<void>(r => {
      setTimeout(() => r(pollFor(page, evalOrFn, val, preFn)), 1);
    });
  }
}

export async function writeSync(page: puppeteer.Page, data: string): Promise<void> {
  await page.evaluate(`
    window.ready = false;
    window.term.write('${data}', () => window.ready = true);
  `);
  await pollFor(page, 'window.ready', true);
}

export async function timeout(ms: number): Promise<void> {
  return new Promise<void>(r => setTimeout(r, ms));
}
