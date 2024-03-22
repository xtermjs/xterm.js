/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { test } from '@playwright/test';
import { ITestContext, createTestContext, openTerminal } from './TestUtils';
import { ISharedRendererTestContext, injectSharedRendererTestsStandalone, injectSharedRendererTests } from './SharedRendererTests';

let ctx: ITestContext;
const ctxWrapper: ISharedRendererTestContext = {
  value: undefined,
  skipDomExceptions: true
} as any;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  ctxWrapper.value = ctx;
  await openTerminal(ctx);
});
test.afterAll(async () => await ctx.page.close());

test.describe('DOM Renderer Integration Tests', () => {
  injectSharedRendererTests(ctxWrapper);
  injectSharedRendererTestsStandalone(ctxWrapper, () => {});
});
