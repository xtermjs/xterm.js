/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as puppeteer from 'puppeteer';
import { assert } from 'chai';
import { ITerminalOptions } from 'xterm';

const APP = 'http://127.0.0.1:3000/test';

let browser: puppeteer.Browser;
let page: puppeteer.Page;
const width = 1024;
const height = 768;

describe('FitAddon', () => {
  before(async function(): Promise<any> {
    this.timeout(20000);
    browser = await puppeteer.launch({
      headless: process.argv.indexOf('--headless') !== -1,
      args: [`--window-size=${width},${height}`, `--no-sandbox`]
    });
    page = (await browser.pages())[0];
    await page.setViewport({ width, height });
    await page.goto(APP);
    await openTerminal();
  });

  after(async () => {
    await browser.close();
  });

  it('no terminal', async function(): Promise<any> {
    await page.evaluate(`window.fit = new FitAddon();`);
    assert.equal(await page.evaluate(`window.fit.proposeDimensions()`), undefined);
  });

  describe('proposeDimensions', () => {
    afterEach(async () => {
      return unloadFit();
    });

    it('default', async function(): Promise<any> {
      await loadFit();
      assert.deepEqual(await page.evaluate(`window.fit.proposeDimensions()`), {
        cols: 87,
        rows: 26
      });
    });

    it('width', async function(): Promise<any> {
      await loadFit(1008);
      assert.deepEqual(await page.evaluate(`window.fit.proposeDimensions()`), {
        cols: 110,
        rows: 26
      });
    });

    it('small', async function(): Promise<any> {
      await loadFit(1, 1);
      assert.deepEqual(await page.evaluate(`window.fit.proposeDimensions()`), {
        cols: 2,
        rows: 1
      });
    });
  });

  describe('fit', () => {
    afterEach(async () => {
      return unloadFit();
    });

    it('default', async function(): Promise<any> {
      await loadFit();
      await page.evaluate(`window.fit.fit()`);
      assert.equal(await page.evaluate(`window.term.cols`), 87);
      assert.equal(await page.evaluate(`window.term.rows`), 26);
    });

    it('width', async function(): Promise<any> {
      await loadFit(1008);
      await page.evaluate(`window.fit.fit()`);
      assert.equal(await page.evaluate(`window.term.cols`), 110);
      assert.equal(await page.evaluate(`window.term.rows`), 26);
    });

    it('small', async function(): Promise<any> {
      await loadFit(1, 1);
      await page.evaluate(`window.fit.fit()`);
      assert.equal(await page.evaluate(`window.term.cols`), 2);
      assert.equal(await page.evaluate(`window.term.rows`), 1);
    });
  });
});

async function loadFit(width: number = 800, height: number = 450): Promise<void> {
  await page.evaluate(`
    window.fit = new FitAddon();
    window.term.loadAddon(window.fit);
    document.querySelector('#terminal-container').style.width='${width}px';
    document.querySelector('#terminal-container').style.height='${height}px';
  `);
}

async function unloadFit(): Promise<void> {
  await page.evaluate(`window.fit.dispose();`);
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
