/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * WebGL "heavy TUI" stress tests: large scrollback + scrolling, alternate-buffer
 * full-screen redraws (like an agent CLI animating output), high-volume
 * rendering and replay of recorded real-world TUI sessions (vim, colored ls).
 *
 * The shared invariant: a known reference row of glyphs, captured in a fresh
 * atlas, must still render identically after the stress workload. If the WebGL
 * texture atlas is corrupted by the workload the reference glyphs change and the
 * test fails. See microsoft/vscode#322756.
 *
 * Chromium + SwiftShader only (additive scope; Firefox/WebKit WebGL are broken
 * in CI per xtermjs#5854).
 */

import { readFileSync } from 'fs';
import test, { expect } from '@playwright/test';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';
import {
  assertTextureAtlasPresent,
  captureRowSignatures,
  expectSignatureMatches,
  loadWebglStrict,
  waitForRender,
  writeAndWaitForRender
} from '../../../test/playwright/RendererTestUtils';
import { generateMixedGlyphBlock, generateSyntheticTuiFrames, generateUniqueGlyphFlood } from '../../../test/playwright/SyntheticTui';

const REFERENCE_COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const REFERENCE_LINE = 'Ref0123456789ABCDEF';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
});
test.afterAll(async () => await ctx.page.close());

test.describe('WebGL heavy TUI / scrolling stress', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'WebGL stress tests run on Chromium/SwiftShader only');

  test.beforeEach(async () => {
    await openTerminal(ctx, { cols: 80, rows: 24, scrollback: 5000 });
    await loadWebglStrict(ctx);
  });

  test('reference glyphs survive heavy scrolling through large scrollback', async () => {
    await writeAndWaitForRender(ctx, `${REFERENCE_LINE}\r\n`);
    const reference = await captureRowSignatures(ctx, 1, REFERENCE_COLS);

    // Push the reference far up into scrollback with thousands of varied glyphs.
    for (let i = 0; i < 20; i++) {
      await ctx.proxy.write(generateMixedGlyphBlock(i + 1, 30, 70));
    }
    await waitForRender(ctx);

    // Scroll around, then back to the very top where the reference lives.
    await ctx.proxy.scrollToTop();
    await waitForRender(ctx);
    await ctx.proxy.scrollPages(3);
    await waitForRender(ctx);
    await ctx.proxy.scrollToTop();
    await waitForRender(ctx);

    const after = await captureRowSignatures(ctx, 1, REFERENCE_COLS);
    for (let i = 0; i < REFERENCE_COLS.length; i++) {
      expectSignatureMatches(after[i], reference[i], 14, `reference glyph at col ${REFERENCE_COLS[i]} corrupted after heavy scrolling`);
    }
  });

  test('alternate-buffer TUI redraws do not corrupt the restored primary buffer', async () => {
    // Reference content lives in the PRIMARY buffer.
    await writeAndWaitForRender(ctx, `${REFERENCE_LINE}`);
    const reference = await captureRowSignatures(ctx, 1, REFERENCE_COLS);

    // Animate a synthetic agent TUI in the alternate buffer.
    const frames = generateSyntheticTuiFrames({ seed: 7, frames: 30, cols: 80, rows: 24, useAltBuffer: true });
    for (const frame of frames) {
      await ctx.proxy.write(frame);
    }
    await waitForRender(ctx);
    await assertTextureAtlasPresent(ctx);

    // Back in the primary buffer the reference glyphs must be intact.
    await ctx.proxy.refresh(0, (await ctx.proxy.rows) - 1);
    await waitForRender(ctx);
    const after = await captureRowSignatures(ctx, 1, REFERENCE_COLS);
    for (let i = 0; i < REFERENCE_COLS.length; i++) {
      expectSignatureMatches(after[i], reference[i], 14, `primary-buffer glyph at col ${REFERENCE_COLS[i]} corrupted by alt-buffer TUI redraws`);
    }
  });

  test('reference glyphs survive a heavy mixed render + unique-glyph churn', async () => {
    // Capture the reference rendering of a known line in a fresh atlas.
    await writeAndWaitForRender(ctx, `${REFERENCE_LINE}`);
    const reference = await captureRowSignatures(ctx, 1, REFERENCE_COLS);

    // High-volume rendering: synthetic TUI frames (which clear/redraw the screen)
    // plus a large unique-glyph flood to churn the atlas, mimicking a long agent
    // CLI session.
    const frames = generateSyntheticTuiFrames({ seed: 3, frames: 40, cols: 80, rows: 24 });
    for (const frame of frames) {
      await ctx.proxy.write(frame);
    }
    await ctx.proxy.write(generateUniqueGlyphFlood(3000, 80));
    await waitForRender(ctx);

    // The synthetic frames erase the screen, so re-render the reference line and
    // assert the (heavily churned) atlas still draws those glyphs correctly.
    await writeAndWaitForRender(ctx, `\x1b[2J\x1b[H${REFERENCE_LINE}`);
    const after = await captureRowSignatures(ctx, 1, REFERENCE_COLS);
    for (let i = 0; i < REFERENCE_COLS.length; i++) {
      expectSignatureMatches(after[i], reference[i], 14, `reference glyph at col ${REFERENCE_COLS[i]} corrupted after heavy render`);
    }
  });

  test('replaying recorded TUI sessions renders without errors or atlas corruption', async () => {
    const pageErrors: string[] = [];
    const onError = (err: Error): void => {
      pageErrors.push(err.message);
    };
    ctx.page.on('pageerror', onError);
    try {
      const fixtures = [
        './test/fixtures/escape_sequence_files/t0090-alt_screen.in',
        './test/fixtures/escape_sequence_files/t0502-bash_ls_color.in',
        './test/fixtures/escape_sequence_files/t0500-bash_long_line.in',
        './test/fixtures/escape_sequence_files/t0504-vim.in'
      ];
      for (const fixture of fixtures) {
        const data = readFileSync(fixture, { encoding: 'latin1' });
        await ctx.proxy.write(data);
      }
      await waitForRender(ctx);
      await assertTextureAtlasPresent(ctx);

      // Re-rendering the final frame must be idempotent (self-consistent): if the
      // atlas were corrupted, a forced redraw would differ from what's shown.
      const before = await captureRowSignatures(ctx, 1, REFERENCE_COLS);
      await ctx.proxy.refresh(0, (await ctx.proxy.rows) - 1);
      await waitForRender(ctx);
      const after = await captureRowSignatures(ctx, 1, REFERENCE_COLS);
      for (let i = 0; i < REFERENCE_COLS.length; i++) {
        expectSignatureMatches(after[i], before[i], 14, `fixture replay frame not self-consistent at col ${REFERENCE_COLS[i]}`);
      }
      expect(pageErrors, `no page errors during fixture replay, got: ${pageErrors.join(', ')}`).toEqual([]);
    } finally {
      ctx.page.off('pageerror', onError);
    }
  });
});
