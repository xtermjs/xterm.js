/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test from '@playwright/test';
import { readFileSync } from 'fs';
import { FINALIZER, introducer, sixelEncode } from 'sixel';
import { ITestContext, createTestContext, openTerminal, pollFor, timeout } from '../../../test/playwright/TestUtils';
import { deepStrictEqual, ok, strictEqual } from 'assert';

/**
 * Plugin ctor options.
 */
export interface IImageAddonOptions {
  enableSizeReports: boolean;
  pixelLimit: number;
  storageLimit: number;
  showPlaceholder: boolean;
  sixelSupport: boolean;
  sixelScrolling: boolean;
  sixelPaletteLimit: number;
  sixelSizeLimit: number;
  iipSupport: boolean;
  iipSizeLimit: number;
}

// eslint-disable-next-line
declare const ImageAddon: {
  new(options?: Partial<IImageAddonOptions>): any;
};

interface ITestData {
  width: number;
  height: number;
  bytes: Uint8Array;
  palette: number[];
  sixel: string;
}

interface IDimensions {
  cellWidth: number;
  cellHeight: number;
  width: number;
  height: number;
}

// image: 640 x 80, 512 color
const TESTDATA: ITestData = (() => {
  const data8 = readFileSync('./addons/addon-image/fixture/palette.blob');
  const data32 = new Uint32Array(data8.buffer);
  const palette = new Set<number>();
  for (let i = 0; i < data32.length; ++i) palette.add(data32[i]);
  const sixel = sixelEncode(data8, 640, 80, [...palette]);
  return {
    width: 640,
    height: 80,
    bytes: data8,
    palette: [...palette],
    sixel
  };
})();
const SIXEL_SEQ_0 = introducer(0) + TESTDATA.sixel + FINALIZER;
// const SIXEL_SEQ_1 = introducer(1) + TESTDATA.sixel + FINALIZER;
// const SIXEL_SEQ_2 = introducer(2) + TESTDATA.sixel + FINALIZER;

// NOTE: the data is loaded as string for easier transport through playwright
const TESTDATA_IIP: [string, [number, number]][] = [
  [readFileSync('./addons/addon-image/fixture/iip/palette.iip', { encoding: 'utf-8' }), [640, 80]],
  [readFileSync('./addons/addon-image/fixture/iip/spinfox.iip', { encoding: 'utf-8' }), [148, 148]],
  [readFileSync('./addons/addon-image/fixture/iip/w3c_gif.iip', { encoding: 'utf-8' }), [72, 48]],
  [readFileSync('./addons/addon-image/fixture/iip/w3c_jpg.iip', { encoding: 'utf-8' }), [72, 48]],
  [readFileSync('./addons/addon-image/fixture/iip/w3c_png.iip', { encoding: 'utf-8' }), [72, 48]]
];

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx, { cols: 80, rows: 24 });
});
test.afterAll(async () => await ctx.page.close());

test.describe('ImageAddon', () => {

  test.beforeEach(async ({}, testInfo) => {
    // DEBT: This test never worked on webkit
    if (ctx.browser.browserType().name() === 'webkit') {
      testInfo.skip();
      return;
    }
    await ctx.page.evaluate(`
      window.term.reset()
      window.imageAddon?.dispose();
      window.imageAddon = new ImageAddon({ sixelPaletteLimit: 512 });
      window.term.loadAddon(window.imageAddon);
    `);
  });

  test('test for private accessors', async () => {
    // terminal privates
    const accessors = [
      '_core',
      '_core._renderService',
      '_core._inputHandler',
      '_core._inputHandler._parser',
      '_core._inputHandler._curAttrData',
      '_core._inputHandler._dirtyRowTracker',
      '_core._themeService.colors',
      '_core._coreBrowserService'
    ];
    for (const prop of accessors) {
      strictEqual(
        await ctx.page.evaluate('(() => { const v = window.term.' + prop + '; return v !== undefined && v !== null; })()'),
        true, `problem at ${prop}`
      );
    }
    // bufferline privates
    strictEqual(await ctx.page.evaluate('window.term._core.buffer.lines.get(0)._data instanceof Uint32Array'), true);
    strictEqual(await ctx.page.evaluate('window.term._core.buffer.lines.get(0)._extendedAttrs instanceof Object'), true);
    // inputhandler privates
    strictEqual(await ctx.page.evaluate('window.term._core._inputHandler._curAttrData.constructor.name'), '_AttributeData');
    strictEqual(await ctx.page.evaluate('window.term._core._inputHandler._parser.constructor.name'), 'EscapeSequenceParser');
  });

  test.describe('ctor options', () => {
    test('empty settings should load defaults', async () => {
      const DEFAULT_OPTIONS: IImageAddonOptions = {
        enableSizeReports: true,
        pixelLimit: 16777216,
        sixelSupport: true,
        sixelScrolling: true,
        sixelPaletteLimit: 512,  // set to 512 to get example image working
        sixelSizeLimit: 25000000,
        storageLimit: 128,
        showPlaceholder: true,
        iipSupport: true,
        iipSizeLimit: 20000000
      };
      deepStrictEqual(await ctx.page.evaluate(`window.imageAddon._opts`), DEFAULT_OPTIONS);
    });
    test('custom settings should overload defaults', async () => {
      const customSettings: IImageAddonOptions = {
        enableSizeReports: false,
        pixelLimit: 5,
        sixelSupport: false,
        sixelScrolling: false,
        sixelPaletteLimit: 1024,
        sixelSizeLimit: 1000,
        storageLimit: 10,
        showPlaceholder: false,
        iipSupport: false,
        iipSizeLimit: 1000
      };
      await ctx.page.evaluate(opts => {
        (window as any).imageAddonCustom = new ImageAddon(opts.opts);
        (window as any).term.loadAddon((window as any).imageAddonCustom);
      }, { opts: customSettings });
      deepStrictEqual(await ctx.page.evaluate(`window.imageAddonCustom._opts`), customSettings);
    });
  });

  test.describe('scrolling & cursor modes', () => {
    test('testdata default (scrolling with VT240 cursor pos)', async () => {
      const dim = await getDimensions();
      await ctx.proxy.write(SIXEL_SEQ_0);
      deepStrictEqual(await getCursor(), [0, Math.floor(TESTDATA.height/dim.cellHeight)]);
      // moved to right by 10 cells
      await ctx.proxy.write('#'.repeat(10) + SIXEL_SEQ_0);
      deepStrictEqual(await getCursor(), [10, Math.floor(TESTDATA.height/dim.cellHeight) * 2]);
    });
    test('write testdata noScrolling', async () => {
      await ctx.proxy.write('\x1b[?80h' + SIXEL_SEQ_0);
      deepStrictEqual(await getCursor(), [0, 0]);
      // second draw does not change anything
      await ctx.proxy.write(SIXEL_SEQ_0);
      deepStrictEqual(await getCursor(), [0, 0]);
    });
    test('testdata cursor always at VT240 pos', async () => {
      const dim = await getDimensions();
      // offset 0
      await ctx.proxy.write(SIXEL_SEQ_0);
      deepStrictEqual(await getCursor(), [0, Math.floor(TESTDATA.height/dim.cellHeight)]);
      // moved to right by 10 cells
      await ctx.proxy.write('#'.repeat(10) + SIXEL_SEQ_0);
      deepStrictEqual(await getCursor(), [10, Math.floor(TESTDATA.height/dim.cellHeight) * 2]);
      // moved by 30 cells (+10 prev)
      await ctx.proxy.write('#'.repeat(30) + SIXEL_SEQ_0);
      deepStrictEqual(await getCursor(), [10 + 30, Math.floor(TESTDATA.height/dim.cellHeight) * 3]);
    });
  });

  test.describe('image lifecycle & eviction', () => {
    test('delete image once scrolled off', async () => {
      await ctx.proxy.write(SIXEL_SEQ_0);
      pollFor(ctx.page, 'window.imageAddon._storage._images.size', 1);
      // scroll to scrollback + rows - 1
      await ctx.page.evaluate(
        scrollback => new Promise(res => (window as any).term.write('\n'.repeat(scrollback), res)),
        (await getScrollbackPlusRows() - 1)
      );
      // wait here, as we have to make sure, that eviction did not yet occur
      await timeout(100);
      pollFor(ctx.page, 'window.imageAddon._storage._images.size', 1);
      // scroll one further should delete the image
      await ctx.page.evaluate(() => new Promise(res => (window as any).term.write('\n', res)));
      pollFor(ctx.page, 'window.imageAddon._storage._images.size', 0);
    });
    test('get storageUsage', async () => {
      strictEqual(await ctx.page.evaluate('window.imageAddon.storageUsage'), 0);
      await ctx.proxy.write(SIXEL_SEQ_0);
      ok(Math.abs((await ctx.page.evaluate<number>('window.imageAddon.storageUsage')) - 640 * 80 * 4 / 1000000) < 0.05);
    });
    test('get/set storageLimit', async () => {
      strictEqual(await ctx.page.evaluate('window.imageAddon.storageLimit'), 128);
      strictEqual(await ctx.page.evaluate('window.imageAddon.storageLimit = 1'), 1);
      strictEqual(await ctx.page.evaluate('window.imageAddon.storageLimit'), 1);
    });
    test('remove images by storage limit pressure', async () => {
      strictEqual(await ctx.page.evaluate('window.imageAddon.storageLimit = 1'), 1);
      // never go beyond storage limit
      await ctx.proxy.write(SIXEL_SEQ_0);
      await ctx.proxy.write(SIXEL_SEQ_0);
      await ctx.proxy.write(SIXEL_SEQ_0);
      await ctx.proxy.write(SIXEL_SEQ_0);
      await timeout(100);
      const usage = await ctx.page.evaluate('window.imageAddon.storageUsage');
      await ctx.proxy.write(SIXEL_SEQ_0);
      await ctx.proxy.write(SIXEL_SEQ_0);
      await ctx.proxy.write(SIXEL_SEQ_0);
      await ctx.proxy.write(SIXEL_SEQ_0);
      await timeout(100);
      strictEqual(await ctx.page.evaluate('window.imageAddon.storageUsage'), usage);
      strictEqual(usage as number < 1, true);
    });
    test('set storageLimit removes images synchronously', async () => {
      await ctx.proxy.write(SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0);
      const usage: number = await ctx.page.evaluate('window.imageAddon.storageUsage');
      const newUsage: number = await ctx.page.evaluate('window.imageAddon.storageLimit = 0.5; window.imageAddon.storageUsage');
      strictEqual(newUsage < usage, true);
      strictEqual(newUsage < 0.5, true);
    });
    test('clear alternate images on buffer change', async () => {
      strictEqual(await ctx.page.evaluate('window.imageAddon.storageUsage'), 0);
      await ctx.proxy.write('\x1b[?1049h' + SIXEL_SEQ_0);
      ok(Math.abs((await ctx.page.evaluate<number>('window.imageAddon.storageUsage')) - 640 * 80 * 4 / 1000000) < 0.05);
      await ctx.proxy.write('\x1b[?1049l');
      strictEqual(await ctx.page.evaluate('window.imageAddon.storageUsage'), 0);
    });
    test('evict tiles by in-place overwrites (only full overwrite tested)', async () => {
      await timeout(50);
      await ctx.proxy.write('\x1b[H' + SIXEL_SEQ_0 + '\x1b[100;100H');
      await timeout(50);
      let usage = await ctx.page.evaluate('window.imageAddon.storageUsage');
      while (usage === 0) {
        await timeout(50);
        usage = await ctx.page.evaluate('window.imageAddon.storageUsage');
      }
      await ctx.proxy.write('\x1b[H' + SIXEL_SEQ_0 + '\x1b[100;100H');
      await timeout(200); // wait some time and re-check
      strictEqual(await ctx.page.evaluate('window.imageAddon.storageUsage'), usage);
    });
    test('manual eviction on alternate buffer must not miss images', async () => {
      await ctx.proxy.write('\x1b[?1049h');
      await ctx.proxy.write(SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0);
      await timeout(100);
      const usage: number = await ctx.page.evaluate('window.imageAddon.storageUsage');
      await ctx.proxy.write(SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0);
      await ctx.proxy.write(SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0);
      await timeout(100);
      const newUsage: number = await ctx.page.evaluate('window.imageAddon.storageUsage');
      strictEqual(newUsage, usage);
    });
  });

  test.describe('IIP support - testimages', () => {
    test('palette.png', async () => {
      await ctx.proxy.write(TESTDATA_IIP[0][0]);
      deepStrictEqual(await getOrigSize(1), TESTDATA_IIP[0][1]);
    });
    test('spinfox.png', async () => {
      await ctx.proxy.write(TESTDATA_IIP[1][0]);
      deepStrictEqual(await getOrigSize(1), TESTDATA_IIP[1][1]);
    });
    test('w3c gif', async () => {
      await ctx.proxy.write(TESTDATA_IIP[2][0]);
      deepStrictEqual(await getOrigSize(1), TESTDATA_IIP[2][1]);
    });
    test('w3c jpeg', async () => {
      await ctx.proxy.write(TESTDATA_IIP[3][0]);
      deepStrictEqual(await getOrigSize(1), TESTDATA_IIP[3][1]);
    });
    test('w3c png', async () => {
      await ctx.proxy.write(TESTDATA_IIP[4][0]);
      deepStrictEqual(await getOrigSize(1), TESTDATA_IIP[4][1]);
    });
  });
});

/**
 * terminal access helpers.
 */
async function getDimensions(): Promise<IDimensions> {
  const dimensions: any = await ctx.page.evaluate(`term._core._renderService.dimensions`);
  return {
    cellWidth: Math.round(dimensions.css.cell.width),
    cellHeight: Math.round(dimensions.css.cell.height),
    width: Math.round(dimensions.css.canvas.width),
    height: Math.round(dimensions.css.canvas.height)
  };
}

async function getCursor(): Promise<[number, number]> {
  return ctx.page.evaluate('[window.term.buffer.active.cursorX, window.term.buffer.active.cursorY]');
}

async function getImageStorageLength(): Promise<number> {
  return ctx.page.evaluate('window.imageAddon._storage._images.size');
}

async function getScrollbackPlusRows(): Promise<number> {
  return ctx.page.evaluate('window.term.options.scrollback + window.term.rows');
}

async function getOrigSize(id: number): Promise<[number, number]> {
  return ctx.page.evaluate<any>(`[
    window.imageAddon._storage._images.get(${id}).orig.width,
    window.imageAddon._storage._images.get(${id}).orig.height
  ]`);
}
