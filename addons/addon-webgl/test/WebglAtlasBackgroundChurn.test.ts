/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test, { expect } from '@playwright/test';
import type { Terminal, ITerminalInitOnlyOptions, ITerminalOptions } from '@xterm/xterm';
import type { IWebglAddonOptions, WebglAddon } from '@xterm/addon-webgl';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';

/**
 * A deterministic repro for glyph-cache churn driven by the *background*.
 *
 * #6038 fixed what happens once churn overruns the page cap — pages are
 * evicted and the renderer no longer garbles or throws. It deliberately left
 * glyph-level eviction alone ("avoid global eviction unless it has its own
 * deterministic test"), so `TextureAtlas._cacheMap` still only ever grows.
 *
 * This file supplies the missing determinism from the other side: rather than
 * flooding unique *glyphs*, it repaints a handful of glyphs over a background
 * that changes every cell of every frame — an animated TUI background, a
 * heatmap, a diff with highlighted regions, ANSI art. The glyph set is tiny
 * and fixed, so a cache keyed on what is actually rasterised has a small fixed
 * size, and any growth is churn by definition. Frame count and cell count are
 * fixed, so the churn rate is exact rather than probabilistic.
 *
 * That makes it both a regression test for the cache key and a ready-made
 * workload for eviction work: with the key fixed the cache is bounded, and
 * removing the `allowTransparency` precondition puts the unbounded case back
 * whenever a bound needs exercising.
 */

interface ITwoKeyMapInternal {
  _data: { [first: string]: { [second: string]: unknown } | undefined };
}

interface IFourKeyMapInternal {
  _data: ITwoKeyMapInternal & {
    _data: { [first: string]: { [second: string]: ITwoKeyMapInternal | undefined } | undefined };
  };
}

interface ITestTextureAtlas {
  pages: unknown[];
  _cacheMap: IFourKeyMapInternal;
}

interface ITestRenderer {
  _charAtlas?: ITestTextureAtlas;
}

interface ITestTerminal extends Terminal {
  _core?: {
    _renderService?: {
      _renderer?: { value?: ITestRenderer };
    };
  };
}

interface ITestWebglAddon extends WebglAddon {
  _renderer?: ITestRenderer;
}

interface ITestWindow extends Window {
  Terminal: new (options?: ITerminalOptions & ITerminalInitOnlyOptions) => ITestTerminal;
  WebglAddon: new (options?: IWebglAddonOptions) => ITestWebglAddon;
  term: ITestTerminal;
  addon?: ITestWebglAddon;
}

const COLS = 80;
const ROWS = 24;
const FRAMES = 16;

/** Deliberately small: the cache should settle at roughly this many entries. */
const GLYPHS = '─│┌┐└┘abcXYZ';

async function loadWebglStrict(ctx: ITestContext): Promise<void> {
  await ctx.page.evaluate(() => {
    const w = window as unknown as ITestWindow;
    w.addon = new w.WebglAddon({ preserveDrawingBuffer: true });
    w.term.loadAddon(w.addon);
  });
  const isWebglRenderer = await ctx.page.evaluate(() => {
    const w = window as unknown as ITestWindow;
    return !!w.addon && w.term._core?._renderService?._renderer?.value === w.addon._renderer;
  });
  expect(isWebglRenderer, 'WebGL renderer must be active').toBe(true);
}

async function writeAndWaitForRender(ctx: ITestContext, data: string): Promise<void> {
  const renderPromise = new Promise<void>(resolve => {
    const disposable = ctx.proxy.onRender(() => {
      disposable.dispose();
      resolve();
    });
  });
  await ctx.proxy.write(data);
  await renderPromise;
}

/**
 * Wait for the atlas to stop growing on its own.
 *
 * `_doWarmUp` pre-rasterises ASCII 33-125 from an `IdleTaskQueue`, so the
 * cache keeps filling for a while after the first render for reasons that have
 * nothing to do with the workload under test. Settling first lets the
 * assertion below be an exact equality rather than a tolerance.
 */
async function waitForCacheToSettle(ctx: ITestContext): Promise<number> {
  let previous = -1;
  for (let attempt = 0; attempt < 40; attempt++) {
    const current = await getCachedGlyphCount(ctx);
    if (current === previous) {
      return current;
    }
    previous = current;
    await ctx.page.waitForTimeout(50);
  }
  throw new Error(`glyph cache never settled, last count ${previous}`);
}

/** Number of rasterised tiles held in the atlas' glyph cache. */
async function getCachedGlyphCount(ctx: ITestContext): Promise<number> {
  const count = await ctx.page.evaluate(() => {
    const w = window as unknown as ITestWindow;
    const atlas = w.term._core?._renderService?._renderer?.value?._charAtlas;
    if (!atlas?._cacheMap) {
      return undefined;
    }
    let total = 0;
    const byKey = atlas._cacheMap._data._data;
    for (const key of Object.keys(byKey)) {
      const byBg = byKey[key];
      if (!byBg) {
        continue;
      }
      for (const bg of Object.keys(byBg)) {
        const byFg = byBg[bg]?._data;
        if (!byFg) {
          continue;
        }
        for (const fg of Object.keys(byFg)) {
          total += Object.keys(byFg[fg] ?? {}).length;
        }
      }
    }
    return total;
  });
  expect(count, 'glyph cache must be reachable').toBeDefined();
  return count!;
}

/**
 * One frame of a full-screen animated background: every cell gets its own
 * truecolor background, and the glyph on it comes from a fixed small set.
 */
function backgroundFrame(frame: number): string {
  let out = '\x1b[H';
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      // A cheap deterministic walk through the truecolor space. Distinct per
      // cell and per frame, which is exactly what an animation produces.
      const seed = frame * 7919 + row * 131 + col * 17;
      const r = seed % 256;
      const g = (seed >> 3) % 256;
      const b = (seed >> 6) % 256;
      out += `\x1b[38;2;220;220;220m\x1b[48;2;${r};${g};${b}m`;
      out += GLYPHS[(row * COLS + col) % GLYPHS.length];
    }
    if (row < ROWS - 1) {
      out += '\r\n';
    }
  }
  return out;
}

test.describe('glyph cache churn from per-cell backgrounds', () => {
  test.skip(({ browserName }) => browserName !== 'chromium');
  test.describe.configure({ timeout: 90000 });

  test('a background that changes every cell must not grow the glyph cache without bound', async ({ browser }) => {
    const ctx = await createTestContext(browser);
    const errors: string[] = [];
    const onError = (error: Error): void => { errors.push(error.message); };
    ctx.page.on('pageerror', onError);
    try {
      // allowTransparency is what makes the tile independent of the
      // background: the atlas is filled with NULL_COLOR instead of the
      // background colour, so nothing about the background is baked in.
      // minimumContrastRatio must stay at 1, or the foreground is adjusted
      // against the background and the tile depends on it after all.
      await openTerminal(ctx, {
        cols: COLS,
        rows: ROWS,
        allowTransparency: true,
        minimumContrastRatio: 1
      });
      await loadWebglStrict(ctx);

      await writeAndWaitForRender(ctx, backgroundFrame(0));
      const settled = await waitForCacheToSettle(ctx);
      expect(settled, 'the first frame must populate the cache').toBeGreaterThan(0);

      for (let frame = 1; frame < FRAMES; frame++) {
        await writeAndWaitForRender(ctx, backgroundFrame(frame));
      }
      const afterAllFrames = await getCachedGlyphCount(ctx);

      // The glyph set never changes, so nothing new is rasterised however many
      // backgrounds go past. Before the cache key dropped the background
      // colour this grew by one entry per cell per frame — 30k odd over these
      // 16 frames — and never came back down.
      expect(
        afterAllFrames,
        `glyph cache grew from ${settled} to ${afterAllFrames} over ${FRAMES} frames of a changing background`
      ).toBe(settled);

      expect(errors, `renderer must not throw: ${errors[0] ?? ''}`).toEqual([]);
    } finally {
      ctx.page.off('pageerror', onError);
      await ctx.page.close();
    }
  });

  test('an opaque atlas still keys glyphs on the background colour', async ({ browser }) => {
    const ctx = await createTestContext(browser);
    try {
      // The complement of the case above, kept so the precondition is not
      // silently widened later. With an opaque atlas the tile is filled with
      // the background and the antialiased fringe is blended against it, so
      // sharing one tile across backgrounds would halo the glyph edges.
      await openTerminal(ctx, {
        cols: COLS,
        rows: ROWS,
        allowTransparency: false,
        minimumContrastRatio: 1
      });
      await loadWebglStrict(ctx);

      await writeAndWaitForRender(ctx, backgroundFrame(0));
      const afterFirstFrame = await getCachedGlyphCount(ctx);
      await writeAndWaitForRender(ctx, backgroundFrame(1));
      const afterSecondFrame = await getCachedGlyphCount(ctx);

      expect(
        afterSecondFrame,
        'an opaque atlas must still rasterise per background colour'
      ).toBeGreaterThan(afterFirstFrame);
    } finally {
      await ctx.page.close();
    }
  });
});
