/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as puppeteer from 'puppeteer';

export async function pollFor<T>(page: puppeteer.Page, evalOrFn: string | (() => Promise<T>), val: T, preFn?: () => Promise<void>): Promise<void> {
  if (preFn) {
    await preFn();
  }
  const result = typeof evalOrFn === 'string' ? await page.evaluate(evalOrFn) : await evalOrFn();
  let equal = false;
  if (typeof result === 'object') {
    equal = Object.keys(result).every(e => result[e] === (val as any)[e]);
  } else {
    equal = result === val;
  }
  if (!equal) {
    return new Promise<void>(r => {
      setTimeout(() => r(pollFor(page, evalOrFn, val, preFn)), 10);
    });
  }
}
