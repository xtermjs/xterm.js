/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { openTerminal, launchBrowser, timeout } from '../../../out-test/api/TestUtils';
import { Browser, Page } from '@playwright/test';

const APP = 'http://127.0.0.1:3001/test';

let browser: Browser;
let page: Page;
const width = 1024;
const height = 768;

describe('FitAddon', () => {
  before(async function(): Promise<any> {
    browser = await launchBrowser();
    page = await (await browser.newContext()).newPage();
    await page.setViewportSize({ width, height });
    await page.goto(APP);
  });

  beforeEach(async function(): Promise<any> {
    await page.evaluate(`document.querySelector('#terminal-container').style.display=''`);
    await openTerminal(page);
  });

  after(async () => {
    await browser.close();
  });

  afterEach(async function(): Promise<any> {
    await page.evaluate(`window.term.dispose()`);
  });

  it('no terminal', async function(): Promise<any> {
    await page.evaluate(`window.fit = new FitAddon();`);
    assert.equal(await page.evaluate(`window.fit.proposeDimensions()`), undefined);
  });

  describe('proposeDimensions', () => {
    afterEach(() => unloadFit());

    it('default', async function(): Promise<any> {
      await loadFit();
      const dimensions: {cols: number, rows: number} = await page.evaluate(`window.fit.proposeDimensions()`);
      assert.isAbove(dimensions.cols, 85);
      assert.isBelow(dimensions.cols, 88);
      assert.isAbove(dimensions.rows, 24);
      assert.isBelow(dimensions.rows, 29);
    });

    it('width', async function(): Promise<any> {
      await loadFit(1008);
      const dimensions: {cols: number, rows: number} = await page.evaluate(`window.fit.proposeDimensions()`);
      assert.isAbove(dimensions.cols, 108);
      assert.isBelow(dimensions.cols, 111);
      assert.isAbove(dimensions.rows, 24);
      assert.isBelow(dimensions.rows, 29);
    });

    it('small', async function(): Promise<any> {
      await loadFit(1, 1);
      assert.deepEqual(await page.evaluate(`window.fit.proposeDimensions()`), {
        cols: 2,
        rows: 1
      });
    });

    it('hidden', async function(): Promise<any> {
      await page.evaluate(`window.term.dispose()`);
      await page.evaluate(`document.querySelector('#terminal-container').style.display='none'`);
      await page.evaluate(`window.term = new Terminal()`);
      await page.evaluate(`window.term.open(document.querySelector('#terminal-container'))`);
      await loadFit();
      const dimensions: { cols: number, rows: number } | undefined = await page.evaluate(`window.fit.proposeDimensions()`);
      // The value of dims will be undefined if the char measure strategy falls back to the DOM
      // method, so only assert if it's not undefined.
      if (dimensions) {
        assert.isAbove(dimensions.cols, 85);
        assert.isBelow(dimensions.cols, 88);
        assert.isAbove(dimensions.rows, 24);
        assert.isBelow(dimensions.rows, 29);
      }
    });
  });

  describe('fit', () => {
    afterEach(() => unloadFit());

    it('default', async function(): Promise<any> {
      await loadFit();
      await page.evaluate(`window.fit.fit()`);
      const cols: number = await page.evaluate(`window.term.cols`);
      const rows: number = await page.evaluate(`window.term.rows`);
      assert.isAbove(cols, 85);
      assert.isBelow(cols, 88);
      assert.isAbove(rows, 24);
      assert.isBelow(rows, 29);
    });

    it('width', async function(): Promise<any> {
      await loadFit(1008);
      await page.evaluate(`window.fit.fit()`);
      const cols: number = await page.evaluate(`window.term.cols`);
      const rows: number = await page.evaluate(`window.term.rows`);
      assert.isAbove(cols, 108);
      assert.isBelow(cols, 111);
      assert.isAbove(rows, 24);
      assert.isBelow(rows, 29);
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
