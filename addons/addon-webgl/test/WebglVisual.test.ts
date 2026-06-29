/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 * Produces a strong BEFORE/AFTER visual of single-terminal #322756 garble:
 * a plain white header that should stay readable, body churns colored text
 * forcing atlas merges. Saves before.png / after.png for manual viewing.
 */
import test from '@playwright/test';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';
import { loadWebglStrict, setMaxAtlasPages, waitForRender, writeAndWaitForRender } from '../../../test/playwright/RendererTestUtils';
import { generateColoredAsciiFlood, generateMixedGlyphBlock } from '../../../test/playwright/SyntheticTui';

test.describe('visual #322756', () => {
  test.skip(({ browserName }) => browserName !== 'chromium');
  test.describe.configure({ timeout: 60000 });

  test('capture before/after header garble', async ({ browser }) => {
    const ctx: ITestContext = await createTestContext(browser);
    await openTerminal(ctx, { cols: 80, rows: 24 });
    await loadWebglStrict(ctx);
    await setMaxAtlasPages(ctx, 4);
    const screen = ctx.page.locator('#terminal-container .xterm-screen');
    // Header + readable sentences pinned at top; body region churns below.
    await writeAndWaitForRender(ctx, '\x1b[?1049h\x1b[H\x1b[97mHEADER: THE QUICK BROWN FOX 0123456789\r\nSTATUS: this line should stay readable\r\n');
    await screen.screenshot({ path: 'out-esbuild-test/playwright/before.png' });
    for (let c = 0; c < 30; c++) {
      await writeAndWaitForRender(ctx, '\x1b[5;1H' + generateColoredAsciiFlood(20 * 78, c * 20 * 78));
    }
    await screen.screenshot({ path: 'out-esbuild-test/playwright/after.png' });
    await ctx.page.close();
  });

  // Closer to vscode#322756: prefill realistic CLI text, trigger ONE merge,
  // rewrite a couple lines -> some lines intact, most garble sparsely on dark bg.
  test('capture mono before/after (issue-like)', async ({ browser }) => {
    const ctx: ITestContext = await createTestContext(browser);
    await openTerminal(ctx, { cols: 80, rows: 24 });
    await loadWebglStrict(ctx);
    await setMaxAtlasPages(ctx, 4);
    const screen = ctx.page.locator('#terminal-container .xterm-screen');
    // Prefill a screenful of normal-looking CLI output (all rendered fine).
    await writeAndWaitForRender(ctx, '\x1b[?1049h\x1b[2J\x1b[H');
    let pre = '';
    for (let r = 0; r < 22; r++) {
      pre += ` $ Shell inspect bundled MCP JSON schema for type enum values ${r} lines\r\n`;
    }
    await writeAndWaitForRender(ctx, pre);
    await screen.screenshot({ path: 'out-esbuild-test/playwright/mono-before.png' });
    // Overflow the atlas (cap=4) so pages MERGE; churn most rows so their cells
    // hold stale slots, then rewrite a few lines clean (like scroll/redraw).
    for (let c = 0; c < 12; c++) {
      let frame = '\x1b[3;1H';
      frame += generateMixedGlyphBlock(c + 1, 18, 78);
      await writeAndWaitForRender(ctx, frame);
    }
    await writeAndWaitForRender(ctx, '\x1b[1;1H $ Shell grep installed Copilot CLI binary - 53 lines\r\n Thought for 1s');
    await screen.screenshot({ path: 'out-esbuild-test/playwright/mono-after.png' });
    await ctx.page.close();
  });
});
