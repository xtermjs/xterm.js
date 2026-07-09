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
  maxTextureSize: number | undefined;
}

interface ITestAtlasPage {
  canvas: HTMLCanvasElement;
}

interface ITestTextureAtlas {
  constructor: ITestTextureAtlasConstructor;
  pages: ITestAtlasPage[];
  pageLayoutVersion: number;
  _overflowSizePage?: ITestAtlasPage;
  _textureSize: number;
}

interface ITestGlyphRenderer {
  _atlasTextures: unknown[];
}

interface ITestRenderer {
  _charAtlas?: ITestTextureAtlas;
  _glyphRenderer?: {
    value?: ITestGlyphRenderer;
  };
  dimensions: {
    device: {
      cell: {
        width: number;
      };
    };
  };
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

interface IAtlasEventStats {
  additions: number;
  removals: number;
  maxPages: number;
}

interface ITestWindow extends Window {
  Terminal: TestTerminalConstructor;
  WebglAddon: TestWebglAddonConstructor;
  term: ITestTerminal;
  termB?: ITestTerminal;
  addon?: ITestWebglAddon;
  addonB?: ITestWebglAddon;
  atlasEventStats?: IAtlasEventStats;
}

interface IAtlasLimits {
  maxAtlasPages: number;
  maxTextureSize: number;
}

interface IAtlasState {
  pages: number;
  atlasTextures: number;
  pageLayoutVersion: number;
  overflowPageCreated: boolean;
  additions: number;
  removals: number;
  maxPages: number;
}

const NORMAL_HEADER = ' NORMAL_REF_0123456789';
const POST_EVICTION_TEXT = ' AFTER_EVICTION_0123456789';
const NORMAL_HEADER_COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const POST_EVICTION_COLS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const TERM_B_SELECTOR = '#terminal-container-b .xterm-screen';
const TERM_SELECTOR = '#terminal-container .xterm-screen';

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

async function createTerminalB(ctx: ITestContext, cols: number): Promise<void> {
  await ctx.page.evaluate(columnCount => {
    const w = window as unknown as ITestWindow;
    w.termB?.dispose();
    document.getElementById('terminal-container-b')?.remove();
    const element = document.createElement('div');
    element.id = 'terminal-container-b';
    document.body.appendChild(element);
    w.termB = new w.Terminal({ cols: columnCount, rows: 24, allowProposedApi: true });
    w.termB.open(element);
    w.addonB = new w.WebglAddon({ preserveDrawingBuffer: true });
    w.termB.loadAddon(w.addonB);
  }, cols);
}

async function writeToBAndWaitForRender(ctx: ITestContext, data: string): Promise<void> {
  await ctx.page.evaluate(value => new Promise<void>(resolve => {
    const w = window as unknown as ITestWindow;
    if (!w.termB) {
      throw new Error('Terminal B must be created before writing to it');
    }
    const disposable = w.termB.onRender(() => {
      disposable.dispose();
      resolve();
    });
    w.termB.write(value);
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

async function refreshAndWaitForRender(ctx: ITestContext, terminal: 'term' | 'termB'): Promise<void> {
  await ctx.page.evaluate(name => new Promise<void>(resolve => {
    const w = window as unknown as ITestWindow;
    const term = w[name];
    if (!term) {
      throw new Error(`${name} must exist before refreshing it`);
    }
    const disposable = term.onRender(() => {
      disposable.dispose();
      resolve();
    });
    term.refresh(0, term.rows - 1);
  }), terminal);
}

async function configureAtlasLimits(ctx: ITestContext): Promise<IAtlasLimits> {
  const limits = await ctx.page.evaluate(() => {
    const w = window as unknown as ITestWindow;
    const atlas = w.term._core?._renderService?._renderer?.value?._charAtlas;
    if (!atlas || atlas.constructor.maxAtlasPages === undefined || atlas.constructor.maxTextureSize === undefined) {
      return undefined;
    }
    const result = {
      maxAtlasPages: atlas.constructor.maxAtlasPages,
      maxTextureSize: atlas.constructor.maxTextureSize
    };
    atlas.constructor.maxAtlasPages = 4;
    atlas.constructor.maxTextureSize = 512;
    return result;
  });
  expect(limits, 'TextureAtlas limits must be initialized').toBeDefined();
  return limits!;
}

async function restoreAtlasLimits(ctx: ITestContext, limits: IAtlasLimits | undefined): Promise<void> {
  if (!limits) {
    return;
  }
  await ctx.page.evaluate(original => {
    const w = window as unknown as ITestWindow;
    const atlas = w.term._core?._renderService?._renderer?.value?._charAtlas;
    if (atlas) {
      atlas.constructor.maxAtlasPages = original.maxAtlasPages;
      atlas.constructor.maxTextureSize = original.maxTextureSize;
    }
  }, limits);
}

async function installAtlasEventStats(ctx: ITestContext): Promise<void> {
  const installed = await ctx.page.evaluate(() => {
    const w = window as unknown as ITestWindow;
    const atlas = w.term._core?._renderService?._renderer?.value?._charAtlas;
    if (!atlas || !w.addon) {
      return false;
    }
    const stats: IAtlasEventStats = {
      additions: 0,
      removals: 0,
      maxPages: atlas.pages.length
    };
    w.atlasEventStats = stats;
    w.addon.onAddTextureAtlasCanvas(() => {
      stats.additions++;
      stats.maxPages = Math.max(stats.maxPages, atlas.pages.length);
    });
    w.addon.onRemoveTextureAtlasCanvas(() => stats.removals++);
    return true;
  });
  expect(installed, 'atlas event tracking must be installed').toBe(true);
}

async function getAtlasState(ctx: ITestContext): Promise<IAtlasState> {
  const state = await ctx.page.evaluate(() => {
    const w = window as unknown as ITestWindow;
    const renderer = w.term._core?._renderService?._renderer?.value;
    const atlas = renderer?._charAtlas;
    const glyphRenderer = renderer?._glyphRenderer?.value;
    const stats = w.atlasEventStats;
    if (!atlas || !glyphRenderer || !stats) {
      return undefined;
    }
    return {
      pages: atlas.pages.length,
      atlasTextures: glyphRenderer._atlasTextures.length,
      pageLayoutVersion: atlas.pageLayoutVersion,
      overflowPageCreated: !!atlas._overflowSizePage,
      additions: stats.additions,
      removals: stats.removals,
      maxPages: stats.maxPages
    };
  });
  expect(state, 'atlas state must be available').toBeDefined();
  return state!;
}

function generateUniqueGlyphFlood(count: number, cols: number, offset: number): string {
  const base = 0x4E00;
  const range = 0x9FFF - base;
  const perRow = Math.max(1, Math.floor(cols / 2));
  let result = '';
  for (let i = 0; i < count; i++) {
    result += String.fromCodePoint(base + ((offset + i) % range));
    if ((i + 1) % perRow === 0 && i + 1 < count) {
      result += '\r\n';
    }
  }
  return result;
}

async function captureRowSignatures(ctx: ITestContext, selector: string, cols: number, row: number, sampleCols: number[], debugName: string): Promise<CellSignature[]> {
  const screenshotOptions = process.env.DEBUG ? { path: `out-esbuild-test/playwright/${debugName}.png` } : undefined;
  const buffer = await ctx.page.locator(selector).screenshot(screenshotOptions);
  const frame = {
    cols,
    rows: 24,
    decoded: (await decodePng(new Uint8Array(buffer), { force32: true })).image
  };
  return sampleCols.map(col => cellSignature(frame, col, row));
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

function signatureDiff(actual: CellSignature, reference: CellSignature): number {
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff = Math.max(diff, Math.abs(actual[i] - reference[i]));
  }
  return diff;
}

function expectSignatureMatches(actual: CellSignature, reference: CellSignature, message: string): void {
  const diff = signatureDiff(actual, reference);
  expect(diff, `${message}; max channel diff ${diff}`).toBeLessThanOrEqual(14);
}

test.describe('atlas page overflow (#6038)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium');
  test.describe.configure({ timeout: 90000 });

  test('evicts normal pages when the page cap cannot be reduced by merging', async ({ browser }) => {
    const ctx = await createTestContext(browser);
    const errors: string[] = [];
    const onError = (error: Error): void => { errors.push(error.message); };
    let limits: IAtlasLimits | undefined;
    ctx.page.on('pageerror', onError);
    try {
      await openTerminal(ctx, { cols: 80, rows: 24 });
      await loadWebglStrict(ctx);
      limits = await configureAtlasLimits(ctx);

      await openTerminal(ctx, { cols: 80, rows: 24 });
      await loadWebglStrict(ctx);
      await createTerminalB(ctx, 80);
      await installAtlasEventStats(ctx);

      const atlasShared = await ctx.page.evaluate(() => {
        const w = window as unknown as ITestWindow;
        return w.term._core?._renderService?._renderer?.value?._charAtlas === w.termB?._core?._renderService?._renderer?.value?._charAtlas;
      });
      expect(atlasShared, 'terminals with equal configs should share one texture atlas').toBe(true);

      await writeToBAndWaitForRender(ctx, `\x1b[H${NORMAL_HEADER}\x1b[2;1H${POST_EVICTION_TEXT}`);
      const headerReference = await captureRowSignatures(ctx, TERM_B_SELECTOR, 80, 1, NORMAL_HEADER_COLS, 'atlas-overflow-header-reference');
      const postReference = await captureRowSignatures(ctx, TERM_B_SELECTOR, 80, 2, POST_EVICTION_COLS, 'atlas-overflow-post-reference');
      await writeToBAndWaitForRender(ctx, '\x1b[2;1H\x1b[2K');

      const initialState = await getAtlasState(ctx);
      const glyphsPerChunk = 23 * 40 - 1;
      for (let chunk = 0; chunk < 24; chunk++) {
        await ctx.proxy.write('\x1b[H\x1b[2J' + generateUniqueGlyphFlood(glyphsPerChunk, 80, chunk * glyphsPerChunk));
        await ctx.page.waitForTimeout(50);
        const state = await getAtlasState(ctx);
        if (state.removals > 0 || state.pages > state.atlasTextures || errors.length > 0) {
          break;
        }
      }

      const evictionState = await getAtlasState(ctx);
      expect(evictionState.removals, 'normal atlas pages must be evicted at the page cap').toBeGreaterThan(0);
      expect(evictionState.pageLayoutVersion, 'eviction must invalidate renderer models').toBeGreaterThan(initialState.pageLayoutVersion);
      expect(evictionState.maxPages, 'atlas pages must stay within renderer texture capacity').toBeLessThanOrEqual(evictionState.atlasTextures);
      expect(errors, `renderer must not throw during atlas eviction: ${errors[0] ?? ''}`).toEqual([]);

      await writeToBAndWaitForRender(ctx, `\x1b[2;1H${POST_EVICTION_TEXT}`);
      const termBHeader = await ctx.page.evaluate(() => {
        const w = window as unknown as ITestWindow;
        return w.termB?.buffer.active.getLine(0)?.translateToString(true);
      });
      expect(termBHeader, 'terminal B buffer must still contain the header').toBe(NORMAL_HEADER);

      const headerAfter = await captureRowSignatures(ctx, TERM_B_SELECTOR, 80, 1, NORMAL_HEADER_COLS, 'atlas-overflow-header-after');
      const postAfter = await captureRowSignatures(ctx, TERM_B_SELECTOR, 80, 2, POST_EVICTION_COLS, 'atlas-overflow-post-after');
      for (let i = 0; i < NORMAL_HEADER_COLS.length; i++) {
        expectSignatureMatches(headerAfter[i], headerReference[i], `existing header col ${NORMAL_HEADER_COLS[i]} changed after eviction`);
      }
      for (let i = 0; i < POST_EVICTION_COLS.length; i++) {
        expectSignatureMatches(postAfter[i], postReference[i], `new text col ${POST_EVICTION_COLS[i]} changed after eviction`);
      }

      const stableState = await getAtlasState(ctx);
      await refreshAndWaitForRender(ctx, 'termB');
      const refreshedState = await getAtlasState(ctx);
      expect(refreshedState.pageLayoutVersion, 'an unchanged full refresh must not evict again').toBe(stableState.pageLayoutVersion);
      expect(refreshedState.removals, 'an unchanged full refresh must not remove more pages').toBe(stableState.removals);
    } finally {
      ctx.page.off('pageerror', onError);
      await restoreAtlasLimits(ctx, limits).catch(() => {});
      await ctx.page.close();
    }
  });

  test('evicts before adding an oversized glyph page at the page cap', async ({ browser }) => {
    const ctx = await createTestContext(browser);
    const errors: string[] = [];
    const onError = (error: Error): void => { errors.push(error.message); };
    let limits: IAtlasLimits | undefined;
    ctx.page.on('pageerror', onError);
    try {
      await openTerminal(ctx, { cols: 160, rows: 24 });
      await loadWebglStrict(ctx);
      limits = await configureAtlasLimits(ctx);

      await openTerminal(ctx, { cols: 160, rows: 24 });
      await loadWebglStrict(ctx);
      await installAtlasEventStats(ctx);

      let state = await getAtlasState(ctx);
      let offset = 0;
      for (let chunk = 0; chunk < 120 && state.pages < state.atlasTextures; chunk++) {
        const glyphCount = state.pages < state.atlasTextures - 1 ? 200 : 25;
        await ctx.proxy.write('\x1b[H\x1b[2J' + generateUniqueGlyphFlood(glyphCount, 160, offset));
        await ctx.page.waitForTimeout(50);
        offset += glyphCount;
        state = await getAtlasState(ctx);
      }
      expect(state.pages, 'normal atlas pages must reach the texture capacity before the oversized glyph').toBe(state.atlasTextures);
      expect(state.overflowPageCreated, 'normal glyph filling must not create the oversized page').toBe(false);
      expect(errors, `renderer must not fail while filling normal pages: ${errors[0] ?? ''}`).toEqual([]);

      await writeAndWaitForRender(ctx, '\x1b[H\x1b[2K\x1b[24;1H');
      const sampleCols = [1, 8, 16, 24, 32];
      const blankSignatures = await captureRowSignatures(ctx, TERM_SELECTOR, 160, 1, sampleCols, 'atlas-overflow-wide-blank');
      const joinedLength = await ctx.page.evaluate(() => {
        const w = window as unknown as ITestWindow;
        const renderer = w.term._core?._renderService?._renderer?.value;
        const atlas = renderer?._charAtlas;
        if (!renderer || !atlas) {
          throw new Error('renderer and atlas must exist');
        }
        const cellWidth = renderer.dimensions.device.cell.width;
        const length = Math.min(w.term.cols - 1, Math.ceil(atlas._textureSize / cellWidth) + 32);
        if (length * cellWidth <= atlas._textureSize) {
          throw new Error('joined glyph must be wider than a normal atlas page');
        }
        const marker = 'W'.repeat(length);
        w.term.registerCharacterJoiner(text => text.startsWith(marker) ? [[0, length]] : []);
        return length;
      });

      const beforeOversized = await getAtlasState(ctx);
      await ctx.proxy.write(`\x1b[H${'W'.repeat(joinedLength)}`);
      await ctx.page.waitForTimeout(50);
      const oversizedState = await getAtlasState(ctx);
      expect(oversizedState.overflowPageCreated, 'the joined glyph must use the oversized atlas page').toBe(true);
      expect(oversizedState.removals, 'normal pages must be evicted before adding the oversized page').toBeGreaterThan(beforeOversized.removals);
      expect(oversizedState.maxPages, 'oversized page creation must stay within renderer texture capacity').toBeLessThanOrEqual(oversizedState.atlasTextures);
      expect(oversizedState.pageLayoutVersion, 'oversized eviction must invalidate renderer models').toBeGreaterThan(beforeOversized.pageLayoutVersion);
      expect(errors, `renderer must not throw while adding the oversized page: ${errors[0] ?? ''}`).toEqual([]);

      const wideSignatures = await captureRowSignatures(ctx, TERM_SELECTOR, 160, 1, sampleCols, 'atlas-overflow-wide-after');
      for (let i = 0; i < sampleCols.length; i++) {
        expect(signatureDiff(wideSignatures[i], blankSignatures[i]), `wide glyph col ${sampleCols[i]} must render visible pixels`).toBeGreaterThan(14);
      }

      const stableState = await getAtlasState(ctx);
      await refreshAndWaitForRender(ctx, 'term');
      const refreshedState = await getAtlasState(ctx);
      expect(refreshedState.pageLayoutVersion, 'oversized glyph refresh must settle without another eviction').toBe(stableState.pageLayoutVersion);
      expect(refreshedState.removals, 'oversized glyph refresh must not remove more pages').toBe(stableState.removals);
      const wideAfterRefresh = await captureRowSignatures(ctx, TERM_SELECTOR, 160, 1, sampleCols, 'atlas-overflow-wide-refreshed');
      for (let i = 0; i < sampleCols.length; i++) {
        expectSignatureMatches(wideAfterRefresh[i], wideSignatures[i], `wide glyph col ${sampleCols[i]} changed after refresh`);
      }
    } finally {
      ctx.page.off('pageerror', onError);
      await restoreAtlasLimits(ctx, limits).catch(() => {});
      await ctx.page.close();
    }
  });
});
