/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test from '@playwright/test';
import { ISharedRendererTestContext, injectSharedRendererTests, injectSharedRendererTestsStandalone } from '../../../test/playwright/SharedRendererTests';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';
import { platform } from 'os';

let ctx: ITestContext;
let shouldSkip = false;
const ctxWrapper: ISharedRendererTestContext = { value: undefined } as any;

test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx);
  shouldSkip = !(await ctx.page.evaluate(async () => {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter?: () => Promise<unknown> } }).gpu;
    if (!gpu?.requestAdapter) {
      return false;
    }
    const adapter = await gpu.requestAdapter();
    return !!adapter;
  }));
  if (shouldSkip) {
    return;
  }
  ctxWrapper.value = ctx;
  await ctx.page.evaluate(`
    window.addon = new window.WebgpuAddon(true);
    window.term.loadAddon(window.addon);
  `);
});

test.afterAll(async () => await ctx.page.close());

test.describe('WebGPU Renderer Integration Tests', async () => {
  test.beforeEach(() => {
    if (shouldSkip) {
      test.skip(true, 'WebGPU not supported');
    }
  });

  // HACK: webgpu is not supported in headless firefox on Linux
  if (platform() === 'linux') {
    test.skip(({ browserName }) => browserName === 'firefox');
  }

  injectSharedRendererTests(ctxWrapper);
  injectSharedRendererTestsStandalone(ctxWrapper, async () => {
    await ctx.page.evaluate(`
      window.addon = new window.WebgpuAddon(true);
      window.term.loadAddon(window.addon);
    `);
  });
});
