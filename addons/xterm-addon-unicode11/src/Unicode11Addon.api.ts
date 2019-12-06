/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as puppeteer from 'puppeteer';
import { ITerminalOptions } from 'xterm';
import { assert } from 'chai';

const APP = 'http://127.0.0.1:3000/test';

let browser: puppeteer.Browser;
let page: puppeteer.Page;
const width = 800;
const height = 600;

describe('Unicode11Addon', () => {
  before(async function(): Promise<any> {
    this.timeout(20000);
    browser = await puppeteer.launch({
      headless: process.argv.indexOf('--headless') !== -1,
      args: [`--window-size=${width},${height}`, `--no-sandbox`]
    });
    page = (await browser.pages())[0];
    await page.setViewport({ width, height });
  });

  after(async () => {
    await browser.close();
  });

  beforeEach(async function(): Promise<any> {
    this.timeout(20000);
    await page.goto(APP);
    await openTerminal();
  });

  it('wcwidth V11 emoji test', async () => {
    await page.evaluate(`
      window.unicode11 = new Unicode11Addon();
      window.term.loadAddon(window.unicode11);
    `);
    // should have loaded '11'
    assert.deepEqual(await page.evaluate(`window.term.unicode.versions`), ['6', '11']);
    // switch should not throw
    await page.evaluate(`window.term.unicode.activeVersion = '11';`);
    assert.deepEqual(await page.evaluate(`window.term.unicode.activeVersion`), '11');
    // v6: 10, V11: 20
    assert.deepEqual(await page.evaluate(`window.term._core._unicodeService.getStringCellWidth('🤣🤣🤣🤣🤣🤣🤣🤣🤣🤣')`), 20);
  });
});

async function openTerminal(options: ITerminalOptions = {}): Promise<void> {
  await page.evaluate(`window.term = new Terminal(${JSON.stringify(options)})`);
  await page.evaluate(`window.term.open(document.querySelector('#terminal-container'))`);
  if (options.rendererType === 'dom') {
    await page.waitForSelector('.xterm-rows');
  } else {
    await page.waitForSelector('.xterm-text-layer');
  }
}
