/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Single-terminal WebGL atlas stress: try to reproduce the "garbled glyph"
 * corruption from microsoft/vscode#322756 in ONE terminal (no shared atlas),
 * via heavy unique-glyph churn that forces atlas page merges, both with content
 * pinned on screen (TUI-style) and mid-scroll. Chromium/SwiftShader only.
 */

import test, { expect } from '@playwright/test';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';
import {
  captureRowSignatures,
  expectSignatureMatches,
  floodDistinctGlyphs,
  getAtlasPageCount,
  loadWebglStrict,
  setMaxAtlasPages,
  waitForRender,
  writeAndWaitForRender
} from '../../../test/playwright/RendererTestUtils';
import { generateUniqueGlyphFlood } from '../../../test/playwright/SyntheticTui';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
});
test.afterAll(async () => await ctx.page.close());

test.describe('WebGL single-terminal heavy render + merge', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'WebGL atlas tests run on Chromium/SwiftShader only');
  test.describe.configure({ timeout: 30000 });

  test.beforeEach(async () => {
    await openTerminal(ctx, { cols: 80, rows: 24, scrollback: 5000 });
    await loadWebglStrict(ctx);
  });

  test('heavy merge churn must not crash the GlyphRenderer (xtermjs#322756)', async () => {
    // EXPECTED RED: with a small page cap, atlas merges shrink the pages array
    // while GlyphRenderer.render still indexes the old page count -> throws
    // "Cannot read properties of undefined (reading 'version')" and the terminal
    // garbles. Capture the crash via pageerror.
    const errors: string[] = [];
    const onError = (e: Error): void => { errors.push(e.message); };
    ctx.page.on('pageerror', onError);
    try {
      await setMaxAtlasPages(ctx, 4);
      await floodDistinctGlyphs(ctx, 10);
      // Force a GPU read (screenshot) mid-churn so a render lands during/after a
      // merge, then churn more — this reliably exposes the version crash.
      await captureRowSignatures(ctx, 1, [1, 2, 3]);
      const pages = await floodDistinctGlyphs(ctx, 10);
      expect(pages, 'should have allocated/merged pages').toBeGreaterThan(1);
      await ctx.page.waitForTimeout(300);
      expect(errors, `renderer crashed during atlas merges: ${errors[0] ?? ''}`).toEqual([]);
    } finally {
      ctx.page.off('pageerror', onError);
    }
  });

  test('pinned header stays correct while body churns many pages', async () => {
    const cols = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    await writeAndWaitForRender(ctx, 'HEADER_REF_0123456789');
    const reference = await captureRowSignatures(ctx, 1, cols);

    // Body churns unique glyphs (forces merges) while header line stays on screen.
    const pages = await floodDistinctGlyphs(ctx, 8);
    expect(pages, 'should have allocated/merged pages').toBeGreaterThan(1);

    await ctx.proxy.scrollToTop();
    await waitForRender(ctx);
    const after = await captureRowSignatures(ctx, 1, cols);
    for (let i = 0; i < cols.length; i++) {
      expectSignatureMatches(after[i], reference[i], 14, `header glyph col ${cols[i]} corrupted by single-terminal merges`);
    }
  });

  test('visible rows match content while scrolling (no merge)', async () => {
    // Big scrollback of distinct glyphs across multiple pages (no tiny page cap,
    // so no merge), then scroll up/down repeatedly.
    for (let c = 0; c < 8; c++) {
      await writeAndWaitForRender(ctx, generateUniqueGlyphFlood(24 * 40, 80, c * 24 * 40));
    }
    expect(await getAtlasPageCount(ctx)).toBeGreaterThan(1);

    await ctx.proxy.scrollToTop();
    await waitForRender(ctx);
    const top = await captureRowSignatures(ctx, 1, [1, 2, 3, 4, 5]);
    await ctx.proxy.scrollToBottom();
    await ctx.proxy.scrollToTop();
    await waitForRender(ctx);
    const topAgain = await captureRowSignatures(ctx, 1, [1, 2, 3, 4, 5]);
    for (let i = 0; i < top.length; i++) {
      expectSignatureMatches(topAgain[i], top[i], 14, `row1 col${i + 1} changed after scroll round-trip`);
    }
  });
});
