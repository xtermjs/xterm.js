/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { openTerminal, getBrowserType } from '../../../out-test/api/TestUtils';
import { Browser, Page } from 'playwright';
import { IImageAddonOptions } from '../src/Types';
import { FINALIZER, introducer, sixelEncode } from 'sixel';
import { readFileSync } from 'fs';
import PNG from 'png-ts';

const APP = 'http://127.0.0.1:3000/test';

let browser: Browser;
let page: Page;
const width = 800;
const height = 600;

// eslint-disable-next-line
declare const ImageAddon: any;

interface ITestData {
  width: number;
  height: number;
  bytes: Uint8Array;
  palette: number[];
  sixel: string;
}

interface IDim {
  cellWidth: number;
  cellHeight: number;
  width: number;
  height: number;
}

// image: 640 x 80, 512 color
const TESTDATA: ITestData = (() => {
  const pngImage = PNG.load(readFileSync('./addons/xterm-addon-image/fixture/palette.png'));
  const data8 = pngImage.decode();
  const data32 = new Uint32Array(data8.buffer);
  const palette = new Set<number>();
  for (let i = 0; i < data32.length; ++i) palette.add(data32[i]);
  const sixel = sixelEncode(data8, pngImage.width, pngImage.height, [...palette]);
  return {
    width: pngImage.width,
    height: pngImage.height,
    bytes: data8,
    palette: [...palette],
    sixel
  };
})();
const SIXEL_SEQ_0 = introducer(0) + TESTDATA.sixel + FINALIZER;
// const SIXEL_SEQ_1 = introducer(1) + TESTDATA.sixel + FINALIZER;
// const SIXEL_SEQ_2 = introducer(2) + TESTDATA.sixel + FINALIZER;


describe('ImageAddon', () => {
  before(async function(): Promise<any> {
    const browserType = getBrowserType();
    browser = await browserType.launch({
      headless: process.argv.indexOf('--headless') !== -1
    });
    page = await (await browser.newContext()).newPage();
    await page.setViewportSize({ width, height });
  });

  after(async () => {
    await browser.close();
  });

  beforeEach(async function(): Promise<any> {
    await page.goto(APP);
    await openTerminal(page);
    await page.evaluate(`window.imageAddon = new ImageAddon({sixelPaletteLimit: 512});`);
    await page.evaluate(`window.term.loadAddon(window.imageAddon);`);
  });

  describe('ctor options', () => {
    it('empty settings should load defaults', async () => {
      const DEFAULT_OPTIONS: IImageAddonOptions = {
        cursorRight: false,
        cursorBelow: false,
        sixelSupport: true,
        sixelScrolling: true,
        sixelPaletteLimit: 512,  // set to 512 to get example image working
        sixelSizeLimit: 25000000,
        sixelPrivatePalette: true,
        sixelDefaultPalette: 'VT340-COLOR',
        storageLimit: 100,
        showPlaceholder: true
      };
      assert.deepEqual(await page.evaluate(`window.imageAddon._opts`), DEFAULT_OPTIONS);
    });
    it('custom settings should overload defaults', async () => {
      const customSettings: IImageAddonOptions = {
        cursorRight: true,
        cursorBelow: true,
        sixelSupport: false,
        sixelScrolling: false,
        sixelPaletteLimit: 1024,
        sixelSizeLimit: 1000,
        sixelPrivatePalette: false,
        sixelDefaultPalette: 'VT340-GREY',
        storageLimit: 10,
        showPlaceholder: false
      };
      await page.evaluate(opts => {
        (<any>window).imageAddonCustom = new ImageAddon(opts);
        (<any>window).term.loadAddon((<any>window).imageAddonCustom);
      }, customSettings);
      assert.deepEqual(await page.evaluate(`window.imageAddonCustom._opts`), customSettings);
    });
  });

  describe('scrolling & cursor modes', () => {
    it('testdata default (scrolling, cursor next line, beginning)', async () => {
      const dim = await getDim();
      await writeToTerminal(SIXEL_SEQ_0);
      assert.deepEqual(await getCursor(), [0, Math.ceil(TESTDATA.height/dim.cellHeight)]);
      // moved to right by 10 cells
      await writeToTerminal('#'.repeat(10) + SIXEL_SEQ_0);
      assert.deepEqual(await getCursor(), [0, Math.ceil(TESTDATA.height/dim.cellHeight) * 2]);
      // await new Promise(res => setTimeout(res, 1000));
    });
    it('write testdata noScrolling', async () => {
      await writeToTerminal('\x1b[?80l' + SIXEL_SEQ_0);
      assert.deepEqual(await getCursor(), [0, 0]);
      // second draw does not change anything
      await writeToTerminal(SIXEL_SEQ_0);
      assert.deepEqual(await getCursor(), [0, 0]);
    });
    it.skip('testdata cursor right', async () => {
      const dim = await getDim();
      await writeToTerminal('\x1b[?8452h' + SIXEL_SEQ_0);
      // currently failing on OSX firefox with AssertionError: expected [ 72, 4 ] to deeply equal [ 72, 5 ]
      assert.deepEqual(await getCursor(), [Math.ceil(TESTDATA.width/dim.cellWidth), Math.floor(TESTDATA.height/dim.cellHeight)]);
    });
    it('testdata cursor right with overflow beginning', async () => {
      const dim = await getDim();
      await writeToTerminal('\x1b[?8452h' + '#'.repeat(30) + SIXEL_SEQ_0);
      assert.deepEqual(await getCursor(), [0, Math.ceil(TESTDATA.height/dim.cellHeight)]);
    });
    it('testdata cursor right with overflow below', async () => {
      const dim = await getDim();
      await writeToTerminal('\x1b[?8452;7730h' + '#'.repeat(30) + SIXEL_SEQ_0);
      assert.deepEqual(await getCursor(), [30, Math.ceil(TESTDATA.height/dim.cellHeight)]);
    });
    it('testdata cursor always below', async () => {
      const dim = await getDim();
      // offset 0
      await writeToTerminal('\x1b[?7730h' + SIXEL_SEQ_0);
      assert.deepEqual(await getCursor(), [0, Math.ceil(TESTDATA.height/dim.cellHeight)]);
      // moved to right by 10 cells
      await writeToTerminal('#'.repeat(10) + SIXEL_SEQ_0);
      assert.deepEqual(await getCursor(), [10, Math.ceil(TESTDATA.height/dim.cellHeight) * 2]);
      // moved by 30 cells (+10 prev)
      await writeToTerminal('#'.repeat(30) + SIXEL_SEQ_0);
      assert.deepEqual(await getCursor(), [10 + 30, Math.ceil(TESTDATA.height/dim.cellHeight) * 3]);
    });
  });

  describe('image lifecycle & eviction', () => {
    it('delete image once scrolled off', async () => {
      await writeToTerminal(SIXEL_SEQ_0);
      assert.equal(await getImageStorageLength(), 1);
      // scroll to scrollback + rows - 1
      await page.evaluate(
        scrollback => new Promise(res => (window as any).term.write('\n'.repeat(scrollback), res)),
        (await getScrollbackPlusRows() - 1)
      );
      assert.equal(await getImageStorageLength(), 1);
      // scroll one further should delete the image
      await page.evaluate(() => new Promise(res => (window as any).term.write('\n', res)));
      assert.equal(await getImageStorageLength(), 0);
    });
    it('get storageUsage', async () => {
      assert.equal(await page.evaluate('imageAddon.storageUsage'), 0);
      await writeToTerminal(SIXEL_SEQ_0);
      assert.closeTo(await page.evaluate('imageAddon.storageUsage'), 640 * 80 * 4 / 1000000, 0.05);
    });
    it('get/set storageLimit', async () => {
      assert.equal(await page.evaluate('imageAddon.storageLimit'), 100);
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
      const usage = await page.evaluate('imageAddon.storageUsage');
      await writeToTerminal(SIXEL_SEQ_0);
      await writeToTerminal(SIXEL_SEQ_0);
      await writeToTerminal(SIXEL_SEQ_0);
      await writeToTerminal(SIXEL_SEQ_0);
      assert.equal(await page.evaluate('imageAddon.storageUsage'), usage);
      assert.equal(usage as number < 1, true);
    });
    it('set storageLimit removes images synchronously', async () => {
      await writeToTerminal(SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0);
      const usage: number = await page.evaluate('imageAddon.storageUsage');
      const newUsage: number = await page.evaluate('imageAddon.storageLimit = 1; imageAddon.storageUsage');
      assert.equal(newUsage < usage, true);
      assert.equal(newUsage < 1, true);
    });
    it('clear alternate images on buffer change', async () => {
      assert.equal(await page.evaluate('imageAddon.storageUsage'), 0);
      await writeToTerminal('\x1b[?1049h' + SIXEL_SEQ_0);
      assert.closeTo(await page.evaluate('imageAddon.storageUsage'), 640 * 80 * 4 / 1000000, 0.05);
      await writeToTerminal('\x1b[?1049l');
      assert.equal(await page.evaluate('imageAddon.storageUsage'), 0);
    });
    it('evict tiles by in-place overwrites (only full overwrite tested)', async () => {
      await writeToTerminal('\x1b[H' + SIXEL_SEQ_0 + '\x1b[100;100H');
      const usage = await page.evaluate('imageAddon.storageUsage');
      await writeToTerminal('\x1b[H' + SIXEL_SEQ_0 + '\x1b[100;100H');
      await writeToTerminal('\x1b[H' + SIXEL_SEQ_0 + '\x1b[100;100H');
      await writeToTerminal('\x1b[H' + SIXEL_SEQ_0 + '\x1b[100;100H');
      assert.equal(await page.evaluate('imageAddon.storageUsage'), usage);
    });
    it('manual eviction on alternate buffer must not miss images', async () => {
      await writeToTerminal('\x1b[?1049h');
      await writeToTerminal(SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0);
      const usage: number = await page.evaluate('imageAddon.storageUsage');
      await writeToTerminal(SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0);
      await writeToTerminal(SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0 + SIXEL_SEQ_0);
      const newUsage: number = await page.evaluate('imageAddon.storageUsage');
      assert.equal(newUsage, usage);
    });
  });

});

/**
 * terminal access helpers.
 */
async function getDim(): Promise<IDim> {
  const dim: any = await page.evaluate(`term._core._renderService.dimensions`);
  return {
    cellWidth: Math.round(dim.actualCellWidth),
    cellHeight: Math.round(dim.actualCellHeight),
    width: Math.round(dim.canvasWidth),
    height: Math.round(dim.canvasHeight)
  };
}

async function getCursor(): Promise<[number, number]> {
  return page.evaluate('[window.term.buffer.active.cursorX, window.term.buffer.active.cursorY]');
}

async function getImageStorageLength(): Promise<number> {
  return page.evaluate('window.imageAddon._storage._images.size');
}

async function getScrollbackPlusRows(): Promise<number> {
  return page.evaluate('window.term.getOption(\'scrollback\') + window.term.rows');
}

async function writeToTerminal(d: string): Promise<any> {
  return page.evaluate(data => new Promise(res => (window as any).term.write(data, res)), d);
}
