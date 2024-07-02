/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test from '@playwright/test';
import { deepEqual, ok, strictEqual } from 'assert';
import { ITestContext, createTestContext, openTerminal, timeout } from '../../../out-test/playwright/TestUtils';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx);
});
test.afterAll(async () => await ctx.page.close());

test.describe('FitAddon', () => {
  test.beforeEach(async function(): Promise<any> {
    await ctx.page.evaluate(`
      window.term.reset()
      window.fit?.dispose();
      window.fit = new FitAddon();
      window.term.loadAddon(window.fit);
    `);
  });

  // test.beforeEach(async function(): Promise<any> {
  //   await ctx.page.evaluate(`document.querySelector('#terminal-container').style.display=''`);
  //   await openTerminal(page);
  // });

  // after(async () => {
  //   await browser.close();
  // });

  // afterEach(async function(): Promise<any> {
  //   await ctx.proxy.dispose();
  // });

  test('no terminal', async function(): Promise<any> {
    await ctx.page.evaluate(`window.fit = new FitAddon();`);
    strictEqual(await ctx.page.evaluate(`window.fit.proposeDimensions()`), undefined);
  });

  test.describe('proposeDimensions', () => {
    // test.afterEach(() => unloadFit());

    test('default', async function(): Promise<any> {
      await loadFit();
      const dimensions: {cols: number, rows: number} = await ctx.page.evaluate(`window.fit.proposeDimensions()`);
      ok(dimensions.cols > 85);
      ok(dimensions.cols < 88);
      ok(dimensions.rows > 24);
      ok(dimensions.rows < 29);
    });

    test('width', async function(): Promise<any> {
      await loadFit(1008);
      const dimensions: {cols: number, rows: number} = await ctx.page.evaluate(`window.fit.proposeDimensions()`);
      ok(dimensions.cols > 108);
      ok(dimensions.cols < 111);
      ok(dimensions.rows > 24);
      ok(dimensions.rows < 29);
    });

    test('small', async function(): Promise<any> {
      await loadFit(1, 1);
      deepEqual(await ctx.page.evaluate(`window.fit.proposeDimensions()`), {
        cols: 2,
        rows: 1
      });
    });

    test('hidden', async function(): Promise<any> {
      await ctx.proxy.dispose();
      await ctx.page.evaluate(`document.querySelector('#terminal-container').style.display='none'`);
      await ctx.page.evaluate(`window.term = new Terminal()`);
      await ctx.page.evaluate(`window.term.open(document.querySelector('#terminal-container'))`);
      await loadFit();
      const dimensions: { cols: number, rows: number } | undefined = await ctx.page.evaluate(`window.fit.proposeDimensions()`);
      // The value of dims will be undefined if the char measure strategy falls back to the DOM
      // method, so only assert if it's not undefined.
      if (dimensions) {
        ok(dimensions.cols > 85);
        ok(dimensions.cols < 88);
        ok(dimensions.rows > 24);
        ok(dimensions.rows < 29);
      }
      await ctx.page.evaluate(`document.querySelector('#terminal-container').style.display='block'`);
    });
  });

  test.describe('fit', () => {
    test.afterEach(() => unloadFit());

    test('default', async function(): Promise<any> {
      await loadFit();
      await ctx.page.evaluate(`window.fit.fit()`);
      const cols: number = await ctx.proxy.cols;
      const rows: number = await ctx.proxy.rows;
      ok(cols > 85);
      ok(cols < 88);
      ok(rows > 24);
      ok(rows < 29);
    });

    test('width', async function(): Promise<any> {
      await loadFit(1008);
      await ctx.page.evaluate(`window.fit.fit()`);
      const cols: number = await ctx.proxy.cols;
      const rows: number = await ctx.proxy.rows;
      ok(cols > 108);
      ok(cols < 111);
      ok(rows > 24);
      ok(rows < 29);
    });

    test('small', async function(): Promise<any> {
      await loadFit(1, 1);
      await ctx.page.evaluate(`window.fit.fit()`);
      strictEqual(await ctx.proxy.cols, 2);
      strictEqual(await ctx.proxy.rows, 1);
    });
  });
});

async function loadFit(width: number = 800, height: number = 450): Promise<void> {
  await ctx.page.evaluate(`
    window.fit = new FitAddon();
    window.term.loadAddon(window.fit);
    document.querySelector('#terminal-container').style.width='${width}px';
    document.querySelector('#terminal-container').style.height='${height}px';
  `);
}

async function unloadFit(): Promise<void> {
  await ctx.page.evaluate(`window.fit.dispose();`);
}
