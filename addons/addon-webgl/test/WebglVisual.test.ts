/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 * Produces BEFORE/AFTER screenshots of a single terminal under merge-heavy
 * churn for manual inspection (before.png / after.png, mono-*.png). On current
 * master the single-terminal merge path is healthy, so the pinned header lines
 * are expected to remain readable in the "after" images; a corrupted header in
 * these captures indicates a renderer regression. Note the mono "after" body is
 * SUPPOSED to look like glyph soup — that is the mixed box-drawing/braille
 * payload rendered faithfully, not corruption.
 */
import test from '@playwright/test';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';
import { loadWebglStrict, setMaxAtlasPages, writeAndWaitForRender } from '../../../test/playwright/RendererTestUtils';
import { generateColoredAsciiFlood, generateMixedGlyphBlock } from '../../../test/playwright/SyntheticTui';

test.describe('visual #322756', () => {
  test.skip(({ browserName }) => browserName !== 'chromium');
  test.describe.configure({ timeout: 60000 });

  test('capture before/after pinned header under merge churn', async ({ browser }) => {
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

  // Issue-like framing: prefill realistic CLI text, force merges with a mixed
  // glyph payload, then rewrite the top lines clean. The rewritten header lines
  // must stay readable in mono-after.png.
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
    // Overflow the atlas (cap=4) so pages MERGE while most rows keep their cells,
    // then rewrite a few lines clean (like scroll/redraw).
    for (let c = 0; c < 12; c++) {
      let frame = '\x1b[3;1H';
      frame += generateMixedGlyphBlock(c + 1, 18, 78);
      await writeAndWaitForRender(ctx, frame);
    }
    await writeAndWaitForRender(ctx, '\x1b[1;1H\x1b[2K $ Shell grep installed Copilot CLI binary - 53 lines\r\n\x1b[2K Thought for 1s');
    await screen.screenshot({ path: 'out-esbuild-test/playwright/mono-after.png' });
    await ctx.page.close();
  });
});
