/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * WebGL device-pixel-ratio (HiDPI) and font-size ("resize") atlas tests.
 *
 * A devicePixelRatio > 1 and font-size changes both change the device cell
 * dimensions, which key the texture atlas cache and force the atlas to be
 * rebuilt. Historically these paths have produced blank/oversized/garbled glyphs
 * (e.g. xtermjs#4728, #5915/#5929). These tests assert glyphs render and stay
 * correct across those transitions.
 *
 * Chromium + SwiftShader only (additive scope; Firefox/WebKit WebGL broken in CI
 * per xtermjs#5854).
 */

import test, { Browser, expect } from '@playwright/test';
import { ITestContext, TerminalProxy, openTerminal } from '../../../test/playwright/TestUtils';
import {
  assertTextureAtlasPresent,
  captureRowSignatures,
  expectSignatureMatches,
  loadWebglStrict,
  waitForRender,
  writeAndWaitForRender
} from '../../../test/playwright/RendererTestUtils';

const REFERENCE_COLS = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Creates a test context whose page uses a specific devicePixelRatio. The shared
 * `createTestContext` helper always uses DPR 1 (`browser.newPage()`), so HiDPI
 * tests build their own context here.
 */
async function createDprContext(browser: Browser, deviceScaleFactor: number): Promise<ITestContext> {
  const context = await browser.newContext({ deviceScaleFactor });
  const page = await context.newPage();
  page.on('pageerror', e => console.error(`[dpr ${deviceScaleFactor}]`, e));
  await page.goto('/test');
  const proxy = new TerminalProxy(page);
  proxy.initPage();
  return {
    browser,
    page,
    termHandle: await page.evaluateHandle('window.term'),
    proxy
  };
}

test.describe('WebGL HiDPI (devicePixelRatio) rendering', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'WebGL atlas tests run on Chromium/SwiftShader only');

  test('initializes the WebGL renderer and scales to device pixels at devicePixelRatio 2', async ({ browser }) => {
    const ctx = await createDprContext(browser, 2);
    try {
      await openTerminal(ctx, { cols: 80, rows: 24 });
      // GPU must be genuinely active at HiDPI (asserted inside loadWebglStrict).
      await loadWebglStrict(ctx);
      await writeAndWaitForRender(ctx, 'A W .');
      await assertTextureAtlasPresent(ctx);

      // The WebGL renderer must render at the device resolution: device cell
      // dimensions should be ~2x the CSS cell dimensions. This catches the
      // DPR-scaling class of bugs (e.g. xtermjs#4728) without relying on
      // screenshotting a WebGL canvas at a non-1 device scale factor.
      const dims = await ctx.proxy.core.renderDimensions;
      expect(dims.device.cell.width).toBeGreaterThan(dims.css.cell.width * 1.8);
      expect(dims.device.cell.width).toBeLessThan(dims.css.cell.width * 2.2);
      expect(dims.device.cell.height).toBeGreaterThan(dims.css.cell.height * 1.8);
      expect(dims.device.cell.height).toBeLessThan(dims.css.cell.height * 2.2);
    } finally {
      await ctx.page.context().close();
    }
  });
});

test.describe('WebGL font-size change atlas integrity', () => {
  let ctx: ITestContext;
  test.skip(({ browserName }) => browserName !== 'chromium', 'WebGL atlas tests run on Chromium/SwiftShader only');

  test.beforeAll(async ({ browser }) => {
    ctx = await createDprContext(browser, 1);
  });
  test.afterAll(async () => await ctx.page.close());

  test.beforeEach(async () => {
    await openTerminal(ctx, { cols: 80, rows: 24, fontSize: 15 });
    await loadWebglStrict(ctx);
  });

  test('glyphs stay correct after cycling font size (atlas rebuilds)', async () => {
    await writeAndWaitForRender(ctx, 'FontRef0123456789');
    const reference = await captureRowSignatures(ctx, 1, REFERENCE_COLS);

    // Changing font size changes device cell dimensions -> the atlas is rebuilt.
    for (const fontSize of [12, 18, 21, 15]) {
      await ctx.proxy.setOption('fontSize', fontSize);
      await writeAndWaitForRender(ctx, '\r\nchurn');
    }

    // Back at the original font size the reference glyphs must be unchanged.
    await ctx.proxy.scrollToTop();
    await waitForRender(ctx);
    const after = await captureRowSignatures(ctx, 1, REFERENCE_COLS);
    for (let i = 0; i < REFERENCE_COLS.length; i++) {
      expectSignatureMatches(after[i], reference[i], 16, `reference glyph at col ${REFERENCE_COLS[i]} corrupted after font-size cycling`);
    }
  });
});
