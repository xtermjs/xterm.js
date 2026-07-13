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
});
