/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IImage32, decodePng } from '@lunapaint/png-codec';
import test, { expect } from '@playwright/test';
import type { Terminal, ITerminalInitOnlyOptions, ITerminalOptions } from '@xterm/xterm';
import type { IWebglAddonOptions, WebglAddon } from '@xterm/addon-webgl';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';

type CellSignature = number[];
type TestTerminalConstructor = new (options?: ITerminalOptions & ITerminalInitOnlyOptions) => ITestTerminal;
type TestWebglAddonConstructor = new (options?: IWebglAddonOptions) => ITestWebglAddon;

interface ITestTextureAtlasConstructor {
  maxAtlasPages: number | undefined;
}

interface ITestTextureAtlas {
  constructor: ITestTextureAtlasConstructor;
  readonly pageLayoutVersion: number;
  readonly pages?: ReadonlyArray<{
    readonly canvas: HTMLCanvasElement;
  }>;
  readonly _pages?: ReadonlyArray<{
    readonly canvas: {
      readonly width: number;
    };
    readonly glyphs: ReadonlyArray<unknown>;
    readonly currentRow: {
      readonly x: number;
      readonly y: number;
    };
    readonly percentageUsed: number;
  }>;
  clearTexture?(): void;
}

interface ITestRenderer {
  _charAtlas?: ITestTextureAtlas;
}

interface ITestRenderService {
  _renderer?: {
    value?: ITestRenderer;
  };
}

interface ITestTerminal extends Terminal {
  _core?: {
    _renderService?: ITestRenderService;
  };
}

interface ITestWebglAddon extends WebglAddon {
  _renderer?: ITestRenderer;
}

declare global {
  interface Window { // eslint-disable-line @typescript-eslint/naming-convention
    Terminal: TestTerminalConstructor;
    WebglAddon: TestWebglAddonConstructor;
    term: ITestTerminal;
    termB?: ITestTerminal;
    addon?: ITestWebglAddon;
    addonB?: ITestWebglAddon;
    atlasBeforeRestore?: ITestTextureAtlas;
  }
}

const HEADER = ' HEADER_REF_0123456789';
const HEADER_COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const TERM_B_SELECTOR = '#terminal-container-b .xterm-screen';

async function loadWebglStrict(ctx: ITestContext): Promise<void> {
  await ctx.page.evaluate(() => {
    window.addon = new window.WebglAddon({ preserveDrawingBuffer: true });
    window.term.loadAddon(window.addon);
  });
  const isWebglRenderer = await ctx.page.evaluate(() => {
    return !!window.addon && window.term?._core?._renderService?._renderer?.value === window.addon._renderer;
  });
  expect(isWebglRenderer, 'WebGL renderer must be active').toBe(true);
}

async function createTerminalB(ctx: ITestContext): Promise<void> {
  await ctx.page.evaluate(() => {
    window.termB?.dispose();
    document.getElementById('terminal-container-b')?.remove();
    const el = document.createElement('div');
    el.id = 'terminal-container-b';
    document.body.appendChild(el);
    window.termB = new window.Terminal({ cols: 80, rows: 24, allowProposedApi: true });
    window.termB.open(el);
    window.addonB = new window.WebglAddon({ preserveDrawingBuffer: true });
    window.termB.loadAddon(window.addonB);
  });
}

async function writeToBAndWaitForRender(ctx: ITestContext, data: string): Promise<void> {
  await ctx.page.evaluate(d => new Promise<void>(resolve => {
    const termB = window.termB;
    if (!termB) {
      throw new Error('Terminal B must be created before writing to it');
    }
    const disposable = termB.onRender(() => {
      disposable.dispose();
      resolve();
    });
    termB.write(d);
  }), data);
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

async function refreshBAndWaitForRender(ctx: ITestContext): Promise<void> {
  await ctx.page.evaluate(() => {
    const termB = window.termB;
    if (!termB) {
      throw new Error('Terminal B must exist before refreshing it');
    }
    return new Promise<void>(resolve => {
      const disposable = termB.onRender(() => {
        disposable.dispose();
        resolve();
      });
      termB.refresh(0, termB.rows - 1);
    });
  });
}

/**
 * Like writeAndWaitForRender, but also returns when the page throws, since a frame that throws never
 * fires onRender.
 */
async function writeAndWaitForRenderOrPageError(ctx: ITestContext, data: string): Promise<void> {
  let onPageError = (): void => {};
  const pageError = new Promise<void>(resolve => {
    onPageError = () => resolve();
  });
  ctx.page.on('pageerror', onPageError);
  try {
    await Promise.race([writeAndWaitForRender(ctx, data), pageError]);
  } finally {
    ctx.page.off('pageerror', onPageError);
  }
}

async function getMergedPageState(ctx: ITestContext): Promise<{ layoutVersion: number, filled: number, empty: number }> {
  return ctx.page.evaluate(() => {
    const atlas = window.addon?._renderer?._charAtlas;
    if (!atlas?._pages) {
      throw new Error('Terminal A must have a texture atlas');
    }
    // New pages are always 512px wide, so 1024px pages come from merging four of them.
    const mergedPages = atlas._pages.filter(page => page.canvas.width === 1024);
    return {
      layoutVersion: atlas.pageLayoutVersion,
      filled: mergedPages.filter(page => page.glyphs.length > 0).length,
      empty: mergedPages.filter(page => page.glyphs.length === 0).length
    };
  });
}

/**
 * Loses and restores the WebGL contexts of terminals A and B, wiping the atlas page canvases while the
 * contexts are lost the way a GPU process restart does. `WEBGL_lose_context` alone leaves them intact.
 */
async function restoreWebglContextsWithWipedAtlas(ctx: ITestContext): Promise<void> {
  await ctx.page.evaluate(async () => {
    const canvases = [window.term, window.termB].map(term => {
      const canvas = term?.element?.querySelector<HTMLCanvasElement>('.xterm-screen canvas:not([class])');
      if (!canvas) {
        throw new Error('Terminals A and B must both use the WebGL renderer');
      }
      return canvas;
    });
    // Get the extensions before losing the contexts, since a lost context hands out no extensions.
    const extensions = canvases.map(canvas => {
      const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
      if (!extension) {
        throw new Error('WEBGL_lose_context must be available');
      }
      return extension;
    });
    const waitForAll = (type: string): Promise<void[]> => Promise.all(canvases.map(canvas => new Promise<void>(resolve => {
      canvas.addEventListener(type, () => resolve(), { once: true });
    })));

    // The renderer only allows a restore once its webglcontextlost handler has run.
    const lost = waitForAll('webglcontextlost');
    extensions.forEach(extension => extension.loseContext());
    await lost;
    // Let the last lost event finish dispatching: the browser records that a restore is allowed
    // only after the dispatch returns, and restoreContext() is ignored until then.
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    for (const page of window.addon?._renderer?._charAtlas?.pages ?? []) {
      page.canvas.getContext('2d')?.clearRect(0, 0, page.canvas.width, page.canvas.height);
    }

    const restored = waitForAll('webglcontextrestored');
    extensions.forEach(extension => extension.restoreContext());
    await restored;
  });
}

async function setMaxAtlasPages(ctx: ITestContext, maxAtlasPages: number): Promise<void> {
  const applied = await ctx.page.evaluate(max => {
    const atlas = window.term?._core?._renderService?._renderer?.value?._charAtlas;
    if (!atlas) {
      return false;
    }
    atlas.constructor.maxAtlasPages = max;
    return true;
  }, maxAtlasPages);
  expect(applied, 'should be able to set TextureAtlas.maxAtlasPages').toBe(true);
}

async function resetMaxAtlasPages(ctx: ITestContext): Promise<void> {
  await ctx.page.evaluate(() => {
    const atlas = window.term?._core?._renderService?._renderer?.value?._charAtlas;
    if (atlas) {
      atlas.constructor.maxAtlasPages = undefined;
    }
  });
}

function generateColoredAsciiFlood(cells: number, offset: number = 0): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < cells; i++) {
    const ch = letters[(offset + i) % letters.length];
    const fg = (offset + i) % 256;
    const bg = (offset + i * 7) % 256;
    out += `\x1b[38;5;${fg}m\x1b[48;5;${bg}m${ch}`;
    if ((i + 1) % 78 === 0 && i + 1 < cells) {
      out += '\x1b[0m\r\n';
    }
  }
  return out + '\x1b[0m';
}

async function captureRowSignatures(ctx: ITestContext, row: number, cols: number[]): Promise<CellSignature[]> {
  const screenshotOptions = process.env.DEBUG ? { path: 'out-esbuild-test/playwright/shared-atlas-term-b.png' } : undefined;
  const buffer = await ctx.page.locator(TERM_B_SELECTOR).screenshot(screenshotOptions);
  const frame = {
    cols: 80,
    rows: 24,
    decoded: (await decodePng(new Uint8Array(buffer), { force32: true })).image
  };
  return cols.map(col => cellSignature(frame, col, row));
}

function cellSignature(frame: { cols: number, rows: number, decoded: IImage32 }, col: number, row: number): CellSignature {
  const grid = 4;
  const data = frame.decoded.data;
  const imageWidth = frame.decoded.width;
  const cellWidth = frame.decoded.width / frame.cols;
  const cellHeight = frame.decoded.height / frame.rows;
  const x0 = (col - 1) * cellWidth;
  const y0 = (row - 1) * cellHeight;
  const sums = new Array<number>(grid * grid * 4).fill(0);
  const counts = new Array<number>(grid * grid).fill(0);
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

  const signature = new Array<number>(grid * grid * 4).fill(0);
  for (let sub = 0; sub < counts.length; sub++) {
    if (counts[sub] > 0) {
      signature[sub * 4] = sums[sub * 4] / counts[sub];
      signature[sub * 4 + 1] = sums[sub * 4 + 1] / counts[sub];
      signature[sub * 4 + 2] = sums[sub * 4 + 2] / counts[sub];
      signature[sub * 4 + 3] = sums[sub * 4 + 3] / counts[sub];
    }
  }
  return signature;
}

function expectSignatureMatches(actual: CellSignature, reference: CellSignature, message: string): void {
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff = Math.max(diff, Math.abs(actual[i] - reference[i]));
  }
  expect(diff, `${message}; max channel diff ${diff}`).toBeLessThanOrEqual(14);
}

test.describe('shared-atlas garble across terminals (#6038)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium');
  test.describe.configure({ timeout: 60000 });

  test('keeps a second terminal rendering correctly after shared atlas page merges', async ({ browser }) => {
    const ctx = await createTestContext(browser);
    try {
      await openTerminal(ctx, { cols: 80, rows: 24 });
      await loadWebglStrict(ctx);
      await createTerminalB(ctx);

      const atlasShared = await ctx.page.evaluate(() => {
        return window.term._core?._renderService?._renderer?.value?._charAtlas === window.termB?._core?._renderService?._renderer?.value?._charAtlas;
      });
      expect(atlasShared, 'terminals with equal configs should share one texture atlas').toBe(true);

      await setMaxAtlasPages(ctx, 4);

      await writeToBAndWaitForRender(ctx, HEADER);
      const reference = await captureRowSignatures(ctx, 1, HEADER_COLS);

      for (let c = 0; c < 10; c++) {
        await writeAndWaitForRender(ctx, '\x1b[2;1H' + generateColoredAsciiFlood(23 * 78, c * 23 * 78));
      }

      await writeToBAndWaitForRender(ctx, '\x1b[24;1Hx');
      const termBHeader = await ctx.page.evaluate(() => window.termB?.buffer.active.getLine(0)?.translateToString(true));
      expect(termBHeader, 'terminal B buffer must still contain the header').toBe(HEADER);

      const after = await captureRowSignatures(ctx, 1, HEADER_COLS);
      for (let i = 0; i < HEADER_COLS.length; i++) {
        expectSignatureMatches(after[i], reference[i], `terminal B header col ${HEADER_COLS[i]} garbled by terminal A's atlas merges`);
      }
    } finally {
      await resetMaxAtlasPages(ctx).catch(() => {});
      await ctx.page.close();
    }
  });

  test('keeps a second terminal rendering correctly after terminal A clears the shared atlas', async ({ browser }) => {
    const ctx = await createTestContext(browser);
    try {
      await openTerminal(ctx, { cols: 80, rows: 24 });
      await loadWebglStrict(ctx);
      await createTerminalB(ctx);

      const atlasShared = await ctx.page.evaluate(() => {
        return window.term._core?._renderService?._renderer?.value?._charAtlas === window.termB?._core?._renderService?._renderer?.value?._charAtlas;
      });
      expect(atlasShared, 'terminals with equal configs should share one texture atlas').toBe(true);

      await writeToBAndWaitForRender(ctx, HEADER);
      const reference = await captureRowSignatures(ctx, 1, HEADER_COLS);

      // Terminal A alone clears the shared atlas, as embedders do to force a redraw (VS Code calls
      // this for every terminal on OS resume). This wipes the pages that terminal B's model still
      // holds texture coords into.
      await ctx.proxy.clearTextureAtlas();

      // Terminal A repopulates the cleared pages with a different glyph set, so B's stale coords now
      // resolve to whatever A rasterized into those slots.
      await writeAndWaitForRender(ctx, '\x1b[2;1H' + generateColoredAsciiFlood(23 * 78));

      // Nudge B into a render that does not touch row 1, mirroring a terminal that is idle but
      // visible. Row 1 must still be drawn from a model B rebuilt against the current atlas.
      await writeToBAndWaitForRender(ctx, '\x1b[24;1Hx');
      const termBHeader = await ctx.page.evaluate(() => window.termB?.buffer.active.getLine(0)?.translateToString(true));
      expect(termBHeader, 'terminal B buffer must still contain the header').toBe(HEADER);

      const after = await captureRowSignatures(ctx, 1, HEADER_COLS);
      for (let i = 0; i < HEADER_COLS.length; i++) {
        expectSignatureMatches(after[i], reference[i], `terminal B header col ${HEADER_COLS[i]} garbled by terminal A's atlas clear`);
      }
    } finally {
      await ctx.page.close();
    }
  });

  test('clears merged atlas pages without changing a second terminal\'s glyphs', async ({ browser }) => {
    const ctx = await createTestContext(browser);
    try {
      await openTerminal(ctx, { cols: 80, rows: 24 });
      await loadWebglStrict(ctx);
      await createTerminalB(ctx);
      await setMaxAtlasPages(ctx, 4);
      await writeToBAndWaitForRender(ctx, HEADER);

      let mergedFirstPage = false;
      for (let chunk = 0; chunk < 16; chunk++) {
        await writeAndWaitForRender(ctx, '\x1b[2J\x1b[H' + generateColoredAsciiFlood(23 * 78, chunk * 23 * 78));
        mergedFirstPage = await ctx.page.evaluate(() => {
          const firstPage = window.addon?._renderer?._charAtlas?._pages?.[0];
          return !!firstPage?.glyphs.length && firstPage.currentRow.x === 0 && firstPage.currentRow.y === 0;
        });
        if (mergedFirstPage) {
          break;
        }
      }
      expect(mergedFirstPage, 'the first atlas page should contain merged glyphs with an unused current row').toBe(true);

      await refreshBAndWaitForRender(ctx);
      const reference = await captureRowSignatures(ctx, 1, HEADER_COLS);
      const cleared = await ctx.page.evaluate(() => {
        const atlas = window.addon?._renderer?._charAtlas;
        if (!atlas?._pages || !atlas.clearTexture) {
          throw new Error('Terminal A must have a clearable shared texture atlas');
        }
        const versionBefore = atlas.pageLayoutVersion;
        atlas.clearTexture();
        const versionAfter = atlas.pageLayoutVersion;
        atlas.clearTexture();
        return {
          versionBefore,
          versionAfter,
          versionAfterSecondClear: atlas.pageLayoutVersion,
          firstPageGlyphs: atlas._pages[0].glyphs.length,
          firstPageUsage: atlas._pages[0].percentageUsed
        };
      });
      expect(cleared, 'clearing a merged atlas page must invalidate it and discard its glyphs').toEqual({
        versionBefore: cleared.versionBefore,
        versionAfter: cleared.versionBefore + 1,
        versionAfterSecondClear: cleared.versionBefore + 1,
        firstPageGlyphs: 0,
        firstPageUsage: 0
      });

      await ctx.proxy.clearTextureAtlas();
      await refreshBAndWaitForRender(ctx);

      const restored = await captureRowSignatures(ctx, 1, HEADER_COLS);
      for (let i = 0; i < HEADER_COLS.length; i++) {
        expectSignatureMatches(restored[i], reference[i], `terminal B header col ${HEADER_COLS[i]} changed after clearing merged atlas pages`);
      }

      for (let chunk = 0; chunk < 3; chunk++) {
        await writeAndWaitForRender(ctx, '\x1b[2J\x1b[H' + generateColoredAsciiFlood(23 * 78, (chunk + 16) * 23 * 78));
      }
      await refreshBAndWaitForRender(ctx);
      const afterMoreOutput = await captureRowSignatures(ctx, 1, HEADER_COLS);
      for (let i = 0; i < HEADER_COLS.length; i++) {
        expectSignatureMatches(afterMoreOutput[i], reference[i], `terminal B header col ${HEADER_COLS[i]} changed after more atlas writes`);
      }
    } finally {
      await resetMaxAtlasPages(ctx).catch(() => {});
      await ctx.page.close();
    }
  });

  test('merges atlas pages again after a clear empties the merged pages', async ({ browser }) => {
    const ctx = await createTestContext(browser);
    const errors: string[] = [];
    const onError = (error: Error): void => { errors.push(error.message); };
    ctx.page.on('pageerror', onError);
    try {
      await openTerminal(ctx, { cols: 80, rows: 24 });
      await loadWebglStrict(ctx);
      await createTerminalB(ctx);
      await setMaxAtlasPages(ctx, 8);
      await writeToBAndWaitForRender(ctx, HEADER);
      const reference = await captureRowSignatures(ctx, 1, HEADER_COLS);

      // With 8 pages, each merge turns four 512px pages into one 1024px page, until four 1024px
      // pages exist and are merged in turn. Clear while those four are still separate, so the next
      // merge finds them empty: merged pages are never written to again after a clear.
      const cellsPerChunk = 6 * 78;
      let chunk = 0;
      let merged = await getMergedPageState(ctx);
      for (; chunk < 150 && merged.filled < 4; chunk++) {
        await writeAndWaitForRenderOrPageError(ctx, '\x1b[2J\x1b[H' + generateColoredAsciiFlood(cellsPerChunk, chunk * cellsPerChunk));
        expect(errors, `filling the atlas must not throw: ${errors[0] ?? ''}`).toEqual([]);
        merged = await getMergedPageState(ctx);
      }
      expect(merged.filled, 'four 1024px merged pages must exist before the clear').toBeGreaterThanOrEqual(4);

      await ctx.proxy.clearTextureAtlas();
      const cleared = await getMergedPageState(ctx);
      expect(cleared.empty, 'the clear must leave the 1024px merged pages empty').toBeGreaterThanOrEqual(4);

      // Keep writing until the atlas merges or evicts pages again. That merge must skip the empty
      // pages, which have no glyph to read a page index from.
      let layoutChanged = false;
      for (let i = 0; i < 150 && !layoutChanged; i++, chunk++) {
        await writeAndWaitForRenderOrPageError(ctx, '\x1b[2J\x1b[H' + generateColoredAsciiFlood(cellsPerChunk, chunk * cellsPerChunk));
        expect(errors, `merging pages after a clear must not throw: ${errors[0] ?? ''}`).toEqual([]);
        layoutChanged = (await getMergedPageState(ctx)).layoutVersion !== cleared.layoutVersion;
      }
      expect(layoutChanged, 'writing after the clear must merge or evict atlas pages').toBe(true);

      await refreshBAndWaitForRender(ctx);
      const termBHeader = await ctx.page.evaluate(() => window.termB?.buffer.active.getLine(0)?.translateToString(true));
      expect(termBHeader, 'terminal B buffer must still contain the header').toBe(HEADER);
      const after = await captureRowSignatures(ctx, 1, HEADER_COLS);
      for (let i = 0; i < HEADER_COLS.length; i++) {
        expectSignatureMatches(after[i], reference[i], `terminal B header col ${HEADER_COLS[i]} changed after merging pages following a clear`);
      }
    } finally {
      ctx.page.off('pageerror', onError);
      await resetMaxAtlasPages(ctx).catch(() => {});
      await ctx.page.close();
    }
  });

  test('redraws terminals that share an atlas after their WebGL contexts are restored', async ({ browser }) => {
    const ctx = await createTestContext(browser);
    try {
      await openTerminal(ctx, { cols: 80, rows: 24 });
      await loadWebglStrict(ctx);
      await createTerminalB(ctx);
      await writeToBAndWaitForRender(ctx, HEADER);
      const reference = await captureRowSignatures(ctx, 1, HEADER_COLS);

      await ctx.page.evaluate(() => {
        window.atlasBeforeRestore = window.addon?._renderer?._charAtlas;
      });
      await restoreWebglContextsWithWipedAtlas(ctx);
      await refreshBAndWaitForRender(ctx);

      const restored = await captureRowSignatures(ctx, 1, HEADER_COLS);
      for (let i = 0; i < HEADER_COLS.length; i++) {
        expectSignatureMatches(restored[i], reference[i], `terminal B header col ${HEADER_COLS[i]} blank after the WebGL contexts were restored`);
      }
      const atlases = await ctx.page.evaluate(() => {
        const atlasA = window.term._core?._renderService?._renderer?.value?._charAtlas;
        const atlasB = window.termB?._core?._renderService?._renderer?.value?._charAtlas;
        return { shared: !!atlasA && atlasA === atlasB, replaced: !!atlasA && atlasA !== window.atlasBeforeRestore };
      });
      expect(atlases, 'both terminals must share a new atlas after the restore').toEqual({ shared: true, replaced: true });

      // A terminal opened after the restore must not get the wiped atlas either.
      await createTerminalB(ctx);
      await writeToBAndWaitForRender(ctx, HEADER);
      const reopened = await captureRowSignatures(ctx, 1, HEADER_COLS);
      for (let i = 0; i < HEADER_COLS.length; i++) {
        expectSignatureMatches(reopened[i], reference[i], `new terminal header col ${HEADER_COLS[i]} blank after the WebGL contexts were restored`);
      }
    } finally {
      await ctx.page.close();
    }
  });
});
