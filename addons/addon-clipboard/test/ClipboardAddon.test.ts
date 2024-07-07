/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test from '@playwright/test';
import { deepEqual, ok, strictEqual } from 'assert';
import { ITestContext, createTestContext, launchBrowser, openTerminal, timeout } from '../../../test/playwright/TestUtils';

let ctx: ITestContext;
test.beforeAll(async ({ browser }, testInfo) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx);
});
test.afterAll(async () => {
  await ctx.page.close();
});

test.describe('ClipboardAddon', () => {

  test.beforeEach(async ({}, testInfo) => {
    // DEBT: This test doesn't work since the migration to @playwright/test
    if (ctx.browser.browserType().name() !== 'chromium') {
      testInfo.skip();
      return;
    }
    if (ctx.browser.browserType().name() === 'chromium') {
      // Enable clipboard access in chromium without user gesture
      await ctx.page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    }
    await ctx.page.evaluate(`
      window.term.reset()
      window.clipboard?.dispose();
      window.clipboard = new ClipboardAddon();
      window.term.loadAddon(window.clipboard);
    `);
  });

  test.beforeEach(async () => {
    await ctx.proxy.reset();
  });

  const testDataEncoded = 'aGVsbG8gd29ybGQ=';
  const testDataDecoded = 'hello world';

  test.describe('write data', async function (): Promise<any> {
    test('simple string', async () => {
      await ctx.proxy.write(`\x1b]52;c;${testDataEncoded}\x07`);
      deepEqual(await ctx.page.evaluate(() => window.navigator.clipboard.readText()), testDataDecoded);
    });
    test('invalid base64 string', async () => {
      await ctx.proxy.write(`\x1b]52;c;${testDataEncoded}invalid\x07`);
      deepEqual(await ctx.page.evaluate(() => window.navigator.clipboard.readText()), '');
    });
    test('empty string', async () => {
      await ctx.proxy.write(`\x1b]52;c;${testDataEncoded}\x07`);
      await ctx.proxy.write(`\x1b]52;c;\x07`);
      deepEqual(await ctx.page.evaluate(() => window.navigator.clipboard.readText()), '');
    });
  });

  test.describe('read data', async function (): Promise<any> {
    test('simple string', async () => {
      await ctx.page.evaluate(`
        window.data = [];
        window.term.onData(e => data.push(e));
      `);
      await ctx.page.evaluate(() => window.navigator.clipboard.writeText('hello world'));
      await ctx.proxy.write(`\x1b]52;c;?\x07`);
      deepEqual(await ctx.page.evaluate('window.data'), [`\x1b]52;c;${testDataEncoded}\x07`]);
    });
    test('clear clipboard', async () => {
      await ctx.proxy.write(`\x1b]52;c;!\x07`);
      await ctx.proxy.write(`\x1b]52;c;?\x07`);
      deepEqual(await ctx.page.evaluate(() => window.navigator.clipboard.readText()), '');
    });
  });
});
