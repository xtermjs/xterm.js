/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test from '@playwright/test';
import { readFileSync } from 'fs';
import { ITestContext, createTestContext, openTerminal, timeout } from '../../../test/playwright/TestUtils';
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

interface IDimensions {
  cellWidth: number;
  cellHeight: number;
  width: number;
  height: number;
}

// Kitty graphics test images
const KITTY_BLACK_1X1_BASE64 = readFileSync('./addons/addon-image/fixture/kitty/black-1x1.png').toString('base64');
const KITTY_BLACK_1X1_BYTES = Array.from(readFileSync('./addons/addon-image/fixture/kitty/black-1x1.png'));
const KITTY_RGB_3X1_BASE64 = readFileSync('./addons/addon-image/fixture/kitty/rgb-3x1.png').toString('base64');

// Raw RGB pixel data (f=24): 3 bytes per pixel, no header — requires s= and v=
const RAW_RGB_1X1_BLACK = Buffer.from([0, 0, 0]).toString('base64');
const RAW_RGB_1X1_RED = Buffer.from([255, 0, 0]).toString('base64');
const RAW_RGB_3X1 = Buffer.from([
  255, 0, 0,
  0, 255, 0,
  0, 0, 255
]).toString('base64');
const RAW_RGB_2X2 = Buffer.from([
  255, 0, 0,    0, 255, 0,
  0, 0, 255,    255, 255, 0
]).toString('base64');

// Raw RGBA pixel data (f=32): 4 bytes per pixel, no header — requires s= and v=
const RAW_RGBA_1X1_WHITE = Buffer.from([255, 255, 255, 255]).toString('base64');
const RAW_RGBA_1X1_RED = Buffer.from([255, 0, 0, 255]).toString('base64');
const RAW_RGBA_1X1_TRANSPARENT = Buffer.from([0, 0, 0, 0]).toString('base64');
const RAW_RGBA_3X1 = Buffer.from([
  255, 0, 0, 255,
  0, 255, 0, 255,
  0, 0, 255, 255
]).toString('base64');
const RAW_RGBA_2X2 = Buffer.from([
  255, 0, 0, 255,    0, 255, 0, 255,
  0, 0, 255, 255,    255, 255, 0, 255
]).toString('base64');

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx, { cols: 80, rows: 24 });
});
test.afterAll(async () => await ctx.page.close());

test.describe('Kitty Graphics Protocol', () => {
  // TODO: Add tests for larger images with various dimensions
  // TODO: Add tests for image placement keys (x, y, w, h, X, Y, c, r)
  // TODO: Add tests for virtual placement (U=1)
  // TODO: Add tests for animation frames
  // TODO: Add performance tests for streaming large images
  // TODO: Implement cursor movement per Kitty spec - cursor should move by cols/rows after placement (unless C=1)

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

  test.describe('Basic transmission and storage', () => {
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
  });

  test.describe('Chunked transmission', () => {
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

      const storedData = await ctx.page.evaluate(async () => {
        const blob = (window as any).imageAddon._handlers.get('kitty').images.get(99).data;
        const buffer = await blob.arrayBuffer();
        return Array.from(new Uint8Array(buffer));
      });
      deepStrictEqual(storedData, KITTY_BLACK_1X1_BYTES);
    });

    test('enforces size limit across chunked transmissions', async () => {
      // Create a custom addon with very small size limit (100 bytes)
      // The 1x1 PNG is ~164 bytes base64, so 2 chunks should exceed 100
      await ctx.page.evaluate(() => {
        (window as any).smallLimitAddon = new ImageAddon({
          kittySupport: true,
          kittySizeLimit: 100  // Very small limit
        });
        (window as any).term.loadAddon((window as any).smallLimitAddon);
      });

      // Split the base64 data into two chunks
      const half = Math.floor(KITTY_BLACK_1X1_BASE64.length / 2);
      const part1 = KITTY_BLACK_1X1_BASE64.substring(0, half);
      const part2 = KITTY_BLACK_1X1_BASE64.substring(half);

      // Send chunked data - first chunk (~82 bytes) is under limit
      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=777,m=1;${part1}\x1b\\`);
      await timeout(50);

      // Second chunk brings total to ~164 bytes, exceeding 100 byte limit
      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=777;${part2}\x1b\\`);
      await timeout(100);

      // Image should NOT be stored due to size limit
      strictEqual(await ctx.page.evaluate(`window.smallLimitAddon._handlers.get('kitty').images.has(777)`), false);

      // Cleanup
      await ctx.page.evaluate(() => {
        (window as any).smallLimitAddon.dispose();
      });
    });
  });

  test.describe('Delete commands', () => {
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

    test('delete by id aborts in-flight chunked upload', async () => {
      const half = Math.floor(KITTY_BLACK_1X1_BASE64.length / 2);
      const part1 = KITTY_BLACK_1X1_BASE64.substring(0, half);

      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=50,m=1;${part1}\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').pendingTransmissions.size`), 1);

      await ctx.proxy.write(`\x1b_Ga=d,i=50\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').pendingTransmissions.size`), 0);
    });

    test('delete by id only aborts targeted upload, not others', async () => {
      const half = Math.floor(KITTY_BLACK_1X1_BASE64.length / 2);
      const part1 = KITTY_BLACK_1X1_BASE64.substring(0, half);

      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=55,m=1;${part1}\x1b\\`);
      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=56,m=1;${part1}\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').pendingTransmissions.size`), 2);

      await ctx.proxy.write(`\x1b_Ga=d,i=55\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').pendingTransmissions.size`), 1);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').pendingTransmissions.has(56)`), true);
    });

    test('delete all aborts in-flight chunked upload', async () => {
      const half = Math.floor(KITTY_BLACK_1X1_BASE64.length / 2);
      const part1 = KITTY_BLACK_1X1_BASE64.substring(0, half);

      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=60,m=1;${part1}\x1b\\`);
      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=61,m=1;${part1}\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').pendingTransmissions.size`), 2);

      await ctx.proxy.write(`\x1b_Ga=d\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').pendingTransmissions.size`), 0);
    });

    test('chunks sent after delete are not assembled with previous data', async () => {
      const half = Math.floor(KITTY_BLACK_1X1_BASE64.length / 2);
      const part1 = KITTY_BLACK_1X1_BASE64.substring(0, half);
      const part2 = KITTY_BLACK_1X1_BASE64.substring(half);

      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=70,m=1;${part1}\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').pendingTransmissions.size`), 1);

      await ctx.proxy.write(`\x1b_Ga=d\x1b\\`);
      await timeout(50);

      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=70;${part2}\x1b\\`);
      await timeout(100);

      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.has(70)`), true);
      const storedSize: number = await ctx.page.evaluate(async () => {
        const blob = (window as any).imageAddon._handlers.get('kitty').images.get(70).data;
        return blob.size;
      });
      ok(storedSize < KITTY_BLACK_1X1_BYTES.length, 'stored data should be smaller than full image (only second half)');
    });
  });

  test.describe('Query support (a=q)', () => {
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

    test('responds with EINVAL when both i and I keys are specified', async () => {
      let response = '';
      await ctx.page.evaluate(() => {
        (window as any).kittyResponse = '';
        (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
      });

      // Per spec: "Specifying both i and I keys in any command is an error"
      await ctx.proxy.write(`\x1b_Gi=100,I=200,a=q,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      response = await ctx.page.evaluate('window.kittyResponse');
      strictEqual(response, '\x1b_Gi=100;EINVAL:cannot specify both i and I keys\x1b\\');
    });

    test('responds with EINVAL for i+I conflict even without payload', async () => {
      let response = '';
      await ctx.page.evaluate(() => {
        (window as any).kittyResponse = '';
        (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
      });

      // Delete command with both i and I (no payload case)
      await ctx.proxy.write('\x1b_Gi=101,I=201,a=d\x1b\\');
      await timeout(100);

      response = await ctx.page.evaluate('window.kittyResponse');
      strictEqual(response, '\x1b_Gi=101;EINVAL:cannot specify both i and I keys\x1b\\');
    });
  });

  test.describe('Cursor positioning', () => {
    // NOTE: Current tests document ACTUAL behavior (MVP - cursor doesn't move)
    // Per Kitty spec: cursor placed at first column after last image column,
    // on the last row of the image. C=1 means don't move cursor.

    test('cursor advances past 1x1 image', async () => {
      const cursorBefore = await getCursor();
      const seq = `\x1b_Ga=T,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`;
      await ctx.proxy.write(seq);
      await timeout(100);
      const cursorAfter = await getCursor();
      deepStrictEqual(cursorBefore, [0, 0]);
      // 1x1 pixel image occupies 1 column, cursor advances past it
      deepStrictEqual(cursorAfter, [1, 0]);
    });

    test('cursor advances with text before image', async () => {
      await ctx.proxy.write('Hello');
      deepStrictEqual(await getCursor(), [5, 0]);

      await ctx.proxy.write(`\x1b_Ga=T,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      // Cursor advances 1 column past the image
      deepStrictEqual(await getCursor(), [6, 0]);
    });

    test('cursor advances with text after image', async () => {
      await ctx.proxy.write(`\x1b_Ga=T,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);
      // Cursor at column 1 (past 1-col image)
      deepStrictEqual(await getCursor(), [1, 0]);

      await ctx.proxy.write('World');
      deepStrictEqual(await getCursor(), [6, 0]);
    });

    test('cursor position with multiple images on same line', async () => {
      await ctx.proxy.write(`\x1b_Ga=T,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(50);
      deepStrictEqual(await getCursor(), [1, 0]);

      await ctx.proxy.write('###');
      deepStrictEqual(await getCursor(), [4, 0]);

      // 3x1 pixel image: ceil(3/cellWidth)=1 column
      await ctx.proxy.write(`\x1b_Ga=T,f=100;${KITTY_RGB_3X1_BASE64}\x1b\\`);
      await timeout(50);
      deepStrictEqual(await getCursor(), [5, 0]);
    });

    test('cursor advances on newline after image', async () => {
      await ctx.proxy.write(`\x1b_Ga=T,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);
      deepStrictEqual(await getCursor(), [1, 0]);

      await ctx.proxy.write('\n');
      deepStrictEqual(await getCursor(), [1, 1]);
    });

    test('cursor should move right by cols when c specified', async () => {
      // c=5: image displayed over 5 columns, r auto = ceil(1/cellHeight) = 1
      await ctx.proxy.write(`\x1b_Ga=T,f=100,c=5;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      deepStrictEqual(await getCursor(), [5, 0]);
    });

    test('cursor should move down by rows when r specified', async () => {
      // r=3: image displayed over 3 rows, c auto = ceil(1/cellWidth) = 1
      await ctx.proxy.write(`\x1b_Ga=T,f=100,r=3;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      // Cursor at first column after image (col 1), on last row (row 2)
      deepStrictEqual(await getCursor(), [1, 2]);
    });

    test('cursor should move by cols AND rows when both specified', async () => {
      await ctx.proxy.write(`\x1b_Ga=T,f=100,c=4,r=2;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      // cursor at (4, 1): past 4 columns, on last row (row 1)
      deepStrictEqual(await getCursor(), [4, 1]);
    });

    test('cursor should NOT move when C=1 is specified', async () => {
      await ctx.proxy.write(`\x1b_Ga=T,f=100,c=5,r=3,C=1;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      // C=1: cursor stays at origin
      deepStrictEqual(await getCursor(), [0, 0]);
    });

    test('cursor should calculate cols/rows from image size when not specified', async () => {
      const dim = await getDimensions();

      // 3x1 pixel image: cols = ceil(3/cellWidth), rows = ceil(1/cellHeight)
      await ctx.proxy.write(`\x1b_Ga=T,f=100;${KITTY_RGB_3X1_BASE64}\x1b\\`);
      await timeout(100);

      const expectedCols = Math.ceil(3 / dim.cellWidth);
      const cursor = await getCursor();

      // Cursor advances past image columns, stays on row 0 (single row image)
      strictEqual(cursor[0], expectedCols, 'cursor should advance by image columns');
      strictEqual(cursor[1], 0, 'cursor should stay on row 0 for single-row image');
    });
  });

  test.describe('Pixel verification', () => {
    test('renders 1x1 black PNG at cursor position', async () => {
      const seq = `\x1b_Ga=T,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`;
      await ctx.proxy.write(seq);
      await timeout(100);

      deepStrictEqual(await getPixel(0, 0, 0, 0), [0, 0, 0, 255]);
    });

    test('renders 3x1 RGB PNG (red, green, blue pixels)', async () => {
      const seq = `\x1b_Ga=T,f=100;${KITTY_RGB_3X1_BASE64}\x1b\\`;
      await ctx.proxy.write(seq);
      await timeout(100);

      const pixels = await getPixels(0, 0, 0, 0, 3, 1);

      deepStrictEqual(pixels?.slice(0, 4), [255, 0, 0, 255]);
      deepStrictEqual(pixels?.slice(4, 8), [0, 255, 0, 255]);
      deepStrictEqual(pixels?.slice(8, 12), [0, 0, 255, 255]);
    });
  });

  test.describe('Raw RGB pixel format (f=24)', () => {
    test.describe('Pixel verification', () => {
      test('renders 1x1 black pixel with alpha set to 255', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=24,s=1,v=1;${RAW_RGB_1X1_BLACK}\x1b\\`);
        await timeout(100);
        deepStrictEqual(await getPixel(0, 0, 0, 0), [0, 0, 0, 255]);
      });

      test('renders 1x1 red pixel with alpha set to 255', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=24,s=1,v=1;${RAW_RGB_1X1_RED}\x1b\\`);
        await timeout(100);
        deepStrictEqual(await getPixel(0, 0, 0, 0), [255, 0, 0, 255]);
      });

      test('renders 3x1 strip (red, green, blue)', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=24,s=3,v=1;${RAW_RGB_3X1}\x1b\\`);
        await timeout(100);

        const pixels = await getPixels(0, 0, 0, 0, 3, 1);
        deepStrictEqual(pixels?.slice(0, 4), [255, 0, 0, 255]);
        deepStrictEqual(pixels?.slice(4, 8), [0, 255, 0, 255]);
        deepStrictEqual(pixels?.slice(8, 12), [0, 0, 255, 255]);
      });

      test('renders 2x2 grid with correct pixel layout', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=24,s=2,v=2;${RAW_RGB_2X2}\x1b\\`);
        await timeout(100);
        deepStrictEqual(await getPixel(0, 0, 0, 0), [255, 0, 0, 255]);
        deepStrictEqual(await getPixel(0, 0, 1, 0), [0, 255, 0, 255]);
        deepStrictEqual(await getPixel(0, 0, 0, 1), [0, 0, 255, 255]);
        deepStrictEqual(await getPixel(0, 0, 1, 1), [255, 255, 0, 255]);
      });
    });

    test.describe('Storage and dimensions', () => {
      test('stores image with correct original dimensions (3x1)', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=24,s=3,v=1;${RAW_RGB_3X1}\x1b\\`);
        await timeout(100);
        strictEqual(await getImageStorageLength(), 1);
        deepStrictEqual(await getOrigSize(1), [3, 1]);
      });

      test('stores image with correct original dimensions (2x2)', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=24,s=2,v=2;${RAW_RGB_2X2}\x1b\\`);
        await timeout(100);
        strictEqual(await getImageStorageLength(), 1);
        deepStrictEqual(await getOrigSize(1), [2, 2]);
      });
    });

    test.describe('Validation', () => {
      test('does not render without width (s=)', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=24,v=1;${RAW_RGB_1X1_BLACK}\x1b\\`);
        await timeout(100);
        strictEqual(await getImageStorageLength(), 0);
      });

      test('does not render without height (v=)', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=24,s=1;${RAW_RGB_1X1_BLACK}\x1b\\`);
        await timeout(100);
        strictEqual(await getImageStorageLength(), 0);
      });

      test('does not render without either dimension', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=24;${RAW_RGB_1X1_BLACK}\x1b\\`);
        await timeout(100);
        strictEqual(await getImageStorageLength(), 0);
      });

      test('does not render with insufficient byte count', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=24,s=2,v=2;${RAW_RGB_1X1_BLACK}\x1b\\`);
        await timeout(100);
        strictEqual(await getImageStorageLength(), 0);
      });

      test('query returns EINVAL without dimensions', async () => {
        await ctx.page.evaluate(() => {
          (window as any).kittyResponse = '';
          (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
        });
        await ctx.proxy.write(`\x1b_Gi=200,a=q,f=24;${RAW_RGB_1X1_BLACK}\x1b\\`);
        await timeout(100);
        const response = await ctx.page.evaluate('window.kittyResponse');
        strictEqual(response, '\x1b_Gi=200;EINVAL:width and height required for raw pixel data\x1b\\');
      });

      test('query returns EINVAL for insufficient pixel data', async () => {
        await ctx.page.evaluate(() => {
          (window as any).kittyResponse = '';
          (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
        });
        await ctx.proxy.write(`\x1b_Gi=201,a=q,f=24,s=2,v=2;${RAW_RGB_1X1_BLACK}\x1b\\`);
        await timeout(100);
        const response = await ctx.page.evaluate('window.kittyResponse');
        strictEqual(response, '\x1b_Gi=201;EINVAL:insufficient pixel data\x1b\\');
      });

      test('query returns OK for valid RGB data with correct dimensions', async () => {
        await ctx.page.evaluate(() => {
          (window as any).kittyResponse = '';
          (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
        });
        await ctx.proxy.write(`\x1b_Gi=202,a=q,f=24,s=1,v=1;${RAW_RGB_1X1_RED}\x1b\\`);
        await timeout(100);
        const response = await ctx.page.evaluate('window.kittyResponse');
        strictEqual(response, '\x1b_Gi=202;OK\x1b\\');
      });
    });
  });

  test.describe('Raw RGBA pixel format (f=32)', () => {
    test.describe('Pixel verification', () => {
      test('renders 1x1 opaque white pixel', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=32,s=1,v=1;${RAW_RGBA_1X1_WHITE}\x1b\\`);
        await timeout(100);
        deepStrictEqual(await getPixel(0, 0, 0, 0), [255, 255, 255, 255]);
      });

      test('renders 1x1 opaque red pixel', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=32,s=1,v=1;${RAW_RGBA_1X1_RED}\x1b\\`);
        await timeout(100);
        deepStrictEqual(await getPixel(0, 0, 0, 0), [255, 0, 0, 255]);
      });

      test('preserves full transparency (alpha=0)', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=32,s=1,v=1;${RAW_RGBA_1X1_TRANSPARENT}\x1b\\`);
        await timeout(100);
        const pixel = await getPixel(0, 0, 0, 0);
        strictEqual(pixel?.[3], 0);
      });

      test('renders 3x1 strip (red, green, blue opaque)', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=32,s=3,v=1;${RAW_RGBA_3X1}\x1b\\`);
        await timeout(100);

        const pixels = await getPixels(0, 0, 0, 0, 3, 1);
        deepStrictEqual(pixels?.slice(0, 4), [255, 0, 0, 255]);
        deepStrictEqual(pixels?.slice(4, 8), [0, 255, 0, 255]);
        deepStrictEqual(pixels?.slice(8, 12), [0, 0, 255, 255]);
      });

      test('renders 2x2 grid with correct pixel layout', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=32,s=2,v=2;${RAW_RGBA_2X2}\x1b\\`);
        await timeout(100);
        deepStrictEqual(await getPixel(0, 0, 0, 0), [255, 0, 0, 255]);
        deepStrictEqual(await getPixel(0, 0, 1, 0), [0, 255, 0, 255]);
        deepStrictEqual(await getPixel(0, 0, 0, 1), [0, 0, 255, 255]);
        deepStrictEqual(await getPixel(0, 0, 1, 1), [255, 255, 0, 255]);
      });
    });

    test.describe('Storage and dimensions', () => {
      test('stores image with correct original dimensions (3x1)', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=32,s=3,v=1;${RAW_RGBA_3X1}\x1b\\`);
        await timeout(100);
        strictEqual(await getImageStorageLength(), 1);
        deepStrictEqual(await getOrigSize(1), [3, 1]);
      });

      test('stores image with correct original dimensions (2x2)', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=32,s=2,v=2;${RAW_RGBA_2X2}\x1b\\`);
        await timeout(100);
        strictEqual(await getImageStorageLength(), 1);
        deepStrictEqual(await getOrigSize(1), [2, 2]);
      });
    });

    test.describe('Validation', () => {
      test('does not render without width (s=)', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=32,v=1;${RAW_RGBA_1X1_RED}\x1b\\`);
        await timeout(100);
        strictEqual(await getImageStorageLength(), 0);
      });

      test('does not render without height (v=)', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=32,s=1;${RAW_RGBA_1X1_RED}\x1b\\`);
        await timeout(100);
        strictEqual(await getImageStorageLength(), 0);
      });

      test('does not render without either dimension', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=32;${RAW_RGBA_1X1_RED}\x1b\\`);
        await timeout(100);
        strictEqual(await getImageStorageLength(), 0);
      });

      test('does not render with insufficient byte count', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=32,s=2,v=2;${RAW_RGBA_1X1_RED}\x1b\\`);
        await timeout(100);
        strictEqual(await getImageStorageLength(), 0);
      });

      test('query returns EINVAL without dimensions', async () => {
        await ctx.page.evaluate(() => {
          (window as any).kittyResponse = '';
          (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
        });
        await ctx.proxy.write(`\x1b_Gi=300,a=q,f=32;${RAW_RGBA_1X1_RED}\x1b\\`);
        await timeout(100);
        const response = await ctx.page.evaluate('window.kittyResponse');
        strictEqual(response, '\x1b_Gi=300;EINVAL:width and height required for raw pixel data\x1b\\');
      });

      test('query returns EINVAL for insufficient pixel data', async () => {
        await ctx.page.evaluate(() => {
          (window as any).kittyResponse = '';
          (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
        });
        await ctx.proxy.write(`\x1b_Gi=301,a=q,f=32,s=2,v=2;${RAW_RGBA_1X1_RED}\x1b\\`);
        await timeout(100);
        const response = await ctx.page.evaluate('window.kittyResponse');
        strictEqual(response, '\x1b_Gi=301;EINVAL:insufficient pixel data\x1b\\');
      });

      test('query returns OK for valid RGBA data with correct dimensions', async () => {
        await ctx.page.evaluate(() => {
          (window as any).kittyResponse = '';
          (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
        });
        await ctx.proxy.write(`\x1b_Gi=302,a=q,f=32,s=1,v=1;${RAW_RGBA_1X1_RED}\x1b\\`);
        await timeout(100);
        const response = await ctx.page.evaluate('window.kittyResponse');
        strictEqual(response, '\x1b_Gi=302;OK\x1b\\');
      });
    });
  });
});

/**
 * Helper functions
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

async function getOrigSize(id: number): Promise<[number, number]> {
  return ctx.page.evaluate<any>(`[
    window.imageAddon._storage._images.get(${id}).orig.width,
    window.imageAddon._storage._images.get(${id}).orig.height
  ]`);
}

async function getPixel(col: number, row: number, x: number, y: number): Promise<number[] | null> {
  return ctx.page.evaluate(([col, row, x, y]: number[]) => {
    const canvas = (window as any).imageAddon.getImageAtBufferCell(col, row);
    if (!canvas) return null;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return null;
    return Array.from(ctx2d.getImageData(x, y, 1, 1).data);
  }, [col, row, x, y]);
}

async function getPixels(col: number, row: number, x: number, y: number, w: number, h: number): Promise<number[] | null> {
  return ctx.page.evaluate(([col, row, x, y, w, h]: number[]) => {
    const canvas = (window as any).imageAddon.getImageAtBufferCell(col, row);
    if (!canvas) return null;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return null;
    return Array.from(ctx2d.getImageData(x, y, w, h).data);
  }, [col, row, x, y, w, h]);
}
