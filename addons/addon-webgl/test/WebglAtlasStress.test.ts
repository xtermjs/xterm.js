/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { decodePng, type IImage32 } from '@lunapaint/png-codec';
import test, { expect } from '@playwright/test';
import type { Terminal, ITerminalInitOnlyOptions, ITerminalOptions } from '@xterm/xterm';
import type { IWebglAddonOptions, WebglAddon } from '@xterm/addon-webgl';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';

type CellSignature = number[];
type TestTerminalConstructor = new (options?: ITerminalOptions & ITerminalInitOnlyOptions) => ITestTerminal;
type TestWebglAddonConstructor = new (options?: IWebglAddonOptions) => ITestWebglAddon;

interface ITestTextureAtlas {
  readonly pages: ReadonlyArray<{ readonly canvas: HTMLCanvasElement }>;
}

interface ITestGlyphRenderer {
  readonly _atlasTextures: ReadonlyArray<unknown>;
}

interface ITestRenderer {
  _charAtlas?: ITestTextureAtlas;
  _glyphRenderer?: {
    value?: ITestGlyphRenderer;
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
  maxPages: number;
}

interface ITestWindow {
  WebglAddon: TestWebglAddonConstructor;
  term: ITestTerminal;
  addon?: ITestWebglAddon;
  atlasEventStats?: IAtlasEventStats;
}

interface IAtlasState {
  additions: number;
  atlasTextures: number;
  maxPages: number;
}

const REFERENCE_LINE = 'Ref0123456789ABCDEF';
const REFERENCE_COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
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

async function installAtlasEventStats(ctx: ITestContext): Promise<void> {
  const installed = await ctx.page.evaluate(() => {
    const w = window as unknown as ITestWindow;
    const atlas = w.term._core?._renderService?._renderer?.value?._charAtlas;
    if (!atlas || !w.addon) {
      return false;
    }
    const stats: IAtlasEventStats = {
      additions: 0,
      maxPages: atlas.pages.length
    };
    w.atlasEventStats = stats;
    w.addon.onAddTextureAtlasCanvas(() => {
      stats.additions++;
      stats.maxPages = Math.max(stats.maxPages, atlas.pages.length);
    });
    return true;
  });
  expect(installed, 'atlas event tracking must be installed').toBe(true);
}

async function getAtlasState(ctx: ITestContext): Promise<IAtlasState> {
  const state = await ctx.page.evaluate(() => {
    const w = window as unknown as ITestWindow;
    const renderer = w.term._core?._renderService?._renderer?.value;
    const glyphRenderer = renderer?._glyphRenderer?.value;
    const stats = w.atlasEventStats;
    if (!glyphRenderer || !stats) {
      return undefined;
    }
    return {
      additions: stats.additions,
      atlasTextures: glyphRenderer._atlasTextures.length,
      maxPages: stats.maxPages
    };
  });
  expect(state, 'atlas state must be available').toBeDefined();
  return state!;
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

async function refreshAndWaitForRender(ctx: ITestContext): Promise<void> {
  const renderPromise = new Promise<void>(resolve => {
    const disposable = ctx.proxy.onRender(() => {
      disposable.dispose();
      resolve();
    });
  });
  await ctx.proxy.refresh(0, (await ctx.proxy.rows) - 1);
  await renderPromise;
}

function generateSyntheticTuiFrames(frameCount: number, cols: number, rows: number): string[] {
  const spinner = ['|', '/', '-', '\\'];
  const words = ['reading', 'rendering', 'atlas', 'terminal', 'buffer', 'tokens', 'diff', 'patch'];
  const frames: string[] = [];
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
    const lines = [
      `+${'-'.repeat(cols - 2)}+`,
      `|${(` ${spinner[frameIndex % spinner.length]} Copilot is working`).padEnd(cols - 2).slice(0, cols - 2)}|`,
      `+${'-'.repeat(cols - 2)}+`
    ];
    for (let row = 3; row < rows - 1; row++) {
      const foreground = 31 + ((frameIndex + row) % 6);
      const text = `${words[(frameIndex + row) % words.length]} ${frameIndex}:${row}`;
      lines.push(`\x1b[${foreground}m${text}\x1b[0m`);
    }
    lines.push(`\x1b[2mtokens ${1000 + frameIndex * 37}\x1b[0m`);
    frames.push(`\x1b[2J\x1b[H${lines.join('\r\n')}`);
  }
  return frames;
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

async function captureRowSignatures(ctx: ITestContext, row: number, cols: number[], debugName: string): Promise<CellSignature[]> {
  const screenshotOptions = process.env.DEBUG ? { path: `out-esbuild-test/playwright/${debugName}.png` } : undefined;
  const buffer = await ctx.page.locator(TERM_SELECTOR).screenshot(screenshotOptions);
  const frame = {
    cols: await ctx.proxy.cols,
    rows: await ctx.proxy.rows,
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

test.describe('WebGL atlas TUI stress (#6038)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'WebGL atlas tests run on Chromium/SwiftShader only');
  test.describe.configure({ timeout: 90000 });

  test('primary-buffer glyphs survive alternate-buffer redraws and atlas page churn', async ({ browser }) => {
    const ctx = await createTestContext(browser);
    const errors: string[] = [];
    const onError = (error: Error): void => { errors.push(error.message); };
    ctx.page.on('pageerror', onError);
    try {
      await openTerminal(ctx, { cols: 80, rows: 24, scrollback: 5000 });
      await loadWebglStrict(ctx);
      await installAtlasEventStats(ctx);

      await writeAndWaitForRender(ctx, REFERENCE_LINE);
      const reference = await captureRowSignatures(ctx, 1, REFERENCE_COLS, 'atlas-stress-reference');

      await writeAndWaitForRender(ctx, '\x1b[?1049h');
      for (const frame of generateSyntheticTuiFrames(30, 80, 24)) {
        await writeAndWaitForRender(ctx, frame);
      }
      const glyphsPerViewport = 23 * 40 - 1;
      for (let chunk = 0; chunk < 4; chunk++) {
        await writeAndWaitForRender(ctx, `\x1b[2J\x1b[H${generateUniqueGlyphFlood(glyphsPerViewport, 80, chunk * glyphsPerViewport)}`);
      }
      await writeAndWaitForRender(ctx, '\x1b[?1049l');
      await refreshAndWaitForRender(ctx);

      const state = await getAtlasState(ctx);
      expect(state.additions, 'stress workload must add atlas pages').toBeGreaterThan(0);
      expect(state.maxPages, 'stress workload must exercise multiple atlas pages').toBeGreaterThan(1);
      expect(state.maxPages, 'atlas pages must remain within renderer texture capacity').toBeLessThanOrEqual(state.atlasTextures);
      expect(errors, `renderer must not throw during TUI stress: ${errors[0] ?? ''}`).toEqual([]);

      const primaryText = await ctx.page.evaluate(() => {
        const w = window as unknown as ITestWindow;
        return w.term.buffer.active.getLine(0)?.translateToString(true);
      });
      expect(primaryText, 'primary buffer must still contain the reference line').toBe(REFERENCE_LINE);

      const after = await captureRowSignatures(ctx, 1, REFERENCE_COLS, 'atlas-stress-after');
      for (let i = 0; i < REFERENCE_COLS.length; i++) {
        expectSignatureMatches(after[i], reference[i], `primary-buffer glyph at col ${REFERENCE_COLS[i]} changed after TUI stress`);
      }
    } finally {
      ctx.page.off('pageerror', onError);
      await ctx.page.close();
    }
  });
});
