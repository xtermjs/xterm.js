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
  kittySupport: boolean;
  kittySizeLimit: number;
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

// Kitty graphics test images
const KITTY_BLACK_1X1_BASE64 = readFileSync('./addons/addon-image/fixture/kitty/black-1x1.png').toString('base64');
const KITTY_RGB_3X1_BASE64 = readFileSync('./addons/addon-image/fixture/kitty/rgb-3x1.png').toString('base64');

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
        iipSizeLimit: 20000000,
        kittySupport: true,
        kittySizeLimit: 20000000
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
        iipSizeLimit: 1000,
        kittySupport: false,
        kittySizeLimit: 1000
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

  test.describe('Kitty graphics support', () => {
    test('stores 1x1 black PNG with a=T (transmit and display)', async () => {
      const seq = `\x1b_Ga=T,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`;
      await ctx.proxy.write(seq);
      await timeout(100);
      strictEqual(await getImageStorageLength(), 1);
      deepStrictEqual(await getOrigSize(1), [1, 1]);
    });

    test('stores 3x1 RGB PNG with a=T', async () => {
      const seq = `\x1b_Ga=T,f=100;${KITTY_RGB_3X1_BASE64}\x1b\\`;
      await ctx.proxy.write(seq);
      await timeout(100);
      strictEqual(await getImageStorageLength(), 1);
      deepStrictEqual(await getOrigSize(1), [3, 1]);
    });

    test('transmit only (a=t) does not display but stores in handler', async () => {
      const seq = `\x1b_Ga=t,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`;
      await ctx.proxy.write(seq);
      await timeout(100);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.size`), 1);
    });

    test('uses specified image ID', async () => {
      const seq = `\x1b_Ga=t,f=100,i=42;${KITTY_BLACK_1X1_BASE64}\x1b\\`;
      await ctx.proxy.write(seq);
      await timeout(100);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.has(42)`), true);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.has(1)`), false);
    });

    test('assigns auto-incrementing IDs when not specified', async () => {
      await ctx.proxy.write(`\x1b_Ga=t,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await ctx.proxy.write(`\x1b_Ga=t,f=100;${KITTY_RGB_3X1_BASE64}\x1b\\`);
      await timeout(100);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.size`), 2);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.has(1)`), true);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.has(2)`), true);
    });

    test('defaults to transmit action when action is omitted', async () => {
      const seq = `\x1b_Gf=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`;
      await ctx.proxy.write(seq);
      await timeout(100);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.size`), 1);
    });

    test('ignores command when action is empty string', async () => {
      const seq = `\x1b_Ga=,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`;
      await ctx.proxy.write(seq);
      await timeout(100);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.size`), 0);
    });

    test('handles chunked transmission (m=1)', async () => {
      const half = Math.floor(KITTY_BLACK_1X1_BASE64.length / 2);
      const part1 = KITTY_BLACK_1X1_BASE64.substring(0, half);
      const part2 = KITTY_BLACK_1X1_BASE64.substring(half);

      const seq1 = `\x1b_Ga=T,f=100,i=99,m=1;${part1}\x1b\\`;
      const seq2 = `\x1b_Ga=T,f=100,i=99;${part2}\x1b\\`;

      await ctx.proxy.write(seq1);
      await timeout(50);
      strictEqual(await getImageStorageLength(), 0);

      await ctx.proxy.write(seq2);
      await timeout(100);
      strictEqual(await getImageStorageLength(), 1);
    });

    test('verifies chunked data is assembled correctly', async () => {
      const half = Math.floor(KITTY_BLACK_1X1_BASE64.length / 2);
      const part1 = KITTY_BLACK_1X1_BASE64.substring(0, half);
      const part2 = KITTY_BLACK_1X1_BASE64.substring(half);

      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=99,m=1;${part1}\x1b\\`);
      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=99;${part2}\x1b\\`);
      await timeout(100);

      const storedData = await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.get(99).data`);
      strictEqual(storedData, KITTY_BLACK_1X1_BASE64);
    });

    test('delete command (a=d) removes specific image by id', async () => {
      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=10;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.size`), 1);

      await ctx.proxy.write(`\x1b_Ga=d,i=10\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.size`), 0);
    });

    test('delete command (a=d) removes all images when no id specified', async () => {
      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=1;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=2;${KITTY_RGB_3X1_BASE64}\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.size`), 2);

      await ctx.proxy.write(`\x1b_Ga=d\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.size`), 0);
    });
  });

  test.describe('Kitty query support (a=q)', () => {
    test('responds with OK for capability query without payload', async () => {
      let response = '';
      await ctx.page.evaluate(() => {
        (window as any).kittyResponse = '';
        (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
      });

      await ctx.proxy.write('\x1b_Gi=31,a=q;\x1b\\');
      await timeout(100);

      response = await ctx.page.evaluate('window.kittyResponse');
      strictEqual(response, '\x1b_Gi=31;OK\x1b\\');
    });

    test('responds with OK for valid PNG query', async () => {
      let response = '';
      await ctx.page.evaluate(() => {
        (window as any).kittyResponse = '';
        (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
      });

      await ctx.proxy.write(`\x1b_Gi=42,a=q,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      response = await ctx.page.evaluate('window.kittyResponse');
      strictEqual(response, '\x1b_Gi=42;OK\x1b\\');
    });

    test('query does NOT store the image (unlike transmit)', async () => {
      await ctx.page.evaluate(() => {
        (window as any).term.onData(() => { /* consume response */ });
      });

      await ctx.proxy.write(`\x1b_Gi=50,a=q,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.has(50)`), false);
    });

    test('responds with error for invalid base64', async () => {
      let response = '';
      await ctx.page.evaluate(() => {
        (window as any).kittyResponse = '';
        (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
      });

      await ctx.proxy.write('\x1b_Gi=60,a=q,f=100;!!!invalid!!!\x1b\\');
      await timeout(100);

      response = await ctx.page.evaluate('window.kittyResponse');
      strictEqual(response.startsWith('\x1b_Gi=60;EINVAL:'), true);
    });

    test('responds with error for RGB data without dimensions', async () => {
      let response = '';
      await ctx.page.evaluate(() => {
        (window as any).kittyResponse = '';
        (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
      });

      await ctx.proxy.write('\x1b_Gi=70,a=q,f=24;AAAA\x1b\\');
      await timeout(100);

      response = await ctx.page.evaluate('window.kittyResponse');
      strictEqual(response, '\x1b_Gi=70;EINVAL:width and height required for raw pixel data\x1b\\');
    });

    test('suppresses OK response when q=1', async () => {
      await ctx.page.evaluate(() => {
        (window as any).kittyGotResponse = false;
        (window as any).term.onData(() => { (window as any).kittyGotResponse = true; });
      });

      await ctx.proxy.write(`\x1b_Gi=80,a=q,q=1,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      strictEqual(await ctx.page.evaluate('window.kittyGotResponse'), false);
    });

    test('suppresses error response when q=2', async () => {
      await ctx.page.evaluate(() => {
        (window as any).kittyGotResponse = false;
        (window as any).term.onData(() => { (window as any).kittyGotResponse = true; });
      });

      await ctx.proxy.write('\x1b_Gi=90,a=q,q=2,f=100;!!!invalid!!!\x1b\\');
      await timeout(100);

      strictEqual(await ctx.page.evaluate('window.kittyGotResponse'), false);
    });
  });

  test.describe('Kitty pixel verification', () => {
    test('renders 1x1 black PNG at cursor position', async () => {
      const seq = `\x1b_Ga=T,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`;
      await ctx.proxy.write(seq);
      await timeout(100);

      const pixel = await ctx.page.evaluate(() => {
        const canvas = (window as any).imageAddon.getImageAtBufferCell(0, 0);
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        return Array.from(ctx.getImageData(0, 0, 1, 1).data);
      });

      deepStrictEqual(pixel, [0, 0, 0, 255]);
    });

    test('renders 3x1 RGB PNG (red, green, blue pixels)', async () => {
      const seq = `\x1b_Ga=T,f=100;${KITTY_RGB_3X1_BASE64}\x1b\\`;
      await ctx.proxy.write(seq);
      await timeout(100);

      const pixels = await ctx.page.evaluate(() => {
        const canvas = (window as any).imageAddon.getImageAtBufferCell(0, 0);
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        const imageData = ctx.getImageData(0, 0, 3, 1).data;
        return {
          red: Array.from(imageData.slice(0, 4)),
          green: Array.from(imageData.slice(4, 8)),
          blue: Array.from(imageData.slice(8, 12))
        };
      });

      deepStrictEqual(pixels?.red, [255, 0, 0, 255]);
      deepStrictEqual(pixels?.green, [0, 255, 0, 255]);
      deepStrictEqual(pixels?.blue, [0, 0, 255, 255]);
    });
  });
});

/**
 * terminal access helpers.
 */
async function getDimensions(): Promise<IDimensions> {
  const dimensions: any = await ctx.page.evaluate(`term.dimensions`);
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
