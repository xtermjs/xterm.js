/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 * EXPERIMENT: try to reproduce vscode#322756 garbled single-terminal render.
 */
import test, { expect } from '@playwright/test';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';
import { captureRowSignatures, expectSignatureMatches, getAtlasPageCount, loadWebglStrict, setMaxAtlasPages, waitForRender, writeAndWaitForRender } from '../../../test/playwright/RendererTestUtils';
import { generateColoredAsciiFlood } from '../../../test/playwright/SyntheticTui';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => { ctx = await createTestContext(browser); });
test.afterAll(async () => await ctx.page.close());

test.describe('repro #322756', () => {
  test.skip(({ browserName }) => browserName !== 'chromium');
  test.describe.configure({ timeout: 60000 });

  test('header survives merge race with per-chunk sync', async () => {
    await openTerminal(ctx, { cols: 80, rows: 24 });
    await loadWebglStrict(ctx);
    await setMaxAtlasPages(ctx, 4);
    const cols = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    // Alt-buffer TUI: pinned header on row 1, body churns below (like Copilot CLI).
    await writeAndWaitForRender(ctx, '\x1b[?1049h\x1b[H HEADER_REF_0123456789');
    const ref = await captureRowSignatures(ctx, 1, cols);
    let maxDiff = 0;
    for (let c = 0; c < 30; c++) {
      // redraw header + churn body rows 2..24 with unique glyphs, header stays put
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
    const after = await captureRowSignatures(ctx, 1, cols);
    for (let i = 0; i < cols.length; i++) {
      expectSignatureMatches(after[i], ref[i], 14, `header col ${cols[i]} garbled`);
    }
  });
});
