/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Reproduces the vscode#322756 "garbled glyph" corruption across terminals that
 * SHARE a texture atlas (CharAtlasCache hands the same TextureAtlas to every
 * terminal with an equal config — in VS Code that is every integrated terminal
 * using the same font settings, including task/background terminals).
 *
 * Mechanism: when the atlas merges pages it raises a consume-once
 * "clear model" flag (TextureAtlas.beginFrame). Only the FIRST terminal to
 * render consumes it and rebuilds its vertex model; every other terminal keeps
 * stale texture-page indexes/coordinates in its vertex buffer and draws wrong
 * glyphs on its next partial render, even though its buffer content is intact.
 *
 * The DOM-renderer control shows the corruption is exclusive to the GPU path
 * (`terminal.integrated.gpuAcceleration off` cannot reproduce it: the DOM
 * renderer has no texture atlas).
 *
 * Chromium only (additive scope; Firefox/WebKit WebGL broken in CI, xtermjs#5854).
 */
import test, { expect } from '@playwright/test';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';
import {
  captureRowSignatures,
  expectSignatureMatches,
  getAtlasPageCount,
  loadWebglStrict,
  setMaxAtlasPages,
  writeAndWaitForRender
} from '../../../test/playwright/RendererTestUtils';
import { generateColoredAsciiFlood } from '../../../test/playwright/SyntheticTui';

const HEADER = ' HEADER_REF_0123456789';
const HEADER_COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const TERM_B_SELECTOR = '#terminal-container-b .xterm-screen';

/**
 * Creates a second terminal ("termB") on the test page with the given options
 * and optionally loads the WebGL addon on it. Identical rendering options mean
 * CharAtlasCache gives it the same atlas instance as `window.term`.
 */
async function createTerminalB(ctx: ITestContext, options: { useWebgl: boolean }): Promise<void> {
  await ctx.page.evaluate(async (useWebgl) => {
    const w = window as any;
    w.termB?.dispose();
    document.getElementById('terminal-container-b')?.remove();
    const el = document.createElement('div');
    el.id = 'terminal-container-b';
    document.body.appendChild(el);
    w.termB = new w.Terminal({ cols: 80, rows: 24, allowProposedApi: true });
    w.termB.open(el);
    if (useWebgl) {
      w.addonB = new w.WebglAddon({ preserveDrawingBuffer: true });
      w.termB.loadAddon(w.addonB);
    }
  }, options.useWebgl);
}

/** Writes data to termB and resolves after its next render event. */
async function writeToBAndWaitForRender(ctx: ITestContext, data: string): Promise<void> {
  await ctx.page.evaluate(d => new Promise<void>(resolve => {
    const termB = (window as any).termB;
    const disposable = termB.onRender(() => {
      disposable.dispose();
      resolve();
    });
    termB.write(d);
  }), data);
}

async function getTermBRow1Text(ctx: ITestContext): Promise<string | undefined> {
  return ctx.page.evaluate(() => (window as any).termB.buffer.active.getLine(0)?.translateToString(true));
}

test.describe('shared-atlas garble across terminals (#322756)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium');
  test.describe.configure({ timeout: 60000 });

  test('terminal B keeps rendering its header correctly while terminal A forces atlas merges', async ({ browser }) => {
    const ctx: ITestContext = await createTestContext(browser);
    try {
      await openTerminal(ctx, { cols: 80, rows: 24 });
      await loadWebglStrict(ctx);
      await createTerminalB(ctx, { useWebgl: true });

      // Both terminals must be using the same atlas instance for this test to
      // mean anything.
      const atlasShared = await ctx.page.evaluate(() => {
        const w = window as any;
        const atlasA = w.term._core._renderService._renderer.value._charAtlas;
        const atlasB = w.termB._core._renderService._renderer.value._charAtlas;
        return !!atlasA && atlasA === atlasB;
      });
      expect(atlasShared, 'terminals with equal configs should share one texture atlas').toBe(true);

      // Lower the cap AFTER both renderers exist so their shaders/texture
      // arrays keep the original size (this test targets stale vertex data,
      // not the page-overflow crash).
      await setMaxAtlasPages(ctx, 4);

      // Render B's header pre-merge and capture its reference pixels.
      await writeToBAndWaitForRender(ctx, HEADER);
      await ctx.page.locator(TERM_B_SELECTOR).screenshot({ path: 'out-esbuild-test/playwright/termB-before.png' });
      const reference = await captureRowSignatures(ctx, 1, HEADER_COLS, { selector: TERM_B_SELECTOR, termGlobal: 'termB' });

      // Churn terminal A with distinct colored glyphs to force page merges in
      // the SHARED atlas. A repairs itself (it consumes the clear-model flag);
      // B is never told.
      for (let c = 0; c < 10; c++) {
        await writeAndWaitForRender(ctx, '\x1b[2;1H' + generateColoredAsciiFlood(23 * 78, c * 23 * 78));
      }
      const pages = await getAtlasPageCount(ctx);
      expect(pages, 'churn should have exercised multiple atlas pages').toBeGreaterThan(1);

      // A tiny unrelated update to B's LAST row triggers a partial render in B.
      // B's header row is untouched; with a healthy renderer its pixels must
      // not change.
      await writeToBAndWaitForRender(ctx, '\x1b[24;1Hx');
      await ctx.page.locator(TERM_B_SELECTOR).screenshot({ path: 'out-esbuild-test/playwright/termB-after.png' });

      // Guard: B's buffer content is intact, so any pixel change is renderer
      // corruption by construction.
      expect(await getTermBRow1Text(ctx), 'terminal B buffer must still contain the header').toBe(HEADER);

      const after = await captureRowSignatures(ctx, 1, HEADER_COLS, { selector: TERM_B_SELECTOR, termGlobal: 'termB' });
      for (let i = 0; i < HEADER_COLS.length; i++) {
        expectSignatureMatches(after[i], reference[i], 14, `terminal B header col ${HEADER_COLS[i]} garbled by terminal A's atlas merges`);
      }
    } finally {
      await ctx.page.close();
    }
  });

  test('DOM renderer control: same workload cannot garble terminal B (no atlas without GPU acceleration)', async ({ browser }) => {
    const ctx: ITestContext = await createTestContext(browser);
    try {
      // No WebGL addon on either terminal -> DOM renderer -> no texture atlas.
      await openTerminal(ctx, { cols: 80, rows: 24 });
      await createTerminalB(ctx, { useWebgl: false });

      await writeToBAndWaitForRender(ctx, HEADER);
      const reference = await captureRowSignatures(ctx, 1, HEADER_COLS, { selector: TERM_B_SELECTOR, termGlobal: 'termB' });

      for (let c = 0; c < 10; c++) {
        await writeAndWaitForRender(ctx, '\x1b[2;1H' + generateColoredAsciiFlood(23 * 78, c * 23 * 78));
      }
      await writeToBAndWaitForRender(ctx, '\x1b[24;1Hx');

      expect(await getTermBRow1Text(ctx), 'terminal B buffer must still contain the header').toBe(HEADER);
      const after = await captureRowSignatures(ctx, 1, HEADER_COLS, { selector: TERM_B_SELECTOR, termGlobal: 'termB' });
      for (let i = 0; i < HEADER_COLS.length; i++) {
        expectSignatureMatches(after[i], reference[i], 14, `DOM-rendered terminal B header col ${HEADER_COLS[i]} unexpectedly changed`);
      }
    } finally {
      await ctx.page.close();
    }
  });
});
