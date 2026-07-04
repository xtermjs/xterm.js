/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * WebGL glyph + texture-atlas integrity tests.
 *
 * These tests verify that *glyphs* render correctly (not just that cell colors
 * are right) under conditions that stress the texture atlas: multiple atlas
 * pages, page merges and atlas clears. The goal is to catch the "garbled glyph"
 * corruption class reported in microsoft/vscode#322756.
 *
 * Note: CI runs WebGL on Chromium + SwiftShader (software WebGL). That catches
 * renderer/atlas *logic* corruption (stale texture pages, missing model clears),
 * but not GPU-driver-specific glitches. These tests target the former.
 */

import test, { expect } from '@playwright/test';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';
import {
  assertTextureAtlasPresent,
  captureRowSignatures,
  expectSignatureDiffers,
  expectSignatureMatches,
  floodDistinctGlyphs,
  loadWebglStrict,
  resetMaxAtlasPages,
  setMaxAtlasPages,
  waitForRender,
  writeAndWaitForRender
} from '../../../test/playwright/RendererTestUtils';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
});
test.afterAll(async () => await ctx.page.close());

test.describe('WebGL glyph + atlas integrity', () => {
  // Additive scope: only run on Chromium (SwiftShader). Firefox/WebKit WebGL
  // tests are known-broken in CI (xtermjs#5854) and out of scope here.
  test.skip(({ browserName }) => browserName !== 'chromium', 'WebGL atlas tests run on Chromium/SwiftShader only');

  test.beforeEach(async () => {
    // Fresh terminal (and therefore a predictable atlas) per test.
    await openTerminal(ctx, { cols: 80, rows: 24 });
    await loadWebglStrict(ctx);
  });

  // A lowered page cap must not leak into renderers built by later tests.
  test.afterEach(async () => await resetMaxAtlasPages(ctx));

  test('renders distinct, non-blank glyphs', async () => {
    await writeAndWaitForRender(ctx, 'A W .');
    await assertTextureAtlasPresent(ctx);

    const [a, w, dot, blank] = await captureRowSignatures(ctx, 1, [1, 3, 5, 40]);
    // A written cell must differ from an empty cell (glyph actually drawn).
    expectSignatureDiffers(a, blank, 24, 'glyph "A" should not be blank');
    expectSignatureDiffers(w, blank, 24, 'glyph "W" should not be blank');
    // Different glyphs must look different (signature has discriminating power).
    expectSignatureDiffers(a, w, 24, 'glyphs "A" and "W" should render differently');
    expectSignatureDiffers(a, dot, 24, 'glyphs "A" and "." should render differently');
  });

  test('glyphs on the first atlas page stay correct after more pages are allocated', async () => {
    // Reference: a known row of glyphs that lands on the first atlas page.
    await writeAndWaitForRender(ctx, 'REFERENCE_LINE_0123456789\r\n');
    const cols = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const reference = await captureRowSignatures(ctx, 1, cols);

    // Flood thousands of distinct glyphs (one screenful rendered at a time, so
    // they actually rasterize) to force multiple atlas pages.
    const pages = await floodDistinctGlyphs(ctx, 4);
    expect(pages, 'flooding distinct glyphs should allocate more than one atlas page').toBeGreaterThan(1);

    // Bring the reference line back into view and re-check its glyphs.
    await ctx.proxy.scrollToTop();
    await waitForRender(ctx);
    const after = await captureRowSignatures(ctx, 1, cols);
    for (let i = 0; i < cols.length; i++) {
      expectSignatureMatches(after[i], reference[i], 14, `reference glyph at col ${cols[i]} corrupted after multi-page allocation`);
    }
  });

  test('glyphs stay correct after a texture-atlas page merge', async () => {
    // Force merges to happen almost immediately.
    await writeAndWaitForRender(ctx, 'MERGE_REF_LINE_0123456789\r\n');
    await setMaxAtlasPages(ctx, 4);

    const cols = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const reference = await captureRowSignatures(ctx, 1, cols);

    // Flood distinct glyphs (rendered per screenful) to exceed the tiny page cap
    // and trigger merges.
    const pages = await floodDistinctGlyphs(ctx, 12);
    expect(pages, 'flood should have allocated multiple atlas pages (and merged)').toBeGreaterThan(1);

    await ctx.proxy.scrollToTop();
    await waitForRender(ctx);
    const after = await captureRowSignatures(ctx, 1, cols);
    for (let i = 0; i < cols.length; i++) {
      expectSignatureMatches(after[i], reference[i], 14, `reference glyph at col ${cols[i]} corrupted after atlas page merge`);
    }
  });

  test('glyphs re-render correctly after clearTextureAtlas() on the same terminal', async () => {
    await writeAndWaitForRender(ctx, 'CLEAR_REF_LINE_0123456789');
    const cols = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const reference = await captureRowSignatures(ctx, 1, cols);

    await ctx.proxy.clearTextureAtlas();
    // Force a full redraw so glyphs are re-rasterized into the cleared atlas.
    await ctx.proxy.refresh(0, (await ctx.proxy.rows) - 1);
    await waitForRender(ctx);

    const after = await captureRowSignatures(ctx, 1, cols);
    for (let i = 0; i < cols.length; i++) {
      expectSignatureMatches(after[i], reference[i], 14, `glyph at col ${cols[i]} corrupted after clearTextureAtlas()`);
    }
  });
});
