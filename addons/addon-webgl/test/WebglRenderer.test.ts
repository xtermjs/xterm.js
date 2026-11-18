/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test, { expect } from '@playwright/test';
import { ISharedRendererTestContext, injectSharedRendererTests, injectSharedRendererTestsStandalone } from '../../../test/playwright/SharedRendererTests';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';
import { platform } from 'os';

let ctx: ITestContext;
const ctxWrapper: ISharedRendererTestContext = { value: undefined } as any;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx);
  ctxWrapper.value = ctx;
  await ctx.page.evaluate(`
    try {
      window.addon = new window.WebglAddon(true);
      window.term.loadAddon(window.addon);
    } catch (e) {}
  `);
});
test.afterAll(async () => await ctx.page.close());

test.describe('WebGL Renderer Integration Tests', async () => {
  // HACK: webgl2 is often not supported in headless firefox on Linux
  // https://github.com/microsoft/playwright/issues/11566
  // also disable safari due to #5852
  if (platform() === 'linux') {
    test.skip(({ browserName }) => browserName === 'firefox' || browserName === 'webkit');
  }

  injectSharedRendererTests(ctxWrapper);
  injectSharedRendererTestsStandalone(ctxWrapper, async () => {
    await ctx.page.evaluate(`
      try {
        window.addon = new window.WebglAddon(true);
        window.term.loadAddon(window.addon);
      } catch (e) {}
    `);
  });

  test('rounds fractional character dimensions to the nearest device pixel', async () => {
    const testContext = await createTestContext(ctx.browser);
    try {
      await openTerminal(testContext);
      await testContext.page.evaluate(`
        window.addon = new window.WebglAddon(true);
        window.term.loadAddon(window.addon);
      `);
      const dimensions = await testContext.page.evaluate(() => {
        const renderer = (window as any).addon._renderer;
        const charSizeService = (window as any).term._core._charSizeService;
        const originalDevicePixelRatio = renderer._devicePixelRatio;
        const originalWidth = charSizeService.width;
        const originalHeight = charSizeService.height;
        try {
          // Use a fixed DPR and fractional measurements to verify nearest-pixel rounding.
          renderer._devicePixelRatio = 1;
          charSizeService.width = 6.5;
          charSizeService.height = 10.4;
          renderer._updateDimensions();
          return {
            width: renderer.dimensions.device.char.width,
            height: renderer.dimensions.device.char.height
          };
        } finally {
          renderer._devicePixelRatio = originalDevicePixelRatio;
          charSizeService.width = originalWidth;
          charSizeService.height = originalHeight;
          renderer._updateDimensions();
        }
      });
      expect(dimensions).toEqual({ width: 7, height: 10 });
    } finally {
      await testContext.page.close();
    }
  });
});
