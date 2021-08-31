/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as playwright from 'playwright';
import deepEqual = require('deep-equal');
import { ITerminalOptions } from 'xterm';
import { deepStrictEqual, fail } from 'assert';

export async function pollFor<T>(page: playwright.Page, evalOrFn: string | (() => Promise<T>), val: T, preFn?: () => Promise<void>, maxDuration?: number): Promise<void> {
  if (preFn) {
    await preFn();
  }
  const result = typeof evalOrFn === 'string' ? await page.evaluate(evalOrFn) : await evalOrFn();

  if (process.env.DEBUG) {
    console.log('pollFor result: ', result);
  }

  if (!deepEqual(result, val)) {
    if (maxDuration === undefined) {
      maxDuration = 2000;
    }
    if (maxDuration <= 0) {
      deepStrictEqual(result, val, 'pollFor max duration exceeded');
    }
    return new Promise<void>(r => {
      setTimeout(() => r(pollFor(page, evalOrFn, val, preFn, maxDuration! - 10)), 10);
    });
  }
}

export async function writeSync(page: playwright.Page, data: string): Promise<void> {
  await page.evaluate(`
    window.ready = false;
    window.term.write('${data}', () => window.ready = true);
  `);
  await pollFor(page, 'window.ready', true);
}

export async function timeout(ms: number): Promise<void> {
  return new Promise<void>(r => setTimeout(r, ms));
}

export async function openTerminal(page: playwright.Page, options: ITerminalOptions = {}): Promise<void> {
  await page.evaluate(`window.term = new Terminal(${JSON.stringify(options)})`);
  await page.evaluate(`window.term.open(document.querySelector('#terminal-container'))`);
  if (options.rendererType === 'dom') {
    await page.waitForSelector('.xterm-rows');
  } else {
    await page.waitForSelector('.xterm-text-layer');
  }
}

export function getBrowserType(): playwright.BrowserType<playwright.WebKitBrowser> | playwright.BrowserType<playwright.ChromiumBrowser> | playwright.BrowserType<playwright.FirefoxBrowser> {
  // Default to chromium
  let browserType: playwright.BrowserType<playwright.WebKitBrowser> | playwright.BrowserType<playwright.ChromiumBrowser> | playwright.BrowserType<playwright.FirefoxBrowser> = playwright['chromium'];

  const index = process.argv.indexOf('--browser');
  if (index !== -1 && process.argv.length > index + 1 && typeof process.argv[index + 1] === 'string') {
    const string = process.argv[index + 1];
    if (string === 'firefox' || string === 'webkit') {
      browserType = playwright[string];
    }
  }

  return browserType;
}

export function launchBrowser() {
  const browserType = getBrowserType();
  const options: Record<string, unknown> = {
    headless: process.argv.includes('--headless'),
  }

  const index = process.argv.indexOf('--executablePath');
  if(index > 0 && process.argv.length > index + 1 && typeof process.argv[index + 1] === 'string') {
    options.executablePath = process.argv[index + 1];
  }

  return browserType.launch(options);
}
