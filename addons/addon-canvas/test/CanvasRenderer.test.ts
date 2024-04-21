/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test from '@playwright/test';
import { ISharedRendererTestContext, injectSharedRendererTests, injectSharedRendererTestsStandalone } from '../../../out-test/playwright/SharedRendererTests';
import { ITestContext, createTestContext, openTerminal } from '../../../out-test/playwright/TestUtils';

let ctx: ITestContext;
const ctxWrapper: ISharedRendererTestContext = {
  value: undefined,
  skipCanvasExceptions: true
} as any;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx);
  ctxWrapper.value = ctx;
  await ctx.page.evaluate(`
    window.addon = new window.CanvasAddon(true);
    window.term.loadAddon(window.addon);
  `);
});
test.afterAll(async () => await ctx.page.close());

test.describe('Canvas Renderer Integration Tests', () => {
  // HACK: The tests fail for an unknown reason
  test.skip(({ browserName }) => browserName === 'webkit');

  injectSharedRendererTests(ctxWrapper);
  injectSharedRendererTestsStandalone(ctxWrapper, async () => {
    await ctx.page.evaluate(`
      window.addon = new window.CanvasAddon(true);
      window.term.loadAddon(window.addon);
    `);
  });
});
