/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test from '@playwright/test';
import { ISharedRendererTestContext, injectSharedRendererTests } from '../../../out-test/playwright/SharedRendererTests';
import { ITestContext, createTestContext, openTerminal } from '../../../out-test/playwright/TestUtils';
import { platform } from 'os';

let ctx: ITestContext;
const ctxWrapper: ISharedRendererTestContext = {
  value: undefined,
  skipSelectionTests: true
} as any;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx);
  ctxWrapper.value = ctx;
  await ctx.page.evaluate(`
    window.addon = new CanvasAddon(true);
    window.term.loadAddon(window.addon);
  `);
});
test.afterAll(async () => await ctx.page.close());

test.describe('Canvas Renderer Integration Tests', async () => {
  injectSharedRendererTests(ctxWrapper);
});
