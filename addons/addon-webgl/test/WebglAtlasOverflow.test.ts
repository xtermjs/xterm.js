/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Reproduces the single-terminal WebGL crash/garble when the texture atlas
 * page count overflows TextureAtlas.maxAtlasPages (vscode#322756 class).
 *
 * GlyphRenderer sizes its GL texture array and fragment-shader sampler array
 * to exactly maxAtlasPages at construction time, but TextureAtlas._createNewPage
 * pushes past that cap whenever a 4-page same-size merge is impossible (e.g. a
 * heterogeneous mix like 1024+512+512+512). The next GlyphRenderer.render then
 * throws "Cannot read properties of undefined (reading 'version')" and cells
 * reference sampler indexes the shader does not have, freezing/garbling the
 * terminal. Long heavy-CLI sessions hit this in production; the test makes it
 * fast by building the renderer with a small cap (the same code path as the
 * production 8/16/32 values).
 *
 * Chromium only (additive scope; Firefox/WebKit WebGL broken in CI, xtermjs#5854).
 */
import test, { expect } from '@playwright/test';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';
import {
  captureRowSignatures,
  expectSignatureMatches,
  loadWebglStrict,
  setMaxAtlasPages,
  writeAndWaitForRender
} from '../../../test/playwright/RendererTestUtils';
import { generateUniqueGlyphFlood } from '../../../test/playwright/SyntheticTui';

const HEADER = ' OVERFLOW_REF_0123456789';
const HEADER_COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

test.describe('atlas page overflow (#322756 class)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium');
  test.describe.configure({ timeout: 60000 });

  test('renderer survives the atlas exceeding maxAtlasPages-sized textures', async ({ browser }) => {
    const ctx: ITestContext = await createTestContext(browser);
    const errors: string[] = [];
    const onError = (e: Error): void => { errors.push(e.message); };
    ctx.page.on('pageerror', onError);
    try {
      // Bootstrap: create a throwaway WebGL terminal so the TextureAtlas class
      // statics exist, then lower the page cap. openTerminal() disposes the old
      // terminal (and its atlas), so the next WebGL renderer is CONSTRUCTED
      // with the small cap: its GL texture array and fragment-shader sampler
      // array have exactly 4 entries, faithfully mirroring production where
      // they always equal maxAtlasPages.
      await openTerminal(ctx, { cols: 80, rows: 24 });
      await loadWebglStrict(ctx);
      await setMaxAtlasPages(ctx, 4);
      await openTerminal(ctx, { cols: 80, rows: 24 });
      await loadWebglStrict(ctx);

      const atlasTexturesLength = await ctx.page.evaluate(() =>
        (window as any).term._core._renderService._renderer.value._glyphRenderer.value._atlasTextures.length);
      expect(atlasTexturesLength, 'renderer must be built with the lowered page cap').toBe(4);

      // Pinned header in the alt buffer; body churns distinct CJK glyphs below
      // (cursor-positioned, no trailing linefeed on the bottom row -> no scroll).
      await writeAndWaitForRender(ctx, `\x1b[?1049h\x1b[H${HEADER}`);
      const reference = await captureRowSignatures(ctx, 1, HEADER_COLS);
      await ctx.page.locator('#terminal-container .xterm-screen').screenshot({ path: 'out-esbuild-test/playwright/overflow-before.png' });

      const glyphsPerChunk = 23 * 40 - 1;
      for (let c = 0; c < 16; c++) {
        // Plain write + short wait instead of waiting for a render event: once
        // the overflow crash fires, render events stop arriving and a render
        // wait would hang the test instead of failing it.
        await ctx.proxy.write('\x1b[2;1H' + generateUniqueGlyphFlood(glyphsPerChunk, 80, c * glyphsPerChunk));
        await ctx.page.waitForTimeout(50);
      }
      await ctx.page.waitForTimeout(300);
      await ctx.page.locator('#terminal-container .xterm-screen').screenshot({ path: 'out-esbuild-test/playwright/overflow-after.png' });

      const state = await ctx.page.evaluate(() => {
        const renderer = (window as any).term._core._renderService._renderer.value;
        return {
          pages: renderer._charAtlas.pages.length,
          atlasTextures: renderer._glyphRenderer.value._atlasTextures.length
        };
      });
      console.error('[overflow] pages=', state.pages, 'atlasTextures=', state.atlasTextures, 'pageErrors=', errors.length, errors[0] ?? '');

      // Contract: the page count must never exceed the renderer's texture and
      // sampler capacity, and rendering must never throw.
      expect(errors, `GlyphRenderer must not crash when the atlas is saturated: ${errors[0] ?? ''}`).toEqual([]);
      expect(state.pages, 'atlas page count must stay within the renderer texture capacity').toBeLessThanOrEqual(state.atlasTextures);

      // The untouched header must still render correctly after the churn.
      const after = await captureRowSignatures(ctx, 1, HEADER_COLS);
      for (let i = 0; i < HEADER_COLS.length; i++) {
        expectSignatureMatches(after[i], reference[i], 14, `header col ${HEADER_COLS[i]} corrupted after atlas saturation`);
      }
    } finally {
      ctx.page.off('pageerror', onError);
      // Restore the default so a lowered cap can never leak into other tests.
      await ctx.page.evaluate(() => {
        const renderer = (window as any).term._core._renderService._renderer.value;
        const atlas = renderer?._charAtlas;
        if (atlas) {
          (atlas.constructor as any).maxAtlasPages = undefined;
        }
      }).catch(() => { /* page may already be unusable after a crash */ });
      await ctx.page.close();
    }
  });
});
