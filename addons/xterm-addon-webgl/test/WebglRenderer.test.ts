/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test from '@playwright/test';
import { ISharedRendererTestContext, injectSharedRendererTests } from '../../../out-test/playwright/SharedRendererTests';
import { ITestContext, createTestContext, openTerminal } from '../../../out-test/playwright/TestUtils';

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
  test.skip(({ browserName, userAgent}) => (userAgent?.includes('Linux') ?? false) && browserName === 'firefox');

  injectSharedRendererTests(ctxWrapper);
});
