/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as playwright from '@playwright/test';
import deepEqual = require('deep-equal');
import { ITerminalInitOnlyOptions, ITerminalOptions } from '@xterm/xterm';
import { deepStrictEqual } from 'assert';

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

export async function openTerminal(page: playwright.Page, options: ITerminalOptions & ITerminalInitOnlyOptions = {}, testOptions: { loadUnicodeGraphemesAddon: boolean } = { loadUnicodeGraphemesAddon: true }): Promise<void> {
  await page.evaluate(`window.term = new Terminal(${JSON.stringify({ allowProposedApi: true, ...options })})`);
  await page.evaluate(`window.term.open(document.querySelector('#terminal-container'))`);

  // HACK: This is a soft layer breaker that's temporarily included until unicode graphemes have
  // more complete integration tests. See https://github.com/xtermjs/xterm.js/pull/4519#discussion_r1285234453
  if (testOptions.loadUnicodeGraphemesAddon) {
    await page.evaluate(`
      window.unicode = new UnicodeGraphemesAddon();
      window.term.loadAddon(window.unicode);
      window.term.unicode.activeVersion = '15-graphemes';
    `);
  }
  await page.waitForSelector('.xterm-rows');
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

export function launchBrowser(opts?: playwright.LaunchOptions): Promise<playwright.Browser> {
  const browserType = getBrowserType();
  const options: playwright.LaunchOptions = {
    ...opts,
    headless: process.argv.includes('--headless')
  };

  const index = process.argv.indexOf('--executablePath');
  if (index > 0 && process.argv.length > index + 1 && typeof process.argv[index + 1] === 'string') {
    options.executablePath = process.argv[index + 1];
  }

  return browserType.launch(options);
}
