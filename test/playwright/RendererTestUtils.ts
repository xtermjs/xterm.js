/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IImage32, decodePng } from '@lunapaint/png-codec';
import { expect } from '@playwright/test';
import { ITestContext } from './TestUtils';
import { generateUniqueGlyphFlood } from './SyntheticTui';

/**
 * A decoded screenshot of a terminal's render surface together with its grid
 * dimensions, used to sample per-cell pixels.
 */
export interface IRendererFrame {
  cols: number;
  rows: number;
  decoded: IImage32;
}

/**
 * A coarse, downsampled fingerprint of a single cell's rendered pixels. It is an
 * `grid * grid` array of averaged `[r, g, b, a]` sub-cell colors, flattened.
 *
 * Averaging makes the signature tolerant to sub-pixel antialiasing differences
 * (which vary slightly even under SwiftShader) while still changing massively
 * when a glyph is garbled, blank, or drawn from the wrong texture atlas page.
 */
export type CellSignature = number[];

const DEFAULT_GRID = 4;
const DEFAULT_SCREEN_SELECTOR = '#terminal-container .xterm-screen';

/**
 * Captures a fresh screenshot of a terminal render surface and decodes it.
 *
 * Unlike the cached helper in `SharedRendererTests.ts`, this always takes a new
 * screenshot and accepts a `selector` so multiple terminals (each in their own
 * container) can be sampled independently in the same test.
 * @param ctx The test context.
 * @param selector CSS selector for the `.xterm-screen` element to capture.
 * @param termGlobal Name of the `window` terminal global to read grid dimensions
 * from (default `'term'`); use e.g. `'termB'` for multi-terminal tests.
 */
export async function captureFrame(
  ctx: ITestContext,
  selector: string = DEFAULT_SCREEN_SELECTOR,
  termGlobal: string = 'term'
): Promise<IRendererFrame> {
  const screenshotOptions = process.env.DEBUG
    ? { path: `out-esbuild-test/playwright/screenshot-${termGlobal}.png` }
    : undefined;
  const buffer = await ctx.page.locator(selector).screenshot(screenshotOptions);
  const grid = await ctx.page.evaluate((name) => {
    const term = (window as any)[name];
    return { cols: term.cols as number, rows: term.rows as number };
  }, termGlobal);
  return {
    cols: grid.cols,
    rows: grid.rows,
    decoded: (await decodePng(new Uint8Array(buffer), { force32: true })).image
  };
}

/**
 * Computes the coarse pixel signature of a single 1-based cell from a frame.
 * @param frame The decoded frame to sample.
 * @param col The 1-based column.
 * @param row The 1-based row.
 * @param grid The sub-cell resolution per axis (default 4 -> 16 sub-cells).
 */
export function cellSignature(frame: IRendererFrame, col: number, row: number, grid: number = DEFAULT_GRID): CellSignature {
  const data = frame.decoded.data;
  const imageWidth = frame.decoded.width;
  const cellWidth = frame.decoded.width / frame.cols;
  const cellHeight = frame.decoded.height / frame.rows;
  const x0 = (col - 1) * cellWidth;
  const y0 = (row - 1) * cellHeight;

  const subCount = grid * grid;
  const sums = new Array<number>(subCount * 4).fill(0);
  const counts = new Array<number>(subCount).fill(0);

  const startX = Math.max(0, Math.floor(x0));
  const startY = Math.max(0, Math.floor(y0));
  const endX = Math.min(frame.decoded.width, Math.ceil(x0 + cellWidth));
  const endY = Math.min(frame.decoded.height, Math.ceil(y0 + cellHeight));

  for (let y = startY; y < endY; y++) {
    const gy = Math.min(grid - 1, Math.max(0, Math.floor(((y - y0) / cellHeight) * grid)));
    for (let x = startX; x < endX; x++) {
      const gx = Math.min(grid - 1, Math.max(0, Math.floor(((x - x0) / cellWidth) * grid)));
      const sub = gy * grid + gx;
      const i = (y * imageWidth + x) * 4;
      sums[sub * 4] += data[i];
      sums[sub * 4 + 1] += data[i + 1];
      sums[sub * 4 + 2] += data[i + 2];
      sums[sub * 4 + 3] += data[i + 3];
      counts[sub]++;
    }
  }

  const signature = new Array<number>(subCount * 4).fill(0);
  for (let sub = 0; sub < subCount; sub++) {
    if (counts[sub] > 0) {
      signature[sub * 4] = sums[sub * 4] / counts[sub];
      signature[sub * 4 + 1] = sums[sub * 4 + 1] / counts[sub];
      signature[sub * 4 + 2] = sums[sub * 4 + 2] / counts[sub];
      signature[sub * 4 + 3] = sums[sub * 4 + 3] / counts[sub];
    }
  }
  return signature;
}

/**
 * Returns the maximum absolute per-channel difference between two signatures.
 * @param a The first signature.
 * @param b The second signature.
 */
export function signatureMaxChannelDiff(a: CellSignature, b: CellSignature): number {
  if (a.length !== b.length) {
    return Number.POSITIVE_INFINITY;
  }
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    max = Math.max(max, Math.abs(a[i] - b[i]));
  }
  return max;
}

/**
 * Asserts that two cell signatures are effectively identical (i.e. the glyph
 * rendered the same), within a tolerance for antialiasing noise. Use this after
 * a stress action (atlas page merge, atlas clear, scroll, resize) to assert a
 * reference glyph did not become garbled.
 * @param actual The signature observed after the stress action.
 * @param reference The baseline signature captured in a fresh atlas.
 * @param tolerance Max allowed per-channel difference (default 12 / 255).
 * @param message Optional assertion message.
 */
export function expectSignatureMatches(actual: CellSignature, reference: CellSignature, tolerance: number = 12, message?: string): void {
  const diff = signatureMaxChannelDiff(actual, reference);
  expect(diff, message ?? `glyph signature drifted by ${diff} (> ${tolerance}); likely corruption`).toBeLessThanOrEqual(tolerance);
}

/**
 * Asserts that two cell signatures are meaningfully different. Useful as a
 * sanity check that distinct glyphs actually render differently (so the
 * signature has discriminating power) and that a cell is not blank.
 * @param a The first signature.
 * @param b The second signature.
 * @param minDiff Minimum required per-channel difference (default 24 / 255).
 * @param message Optional assertion message.
 */
export function expectSignatureDiffers(a: CellSignature, b: CellSignature, minDiff: number = 24, message?: string): void {
  const diff = signatureMaxChannelDiff(a, b);
  expect(diff, message ?? `signatures unexpectedly similar (${diff} < ${minDiff})`).toBeGreaterThanOrEqual(minDiff);
}

/**
 * Convenience: capture a fresh frame and return the signature of one cell.
 * @param ctx The test context.
 * @param col The 1-based column.
 * @param row The 1-based row.
 * @param options Optional overrides.
 * @param options.selector CSS selector for the screen element to capture.
 * @param options.grid Sub-cell resolution per axis.
 * @param options.termGlobal Window terminal global to read dimensions from.
 */
export async function captureCellSignature(
  ctx: ITestContext,
  col: number,
  row: number,
  options: { selector?: string, grid?: number, termGlobal?: string } = {}
): Promise<CellSignature> {
  const frame = await captureFrame(ctx, options.selector ?? DEFAULT_SCREEN_SELECTOR, options.termGlobal ?? 'term');
  return cellSignature(frame, col, row, options.grid ?? DEFAULT_GRID);
}

/**
 * Captures the signatures of a contiguous run of cells on a single row from one
 * screenshot (cheaper than one screenshot per cell).
 * @param ctx The test context.
 * @param row The 1-based row.
 * @param cols The 1-based columns to sample.
 * @param options Optional overrides.
 * @param options.selector CSS selector for the screen element to capture.
 * @param options.grid Sub-cell resolution per axis.
 * @param options.termGlobal Window terminal global to read dimensions from.
 */
export async function captureRowSignatures(
  ctx: ITestContext,
  row: number,
  cols: number[],
  options: { selector?: string, grid?: number, termGlobal?: string } = {}
): Promise<CellSignature[]> {
  const frame = await captureFrame(ctx, options.selector ?? DEFAULT_SCREEN_SELECTOR, options.termGlobal ?? 'term');
  return cols.map(col => cellSignature(frame, col, row, options.grid ?? DEFAULT_GRID));
}

/**
 * Loads the WebGL addon onto `window.term` and asserts GPU acceleration is
 * genuinely active.
 *
 * This deliberately does NOT wrap loading in try/catch (unlike some existing
 * tests). If WebGL2 is unavailable the addon throws and the test must fail
 * loudly, because a silent fallback to the DOM renderer would make GPU
 * corruption tests pass falsely.
 * @param ctx The test context.
 * @param options WebGL addon options.
 * @param options.customGlyphs Whether to draw custom glyphs (defaults to the addon default).
 * @param options.preserveDrawingBuffer Whether to preserve the drawing buffer (defaults to true).
 */
export async function loadWebglStrict(
  ctx: ITestContext,
  options: { customGlyphs?: boolean, preserveDrawingBuffer?: boolean } = {}
): Promise<void> {
  await ctx.page.evaluate((opts) => {
    const w = window as any;
    w.addon = new w.WebglAddon(opts);
    w.term.loadAddon(w.addon);
  }, { preserveDrawingBuffer: true, ...options });
  await assertWebglActive(ctx);
}

/**
 * Asserts that the WebGL renderer (not the DOM renderer) is the active renderer
 * for `window.term`. Fails loudly on a silent DOM fallback.
 * @param ctx The test context.
 */
export async function assertWebglActive(ctx: ITestContext): Promise<void> {
  const state = await ctx.page.evaluate(() => {
    const w = window as any;
    const term = w.term;
    const addon = w.addon;
    const renderer = term?._core?._renderService?._renderer?.value;
    return {
      hasAddon: !!addon,
      // The addon's private renderer must be the one the render service is using.
      isWebglRenderer: !!addon && !!renderer && renderer === addon._renderer
    };
  });
  expect(state.hasAddon, 'WebglAddon should be loaded on window.term').toBe(true);
  expect(state.isWebglRenderer, 'WebGL renderer must be the active renderer (no silent DOM fallback)').toBe(true);
}

/**
 * Asserts the WebGL texture atlas canvas exists. Call after writing some content
 * so the atlas has been created. This is an additional public-API proof that the
 * GPU path actually rendered glyphs.
 * @param ctx The test context.
 */
export async function assertTextureAtlasPresent(ctx: ITestContext): Promise<void> {
  const hasAtlas = await ctx.page.evaluate(() => {
    const addon = (window as any).addon;
    return !!addon && addon.textureAtlas instanceof HTMLCanvasElement;
  });
  expect(hasAtlas, 'WebGL texture atlas canvas should exist after rendering').toBe(true);
}

/**
 * Reads the current number of pages in the active WebGL renderer's texture
 * atlas, via internals. Returns -1 if unavailable.
 * @param ctx The test context.
 */
export async function getAtlasPageCount(ctx: ITestContext): Promise<number> {
  return ctx.page.evaluate(() => {
    const renderer = (window as any).term?._core?._renderService?._renderer?.value;
    const atlas = renderer?._charAtlas;
    return atlas?.pages?.length ?? -1;
  });
}

/**
 * Forces the texture atlas to merge pages much sooner by lowering the static
 * `maxAtlasPages` knob on the live atlas class (reached via the atlas instance's
 * constructor). Must be called after the WebGL renderer/atlas exists.
 * @param ctx The test context.
 * @param maxAtlasPages The new page cap (the merge path triggers at >= max(4, this)).
 */
export async function setMaxAtlasPages(ctx: ITestContext, maxAtlasPages: number): Promise<void> {
  const applied = await ctx.page.evaluate((max) => {
    const renderer = (window as any).term?._core?._renderService?._renderer?.value;
    const atlas = renderer?._charAtlas;
    if (!atlas) {
      return false;
    }
    // maxAtlasPages is a static on the TextureAtlas class, reached via constructor.
    (atlas.constructor as any).maxAtlasPages = max;
    return true;
  }, maxAtlasPages);
  expect(applied, 'should be able to reach the texture atlas to set maxAtlasPages').toBe(true);
}

/**
 * Writes `chunks` screenfuls of distinct glyphs, rendering after each chunk.
 *
 * Only glyphs that are actually visible during a render get rasterized into the
 * texture atlas, so a single huge write mostly rasterizes the final viewport. To
 * accumulate enough distinct glyphs to allocate (and merge) multiple atlas pages
 * we must write a screenful, render it, then write the next distinct screenful.
 * @param ctx The test context.
 * @param chunks Number of screenfuls of distinct glyphs to write.
 * @param options Sizing overrides.
 * @param options.linesPerChunk Number of lines per screenful chunk.
 * @param options.cols Columns per line.
 * @returns The atlas page count after flooding.
 */
export async function floodDistinctGlyphs(
  ctx: ITestContext,
  chunks: number,
  options: { linesPerChunk?: number, cols?: number } = {}
): Promise<number> {
  const linesPerChunk = options.linesPerChunk ?? 24;
  const cols = options.cols ?? 80;
  const glyphsPerChunk = linesPerChunk * Math.max(1, Math.floor(cols / 2));
  for (let c = 0; c < chunks; c++) {
    await writeAndWaitForRender(ctx, generateUniqueGlyphFlood(glyphsPerChunk, cols, c * glyphsPerChunk));
  }
  return getAtlasPageCount(ctx);
}

/**
 * Resolves once the terminal fires its next render event.
 * @param ctx The test context.
 */
export async function waitForRender(ctx: ITestContext): Promise<void> {
  await new Promise<void>(resolve => {
    const disposable = ctx.proxy.onRender(() => {
      disposable.dispose();
      resolve();
    });
  });
}

/**
 * Writes data and waits for the terminal to render it.
 * @param ctx The test context.
 * @param data The data to write.
 */
export async function writeAndWaitForRender(ctx: ITestContext, data: string): Promise<void> {
  const renderPromise = waitForRender(ctx);
  await ctx.proxy.write(data);
  await renderPromise;
}
