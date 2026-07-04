/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Single-terminal guard for the vscode#322756 "garbled glyph" class: a pinned
 * alt-buffer header must render identically while the body churns enough
 * distinct colored glyphs to force texture-atlas page merges.
 *
 * Note this scenario is GREEN on current master: the single-terminal mid-frame
 * merge race was fixed upstream (merge-retry loop in WebglRenderer.renderRows +
 * globally monotonic AtlasPage versions). The test asserts the buffer content
 * first so a content bug (e.g. an accidental scroll from the churn stream) can
 * never masquerade as renderer corruption.
 */
import test, { expect } from '@playwright/test';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';
import { captureRowSignatures, expectSignatureMatches, getAtlasPageCount, loadWebglStrict, resetMaxAtlasPages, setMaxAtlasPages, writeAndWaitForRender } from '../../../test/playwright/RendererTestUtils';
import { generateColoredAsciiFlood } from '../../../test/playwright/SyntheticTui';

const HEADER = ' HEADER_REF_0123456789';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => { ctx = await createTestContext(browser); });
test.afterAll(async () => await ctx.page.close());

test.describe('single-terminal merge integrity (#322756 class)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium');
  test.describe.configure({ timeout: 60000 });

  // A lowered page cap must not leak into renderers built by later tests.
  test.afterEach(async () => await resetMaxAtlasPages(ctx));

  test('pinned header renders identically across 30 merge-heavy body redraws', async () => {
    await openTerminal(ctx, { cols: 80, rows: 24 });
    await loadWebglStrict(ctx);
    await setMaxAtlasPages(ctx, 4);
    const cols = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    // Alt-buffer TUI: pinned header on row 1, body churns below (like Copilot CLI).
    await writeAndWaitForRender(ctx, `\x1b[?1049h\x1b[H${HEADER}`);
    const ref = await captureRowSignatures(ctx, 1, cols);
    let maxDiff = 0;
    for (let c = 0; c < 30; c++) {
      // Redraw body rows 2..24 with unique glyphs; the header row is never touched.
      let frame = '\x1b[2;1H';
      frame += generateColoredAsciiFlood(23 * 78, c * 23 * 78);
      await writeAndWaitForRender(ctx, frame);
      const now = await captureRowSignatures(ctx, 1, cols); // forces GPU sync
      for (let i = 0; i < cols.length; i++) {
        const d = Math.max(...ref[i].map((v, k) => Math.abs(v - now[i][k])));
        maxDiff = Math.max(maxDiff, d);
      }
    }
    console.error('[repro] pages=', await getAtlasPageCount(ctx), 'headerMaxDiff=', maxDiff);

    // Guard: the header must still be in the buffer. If this fails the churn
    // stream scrolled the screen and any pixel diff is meaningless.
    const row1Text = await ctx.page.evaluate(() => (window as any).term.buffer.active.getLine(0)?.translateToString(true));
    expect(row1Text, 'churn stream must not scroll the pinned header out of the buffer').toBe(HEADER);

    const after = await captureRowSignatures(ctx, 1, cols);
    for (let i = 0; i < cols.length; i++) {
      expectSignatureMatches(after[i], ref[i], 14, `header col ${cols[i]} garbled`);
    }
  });
});
