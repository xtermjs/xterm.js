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
        storageLimit: 100
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
        storageLimit: 10
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
      const sixelSequence = introducer(0) + TESTDATA.sixel + FINALIZER;
      await page.evaluate(data => new Promise(res => (window as any).term.write(data, res)), sixelSequence);
      assert.deepEqual(await getCursor(), [0, Math.ceil(TESTDATA.height/dim.cellHeight)]);
      // moved to right by 10 cells
      await page.evaluate(data => new Promise(res => (window as any).term.write('#'.repeat(10) + data, res)), sixelSequence);
      assert.deepEqual(await getCursor(), [0, Math.ceil(TESTDATA.height/dim.cellHeight) * 2]);
      // await new Promise(res => setTimeout(res, 1000));
    });
    it('write testdata noScrolling', async () => {
      const sixelSequence = introducer(0) + TESTDATA.sixel + FINALIZER;
      await page.evaluate(data => new Promise(res => (window as any).term.write('\x1b[?80l' + data, res)), sixelSequence);
      assert.deepEqual(await getCursor(), [0, 0]);
      // second draw does not change anything
      await page.evaluate(data => new Promise(res => (window as any).term.write(data, res)), sixelSequence);
      assert.deepEqual(await getCursor(), [0, 0]);
    });
    it.skip('testdata cursor right', async () => {
      const dim = await getDim();
      const sixelSequence = introducer(0) + TESTDATA.sixel + FINALIZER;
      await page.evaluate(data => new Promise(res => (window as any).term.write('\x1b[?8452h' + data, res)), sixelSequence);
      // currently failing on OSX firefox with AssertionError: expected [ 72, 4 ] to deeply equal [ 72, 5 ]
      assert.deepEqual(await getCursor(), [Math.ceil(TESTDATA.width/dim.cellWidth), Math.floor(TESTDATA.height/dim.cellHeight)]);
    });
    it('testdata cursor right with overflow beginning', async () => {
      const dim = await getDim();
      const sixelSequence = introducer(0) + TESTDATA.sixel + FINALIZER;
      await page.evaluate(data => new Promise(res => (window as any).term.write('\x1b[?8452h' + '#'.repeat(30) + data, res)), sixelSequence);
      assert.deepEqual(await getCursor(), [0, Math.ceil(TESTDATA.height/dim.cellHeight)]);
    });
    it('testdata cursor right with overflow below', async () => {
      const dim = await getDim();
      const sixelSequence = introducer(0) + TESTDATA.sixel + FINALIZER;
      await page.evaluate(data => new Promise(res => (window as any).term.write('\x1b[?8452;7730h' + '#'.repeat(30) + data, res)), sixelSequence);
      assert.deepEqual(await getCursor(), [30, Math.ceil(TESTDATA.height/dim.cellHeight)]);
    });
    it('testdata cursor always below', async () => {
      const dim = await getDim();
      const sixelSequence = introducer(0) + TESTDATA.sixel + FINALIZER;
      // offset 0
      await page.evaluate(data => new Promise(res => (window as any).term.write('\x1b[?7730h' + data, res)), sixelSequence);
      assert.deepEqual(await getCursor(), [0, Math.ceil(TESTDATA.height/dim.cellHeight)]);
      // moved to right by 10 cells
      await page.evaluate(data => new Promise(res => (window as any).term.write('#'.repeat(10) + data, res)), sixelSequence);
      assert.deepEqual(await getCursor(), [10, Math.ceil(TESTDATA.height/dim.cellHeight) * 2]);
      // moved by 30 cells (+10 prev)
      await page.evaluate(data => new Promise(res => (window as any).term.write('#'.repeat(30) + data, res)), sixelSequence);
      assert.deepEqual(await getCursor(), [10 + 30, Math.ceil(TESTDATA.height/dim.cellHeight) * 3]);
    });
  });

  describe('image lifecycle', () => {
    it('should delete image once scrolled off', async () => {
      const sixelSequence = introducer(0) + TESTDATA.sixel + FINALIZER;
      await page.evaluate(data => new Promise(res => (window as any).term.write(data, res)), sixelSequence);
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
