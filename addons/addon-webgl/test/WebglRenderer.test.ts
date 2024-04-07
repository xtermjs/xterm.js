/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test from '@playwright/test';
import { ISharedRendererTestContext, injectSharedRendererTests, injectSharedRendererTestsStandalone } from '../../../out-test/playwright/SharedRendererTests';
import { ITestContext, createTestContext, openTerminal } from '../../../out-test/playwright/TestUtils';
import { platform } from 'os';

let ctx: ITestContext;
const ctxWrapper: ISharedRendererTestContext = { value: undefined } as any;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx);
  ctxWrapper.value = ctx;
  await ctx.page.evaluate(`
    window.addon = new window.WebglAddon(true);
    window.term.loadAddon(window.addon);
  `);
});
test.afterAll(async () => await ctx.page.close());

test.describe('WebGL Renderer Integration Tests', async () => {
  // HACK: webgl2 is often not supported in headless firefox on Linux
  // https://github.com/microsoft/playwright/issues/11566
  if (platform() === 'linux') {
    test.skip(({ browserName }) => browserName === 'firefox');
  }

  injectSharedRendererTests(ctxWrapper);
  injectSharedRendererTestsStandalone(ctxWrapper, async () => {
    await ctx.page.evaluate(`
      window.addon = new window.WebglAddon(true);
      window.term.loadAddon(window.addon);
    `);
  });
});
