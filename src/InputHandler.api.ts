/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as puppeteer from 'puppeteer';
import { assert } from 'chai';
import { ITerminalOptions } from './Types';

const APP = 'http://127.0.0.1:3000/test';

let browser: puppeteer.Browser;
let page: puppeteer.Page;
const width = 800;
const height = 600;

describe('InputHandler Integration Tests', () => {
  before(async function(): Promise<any> {
    this.timeout(10000);
    browser = await puppeteer.launch({
      headless: process.argv.indexOf('--headless') !== -1,
      slowMo: 80,
      args: [`--window-size=${width},${height}`]
    });
    page = (await browser.pages())[0];
    await page.setViewport({ width, height });
  });

  after(() => {
    browser.close();
  });

  beforeEach(async () => {
    await page.goto(APP);
  });

  describe('Device Status Report (DSR)', () => {
    it('Status Report - CSI 5 n', async function(): Promise<any> {
      this.timeout(10000);
      await openTerminal();
      await page.evaluate(`
        window.term.onData(e => window.result = e);
        window.term.write('\\x1b[5n');
      `);
      assert.equal(await page.evaluate(`window.result`), '\x1b[0n');
    });

    it('Report Cursor Position (CPR) - CSI 6 n', async function(): Promise<any> {
      this.timeout(10000);
      await openTerminal();
      await page.evaluate(`window.term.write('\\n\\nfoo')`);
      assert.deepEqual(await page.evaluate(`
        [window.term.buffer.cursorY, window.term.buffer.cursorX]
      `), [2, 3]);
      await page.evaluate(`
        window.term.onData(e => window.result = e);
        window.term.write('\\x1b[6n');
      `);
      assert.equal(await page.evaluate(`window.result`), '\x1b[3;4R');
    });

    it('Report Cursor Position (DECXCPR) - CSI ? 6 n', async function(): Promise<any> {
      this.timeout(10000);
      await openTerminal();
      await page.evaluate(`window.term.write('\\n\\nfoo')`);
      assert.deepEqual(await page.evaluate(`
        [window.term.buffer.cursorY, window.term.buffer.cursorX]
      `), [2, 3]);
      await page.evaluate(`
        window.term.onData(e => window.result = e);
        window.term.write('\\x1b[?6n');
      `);
      assert.equal(await page.evaluate(`window.result`), '\x1b[?3;4R');
    });
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
