/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { openTerminal, launchBrowser, pollFor } from '../../../out-test/api/TestUtils';
import { Browser, Page } from '@playwright/test';
import { IImageAddonOptions } from '../src/Types';
import { FINALIZER, introducer, sixelEncode } from 'sixel';
import { readFileSync } from 'fs';

const APP = 'http://127.0.0.1:3001/test';

let browser: Browser;
let page: Page;
const width = 800;
const height = 600;

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

describe('ImageAddon', () => {
  before(async () => {
    browser = await launchBrowser();
    page = await (await browser.newContext()).newPage();
    await page.setViewportSize({ width, height });
  });

  after(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    await page.goto(APP);
    await openTerminal(page);
    await page.evaluate(opts => {
      (window as any).imageAddon = new ImageAddon(opts.opts);
      (window as any).term.loadAddon((window as any).imageAddon);
    }, { opts: { sixelPaletteLimit: 512 } });
  });

  it('test for private accessors', async () => {
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
      assert.equal(
        await page.evaluate('(() => { const v = window.term.' + prop + '; return v !== undefined && v !== null; })()'),
        true, `problem at ${prop}`
      );
    }
    // bufferline privates
    assert.equal(await page.evaluate('window.term._core.buffer.lines.get(0)._data instanceof Uint32Array'), true);
    assert.equal(await page.evaluate('window.term._core.buffer.lines.get(0)._extendedAttrs instanceof Object'), true);
    // inputhandler privates
    assert.equal(await page.evaluate('window.term._core._inputHandler._curAttrData.constructor.name'), 'AttributeData');
    assert.equal(await page.evaluate('window.term._core._inputHandler._parser.constructor.name'), 'EscapeSequenceParser');
  });

  describe('ctor options', () => {
    it('empty settings should load defaults', async () => {
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
      assert.deepEqual(await page.evaluate(`window.imageAddon._opts`), DEFAULT_OPTIONS);
    });
    it('custom settings should overload defaults', async () => {
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
      await page.evaluate(opts => {
        (window as any).imageAddonCustom = new ImageAddon(opts.opts);
        (window as any).term.loadAddon((window as any).imageAddonCustom);
      }, { opts: customSettings });
      assert.deepEqual(await page.evaluate(`window.imageAddonCustom._opts`), customSettings);
    });
  });

  describe('scrolling & cursor modes', () => {
    it('testdata default (scrolling with VT240 cursor pos)', async () => {
      const dim = await getDimensions();
      await writeToTerminal(SIXEL_SEQ_0);
      assert.deepEqual(await getCursor(), [0, Math.floor(TESTDATA.height/dim.cellHeight)]);
      // moved to right by 10 cells
      await writeToTerminal('#'.repeat(10) + SIXEL_SEQ_0);
      assert.deepEqual(await getCursor(), [10, Math.floor(TESTDATA.height/dim.cellHeight) * 2]);
    });
    it('write testdata noScrolling', async () => {
      await writeToTerminal('\x1b[?80h' + SIXEL_SEQ_0);
      assert.deepEqual(await getCursor(), [0, 0]);
      // second draw does not change anything
      await writeToTerminal(SIXEL_SEQ_0);
      assert.deepEqual(await getCursor(), [0, 0]);
    });
    it('testdata cursor always at VT240 pos', async () => {
      const dim = await getDimensions();
      // offset 0
      await writeToTerminal(SIXEL_SEQ_0);
      assert.deepEqual(await getCursor(), [0, Math.floor(TESTDATA.height/dim.cellHeight)]);
      // moved to right by 10 cells
      await writeToTerminal('#'.repeat(10) + SIXEL_SEQ_0);
      assert.deepEqual(await getCursor(), [10, Math.floor(TESTDATA.height/dim.cellHeight) * 2]);
      // moved by 30 cells (+10 prev)
      await writeToTerminal('#'.repeat(30) + SIXEL_SEQ_0);
      assert.deepEqual(await getCursor(), [10 + 30, Math.floor(TESTDATA.height/dim.cellHeight) * 3]);
    });
  });

  describe('image lifecycle & eviction', () => {
    it('delete image once scrolled off', async () => {
      await writeToTerminal(SIXEL_SEQ_0);
      pollFor(page, 'window.imageAddon._storage._images.size', 1);
      // scroll to scrollback + rows - 1
      await page.evaluate(
        scrollback => new Promise(res => (window as any).term.write('\n'.repeat(scrollback), res)),
        (await getScrollbackPlusRows() - 1)
      );
      // wait here, as we have to make sure, that eviction did not yet occur
      await new Promise(r => setTimeout(r, 100));
      pollFor(page, 'window.imageAddon._storage._images.size', 1);
      // scroll one further should delete the image
      await page.evaluate(() => new Promise(res => (window as any).term.write('\n', res)));
      pollFor(page, 'window.imageAddon._storage._images.size', 0);
    });
    it('get storageUsage', async () => {
      assert.equal(await page.evaluate('imageAddon.storageUsage'), 0);
      await writeToTerminal(SIXEL_SEQ_0);
      assert.closeTo(await page.evaluate('imageAddon.storageUsage'), 640 * 80 * 4 / 1000000, 0.05);
    });
    it('get/set storageLimit', async () => {
      assert.equal(await page.evaluate('imageAddon.storageLimit'), 128);
      assert.equal(await page.evaluate('imageAddon.storageLimit = 1'), 1);
      assert.equal(await page.evaluate('imageAddon.storageLimit'), 1);
    });
    it('remove images by storage limit pressure', async () => {
      assert.equal(await page.evaluate('imageAddon.storageLimit = 1'), 1);
      // never go beyond storage limit
      await writeToTerminal(SIXEL_SEQ_0);
      await writeToTerminal(SIXEL_SEQ_0);
      await writeToTerminal(SIXEL_SEQ_0);
      await writeToTerminal(SIXEL_SEQ_0);
      await new Promise(r => setTimeout(r, 50));
      const usage = await page.evaluate('imageAddon.storageUsage');
      await writeToTerminal(SIXEL_SEQ_0);
      await writeToTerminal(SIXEL_SEQ_0);
      await writeToTerminal(SIXEL_SEQ_0);
      await writeToTerminal(SIXEL_SEQ_0);
      await new Promise(r => setTimeout(r, 50));
      assert.equal(await page.evaluate('imageAddon.storageUsage'), usage);
      assert.equal(usage as number < 1, true);
    });
    it('set storageLimit removes images synchronously', async () => {
      await writeToTerminal(SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0);
      const usage: number = await page.evaluate('imageAddon.storageUsage');
      const newUsage: number = await page.evaluate('imageAddon.storageLimit = 0.5; imageAddon.storageUsage');
      assert.equal(newUsage < usage, true);
      assert.equal(newUsage < 0.5, true);
    });
    it('clear alternate images on buffer change', async () => {
      assert.equal(await page.evaluate('imageAddon.storageUsage'), 0);
      await writeToTerminal('\x1b[?1049h' + SIXEL_SEQ_0);
      assert.closeTo(await page.evaluate('imageAddon.storageUsage'), 640 * 80 * 4 / 1000000, 0.05);
      await writeToTerminal('\x1b[?1049l');
      assert.equal(await page.evaluate('imageAddon.storageUsage'), 0);
    });
    it('evict tiles by in-place overwrites (only full overwrite tested)', async () => {
      await new Promise(r => setTimeout(r, 50));
      await writeToTerminal('\x1b[H' + SIXEL_SEQ_0 + '\x1b[100;100H');
      let usage = await page.evaluate('imageAddon.storageUsage');
      while (usage === 0) {
        await new Promise(r => setTimeout(r, 50));
        usage = await page.evaluate('imageAddon.storageUsage');
      }
      await writeToTerminal('\x1b[H' + SIXEL_SEQ_0 + '\x1b[100;100H');
      await new Promise(r => setTimeout(r, 200));  // wait some time and re-check
      assert.equal(await page.evaluate('imageAddon.storageUsage'), usage);
    });
    it('manual eviction on alternate buffer must not miss images', async () => {
      await writeToTerminal('\x1b[?1049h');
      await writeToTerminal(SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0);
      await new Promise(r => setTimeout(r, 50));
      const usage: number = await page.evaluate('imageAddon.storageUsage');
      await writeToTerminal(SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0);
      await writeToTerminal(SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0);
      await new Promise(r => setTimeout(r, 50));
      const newUsage: number = await page.evaluate('imageAddon.storageUsage');
      assert.equal(newUsage, usage);
    });
  });

  describe('IIP support - testimages', () => {
    it('palette.png', async () => {
      await writeToTerminal(TESTDATA_IIP[0][0]);
      assert.deepEqual(await getOrigSize(1), TESTDATA_IIP[0][1]);
    });
    it('spinfox.png', async () => {
      await writeToTerminal(TESTDATA_IIP[1][0]);
      assert.deepEqual(await getOrigSize(1), TESTDATA_IIP[1][1]);
    });
    it('w3c gif', async () => {
      await writeToTerminal(TESTDATA_IIP[2][0]);
      assert.deepEqual(await getOrigSize(1), TESTDATA_IIP[2][1]);
    });
    it('w3c jpeg', async () => {
      await writeToTerminal(TESTDATA_IIP[3][0]);
      assert.deepEqual(await getOrigSize(1), TESTDATA_IIP[3][1]);
    });
    it('w3c png', async () => {
      await writeToTerminal(TESTDATA_IIP[4][0]);
      assert.deepEqual(await getOrigSize(1), TESTDATA_IIP[4][1]);
    });
  });
});

/**
 * terminal access helpers.
 */
async function getDimensions(): Promise<IDimensions> {
  const dimensions: any = await page.evaluate(`term._core._renderService.dimensions`);
  return {
    cellWidth: Math.round(dimensions.css.cell.width),
    cellHeight: Math.round(dimensions.css.cell.height),
    width: Math.round(dimensions.css.canvas.width),
    height: Math.round(dimensions.css.canvas.height)
  };
}

async function getCursor(): Promise<[number, number]> {
  return page.evaluate('[window.term.buffer.active.cursorX, window.term.buffer.active.cursorY]');
}

async function getImageStorageLength(): Promise<number> {
  return page.evaluate('window.imageAddon._storage._images.size');
}

async function getScrollbackPlusRows(): Promise<number> {
  return page.evaluate('window.term.options.scrollback + window.term.rows');
}

async function writeToTerminal(d: string): Promise<any> {
  return page.evaluate(data => new Promise(res => (window as any).term.write(data, res)), d);
}

async function getOrigSize(id: number): Promise<[number, number]> {
  return page.evaluate<any>(`[
    window.imageAddon._storage._images.get(${id}).orig.width,
    window.imageAddon._storage._images.get(${id}).orig.height
  ]`);
}
