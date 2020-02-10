/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as playwright from 'playwright';
import { assert } from 'chai';
import { ITerminalOptions } from 'xterm';

const APP = 'http://127.0.0.1:3000/test';

let browser: playwright.Browser;
let page: playwright.Page;
const width = 800;
const height = 600;

describe('WebLinksAddon', () => {
  before(async function (): Promise<any> {
    this.timeout(10000);
    browser = await getBrowserType().launch({
      headless: process.argv.indexOf('--headless') !== -1,
      args: [`--window-size=${width},${height}`, `--no-sandbox`]
    });
    page = (await browser.defaultContext().pages())[0];
    await page.setViewport({ width, height });
  });

  after(async () => {
    await browser.close();
  });

  beforeEach(async function (): Promise<any> {
    this.timeout(5000);
    await page.goto(APP);
  });

  it('.com', async function (): Promise<any> {
    this.timeout(20000);
    await testHostName('foo.com');
  });

  it('.com.au', async function (): Promise<any> {
    this.timeout(20000);
    await testHostName('foo.com.au');
  });

  it('.io', async function (): Promise<any> {
    this.timeout(20000);
    await testHostName('foo.io');
  });
});

async function testHostName(hostname: string): Promise<void> {
  await openTerminal({ rendererType: 'dom', cols: 40 });
  await page.evaluate(`window.term.loadAddon(new window.WebLinksAddon())`);
  const data = `  http://${hostname}  \\r\\n` +
    `  http://${hostname}/a~b#c~d?e~f  \\r\\n` +
    `  http://${hostname}/colon:test  \\r\\n` +
    `  http://${hostname}/colon:test:  \\r\\n` +
    `"http://${hostname}/"\\r\\n` +
    `\\'http://${hostname}/\\'\\r\\n` +
    `http://${hostname}/subpath/+/id`;
  await writeSync(page, data);
  await pollForLinkAtCell(3, 1, `http://${hostname}`);
  await pollForLinkAtCell(3, 2, `http://${hostname}/a~b#c~d?e~f`);
  await pollForLinkAtCell(3, 3, `http://${hostname}/colon:test`);
  await pollForLinkAtCell(3, 4, `http://${hostname}/colon:test`);
  await pollForLinkAtCell(2, 5, `http://${hostname}/`);
  await pollForLinkAtCell(2, 6, `http://${hostname}/`);
  await pollForLinkAtCell(1, 7, `http://${hostname}/subpath/+/id`);
}

async function openTerminal(options: ITerminalOptions = {}): Promise<void> {
  await page.evaluate(`window.term = new Terminal(${JSON.stringify(options)})`);
  await page.evaluate(`window.term.open(document.querySelector('#terminal-container'))`);
  if (options.rendererType === 'dom') {
    await page.waitForSelector('.xterm-rows');
  } else {
    await page.waitForSelector('.xterm-text-layer');
  }
}

async function pollForLinkAtCell(col: number, row: number, value: string): Promise<void> {
  const rowSelector = `.xterm-rows > :nth-child(${row})`;
  // Ensure the hover element exists before trying to hover it
  await pollFor(page, `!!document.querySelector('${rowSelector} > :nth-child(${col})')`, true);
  await pollFor(page, `document.querySelectorAll('${rowSelector} > span[style]').length >= ${value.length}`, true, async () => page.hover(`${rowSelector} > :nth-child(${col})`));
  assert.equal(await page.evaluate(`Array.prototype.reduce.call(document.querySelectorAll('${rowSelector} > span[style]'), (a, b) => a + b.textContent, '');`), value);
}

async function pollFor(page: playwright.Page, fn: string, val: any, preFn?: () => Promise<void>): Promise<void> {
  if (preFn) {
    await preFn();
  }
  const result = await page.evaluate(fn);
  if (result !== val) {
    return new Promise<void>(r => {
      setTimeout(() => r(pollFor(page, fn, val, preFn)), 10);
    });
  }
}

async function writeSync(page: playwright.Page, data: string): Promise<void> {
  await page.evaluate(`
    window.ready = false;
    window.term.write('${data}', () => window.ready = true);
  `);
  await pollFor(page, 'window.ready', true);
}

function getBrowserType(): playwright.BrowserType {
  // Default to chromium
  let browserType: playwright.BrowserType = playwright['chromium'];

  const index = process.argv.indexOf('--browser');
  if (index !== -1 && process.argv.length > index + 2 && typeof process.argv[index + 1] === 'string') {
    const string = process.argv[index + 1];
    if (string === 'firefox' || string === 'webkit') {
      browserType = playwright[string];
    }
  }

  return browserType;
}
