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
const KITTY_MULTICOLOR_200X100_BASE64 = readFileSync('./addons/addon-image/fixture/kitty/multicolor-200x100.png').toString('base64');
const KITTY_MULTICOLOR_200X100_BYTES = Array.from(readFileSync('./addons/addon-image/fixture/kitty/multicolor-200x100.png'));

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
  // TODO: Distinguish lowercase delete selectors (placement only) from uppercase (placement + free data)

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
    test('delete command (a=d,d=i) removes specific image by id', async () => {
      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=10;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.size`), 1);

      await ctx.proxy.write(`\x1b_Ga=d,d=i,i=10\x1b\\`);
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

      await ctx.proxy.write(`\x1b_Ga=d,d=i,i=50\x1b\\`);
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

      await ctx.proxy.write(`\x1b_Ga=d,d=i,i=55\x1b\\`);
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

    test('d=i selector deletes specific image by id', async () => {
      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=80;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=81;${KITTY_RGB_3X1_BASE64}\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.size`), 2);

      await ctx.proxy.write(`\x1b_Ga=d,d=i,i=80\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.size`), 1);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.has(81)`), true);
    });

    test('d=I selector deletes specific image by id (uppercase)', async () => {
      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=82;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=83;${KITTY_RGB_3X1_BASE64}\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.size`), 2);

      await ctx.proxy.write(`\x1b_Ga=d,d=I,i=82\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.size`), 1);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.has(83)`), true);
    });

    test('d=a selector deletes all images', async () => {
      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=84;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=85;${KITTY_RGB_3X1_BASE64}\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.size`), 2);

      await ctx.proxy.write(`\x1b_Ga=d,d=a\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.size`), 0);
    });

    test('d=A selector deletes all images (uppercase)', async () => {
      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=86;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=87;${KITTY_RGB_3X1_BASE64}\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.size`), 2);

      await ctx.proxy.write(`\x1b_Ga=d,d=A\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.size`), 0);
    });

    test('d=a selector also removes displayed images from storage', async () => {
      await ctx.proxy.write(`\x1b_Ga=T,f=100,i=88;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);
      strictEqual(await getImageStorageLength(), 1);

      await ctx.proxy.write(`\x1b_Ga=d,d=a\x1b\\`);
      await timeout(50);
      strictEqual(await getImageStorageLength(), 0);
    });

    test('d=i selector also removes displayed image from storage', async () => {
      await ctx.proxy.write(`\x1b_Ga=T,f=100,i=89;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);
      strictEqual(await getImageStorageLength(), 1);

      await ctx.proxy.write(`\x1b_Ga=d,d=i,i=89\x1b\\`);
      await timeout(50);
      strictEqual(await getImageStorageLength(), 0);
    });

    test('d=i without id does nothing', async () => {
      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=90;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.size`), 1);

      await ctx.proxy.write(`\x1b_Ga=d,d=i\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.size`), 1);
    });

    test('d=i selector clears pixels from canvas', async () => {
      await ctx.proxy.write(`\x1b_Ga=T,f=100,i=92,q=1;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);
      deepStrictEqual(await getPixel(0, 0, 0, 0), [0, 0, 0, 255]);

      await ctx.proxy.write(`\x1b_Ga=d,d=i,i=92\x1b\\`);
      await timeout(100);
      strictEqual(await getPixel(0, 0, 0, 0), null);
    });

    test('d=a selector clears all pixels from canvas', async () => {
      await ctx.proxy.write(`\x1b_Ga=T,f=100,i=93,q=1;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);
      deepStrictEqual(await getPixel(0, 0, 0, 0), [0, 0, 0, 255]);

      await ctx.proxy.write(`\x1b_Ga=d,d=a\x1b\\`);
      await timeout(100);
      strictEqual(await getPixel(0, 0, 0, 0), null);
    });

    test('unsupported delete selector is ignored', async () => {
      await ctx.proxy.write(`\x1b_Ga=t,f=100,i=91;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.size`), 1);

      await ctx.proxy.write(`\x1b_Ga=d,d=c\x1b\\`);
      await timeout(50);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.size`), 1);
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

  test.describe('Error responses for transmit and display', () => {
    test('a=t sends EINVAL on decode error when id is specified', async () => {
      await ctx.page.evaluate(() => {
        (window as any).kittyResponse = '';
        (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
      });

      await ctx.proxy.write('\x1b_Gi=110,a=t,f=100;!!!invalid!!!\x1b\\');
      await timeout(100);

      const response = await ctx.page.evaluate('window.kittyResponse');
      strictEqual(response, '\x1b_Gi=110;EINVAL:invalid base64 data\x1b\\');
    });

    test('a=t sends no response on decode error without id', async () => {
      await ctx.page.evaluate(() => {
        (window as any).kittyGotResponse = false;
        (window as any).term.onData(() => { (window as any).kittyGotResponse = true; });
      });

      await ctx.proxy.write('\x1b_Ga=t,f=100;!!!invalid!!!\x1b\\');
      await timeout(100);

      strictEqual(await ctx.page.evaluate('window.kittyGotResponse'), false);
    });

    test('a=T sends EINVAL on decode error when id is specified', async () => {
      await ctx.page.evaluate(() => {
        (window as any).kittyResponse = '';
        (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
      });

      await ctx.proxy.write('\x1b_Gi=120,a=T,f=100;!!!invalid!!!\x1b\\');
      await timeout(100);

      const response = await ctx.page.evaluate('window.kittyResponse');
      strictEqual(response, '\x1b_Gi=120;EINVAL:invalid base64 data\x1b\\');
    });

    test('a=T sends no response on decode error without id', async () => {
      await ctx.page.evaluate(() => {
        (window as any).kittyGotResponse = false;
        (window as any).term.onData(() => { (window as any).kittyGotResponse = true; });
      });

      await ctx.proxy.write('\x1b_Ga=T,f=100;!!!invalid!!!\x1b\\');
      await timeout(100);

      strictEqual(await ctx.page.evaluate('window.kittyGotResponse'), false);
    });

    test('a=T sends EINVAL when raw pixel render fails (missing dimensions)', async () => {
      await ctx.page.evaluate(() => {
        (window as any).kittyResponse = '';
        (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
      });

      await ctx.proxy.write(`\x1b_Gi=130,a=T,f=24;${RAW_RGB_1X1_BLACK}\x1b\\`);
      await timeout(100);

      const response: string = await ctx.page.evaluate('window.kittyResponse');
      strictEqual(response.startsWith('\x1b_Gi=130;EINVAL:'), true);
    });

    test('a=T sends OK on successful render with id', async () => {
      await ctx.page.evaluate(() => {
        (window as any).kittyResponse = '';
        (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
      });

      await ctx.proxy.write(`\x1b_Gi=140,a=T,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      const response = await ctx.page.evaluate('window.kittyResponse');
      strictEqual(response, '\x1b_Gi=140;OK\x1b\\');
    });

    test('a=t sends OK on successful transmit with id', async () => {
      await ctx.page.evaluate(() => {
        (window as any).kittyResponse = '';
        (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
      });

      await ctx.proxy.write(`\x1b_Gi=150,a=t,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      const response = await ctx.page.evaluate('window.kittyResponse');
      strictEqual(response, '\x1b_Gi=150;OK\x1b\\');
    });

    test('a=t EINVAL suppressed by q=2', async () => {
      await ctx.page.evaluate(() => {
        (window as any).kittyGotResponse = false;
        (window as any).term.onData(() => { (window as any).kittyGotResponse = true; });
      });

      await ctx.proxy.write('\x1b_Gi=160,a=t,q=2,f=100;!!!invalid!!!\x1b\\');
      await timeout(100);

      strictEqual(await ctx.page.evaluate('window.kittyGotResponse'), false);
    });

    test('a=T EINVAL suppressed by q=2', async () => {
      await ctx.page.evaluate(() => {
        (window as any).kittyGotResponse = false;
        (window as any).term.onData(() => { (window as any).kittyGotResponse = true; });
      });

      await ctx.proxy.write('\x1b_Gi=170,a=T,q=2,f=100;!!!invalid!!!\x1b\\');
      await timeout(100);

      strictEqual(await ctx.page.evaluate('window.kittyGotResponse'), false);
    });

    test('a=t OK suppressed by q=1', async () => {
      await ctx.page.evaluate(() => {
        (window as any).kittyGotResponse = false;
        (window as any).term.onData(() => { (window as any).kittyGotResponse = true; });
      });

      await ctx.proxy.write(`\x1b_Gi=180,a=t,q=1,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      strictEqual(await ctx.page.evaluate('window.kittyGotResponse'), false);
    });

    test('a=T OK suppressed by q=1', async () => {
      await ctx.page.evaluate(() => {
        (window as any).kittyGotResponse = false;
        (window as any).term.onData(() => { (window as any).kittyGotResponse = true; });
      });

      await ctx.proxy.write(`\x1b_Gi=190,a=T,q=1,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      strictEqual(await ctx.page.evaluate('window.kittyGotResponse'), false);
    });
  });

  test.describe('Transmission medium rejection', () => {
    test('query rejects t=f (file transmission)', async () => {
      await ctx.page.evaluate(() => {
        (window as any).kittyResponse = '';
        (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
      });

      await ctx.proxy.write(`\x1b_Gi=200,a=q,t=f,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      const response: string = await ctx.page.evaluate('window.kittyResponse');
      strictEqual(response.startsWith('\x1b_Gi=200;EINVAL:'), true);
    });

    test('query rejects t=s (shared memory)', async () => {
      await ctx.page.evaluate(() => {
        (window as any).kittyResponse = '';
        (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
      });

      await ctx.proxy.write(`\x1b_Gi=201,a=q,t=s,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      const response: string = await ctx.page.evaluate('window.kittyResponse');
      strictEqual(response.startsWith('\x1b_Gi=201;EINVAL:'), true);
    });

    test('query rejects t=t (temp file)', async () => {
      await ctx.page.evaluate(() => {
        (window as any).kittyResponse = '';
        (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
      });

      await ctx.proxy.write(`\x1b_Gi=202,a=q,t=t,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      const response: string = await ctx.page.evaluate('window.kittyResponse');
      strictEqual(response.startsWith('\x1b_Gi=202;EINVAL:'), true);
    });

    test('query accepts t=d (direct transmission)', async () => {
      await ctx.page.evaluate(() => {
        (window as any).kittyResponse = '';
        (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
      });

      await ctx.proxy.write(`\x1b_Gi=203,a=q,t=d,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      const response = await ctx.page.evaluate('window.kittyResponse');
      strictEqual(response, '\x1b_Gi=203;OK\x1b\\');
    });

    test('query without t key defaults to direct (OK)', async () => {
      await ctx.page.evaluate(() => {
        (window as any).kittyResponse = '';
        (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
      });

      await ctx.proxy.write(`\x1b_Gi=204,a=q,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      const response = await ctx.page.evaluate('window.kittyResponse');
      strictEqual(response, '\x1b_Gi=204;OK\x1b\\');
    });
  });

  test.describe('Unimplemented action responses', () => {
    test('a=p with id responds EINVAL', async () => {
      await ctx.page.evaluate(() => {
        (window as any).kittyResponse = '';
        (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
      });

      await ctx.proxy.write(`\x1b_Gi=210,a=p\x1b\\`);
      await timeout(100);

      const response: string = await ctx.page.evaluate('window.kittyResponse');
      strictEqual(response.startsWith('\x1b_Gi=210;EINVAL:'), true);
    });

    test('a=p without id sends no response', async () => {
      await ctx.page.evaluate(() => {
        (window as any).kittyGotResponse = false;
        (window as any).term.onData(() => { (window as any).kittyGotResponse = true; });
      });

      await ctx.proxy.write(`\x1b_Ga=p\x1b\\`);
      await timeout(100);

      strictEqual(await ctx.page.evaluate('window.kittyGotResponse'), false);
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

  test.describe('Z-index layer placement', () => {
    test('default placement (no z key) stores image on top layer', async () => {
      await ctx.proxy.write(`\x1b_Ga=T,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);
      strictEqual(await getImageStorageLength(), 1);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._storage._images.get(1).layer`), 'top');
      strictEqual(await ctx.page.evaluate(`window.imageAddon._storage._images.get(1).zIndex`), 0);
    });

    test('z=0 stores image on top layer', async () => {
      await ctx.proxy.write(`\x1b_Ga=T,f=100,z=0;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);
      strictEqual(await getImageStorageLength(), 1);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._storage._images.get(1).layer`), 'top');
      strictEqual(await ctx.page.evaluate(`window.imageAddon._storage._images.get(1).zIndex`), 0);
    });

    test('z=1 (positive) stores image on top layer', async () => {
      await ctx.proxy.write(`\x1b_Ga=T,f=100,z=1;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);
      strictEqual(await getImageStorageLength(), 1);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._storage._images.get(1).layer`), 'top');
      strictEqual(await ctx.page.evaluate(`window.imageAddon._storage._images.get(1).zIndex`), 1);
    });

    test('z=-1 falls back to top layer when allowTransparency is disabled', async () => {
      await ctx.page.evaluate(`window.term.options.allowTransparency = false`);
      await ctx.proxy.write(`\x1b_Ga=T,f=100,z=-1;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);
      strictEqual(await getImageStorageLength(), 1);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._storage._images.get(1).layer`), 'top');
      strictEqual(await ctx.page.evaluate(`window.imageAddon._storage._images.get(1).zIndex`), -1);
    });

    test('z=-1 (negative) stores image on bottom layer when allowTransparency is enabled', async () => {
      await ctx.page.evaluate(`window.term.options.allowTransparency = true`);
      await ctx.proxy.write(`\x1b_Ga=T,f=100,z=-1;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);
      strictEqual(await getImageStorageLength(), 1);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._storage._images.get(1).layer`), 'bottom');
      strictEqual(await ctx.page.evaluate(`window.imageAddon._storage._images.get(1).zIndex`), -1);
    });

    test('z=-100 (large negative) stores image on bottom layer when allowTransparency is enabled', async () => {
      await ctx.page.evaluate(`window.term.options.allowTransparency = true`);
      await ctx.proxy.write(`\x1b_Ga=T,f=100,z=-100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);
      strictEqual(await getImageStorageLength(), 1);
      strictEqual(await ctx.page.evaluate(`window.imageAddon._storage._images.get(1).layer`), 'bottom');
      strictEqual(await ctx.page.evaluate(`window.imageAddon._storage._images.get(1).zIndex`), -100);
    });

    test('top layer canvas has correct CSS class', async () => {
      await ctx.proxy.write(`\x1b_Ga=T,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);
      const hasClass = await ctx.page.evaluate(() => {
        const el = document.querySelector('.xterm-image-layer-top');
        return el !== null;
      });
      strictEqual(hasClass, true);
    });

    test('bottom layer canvas has correct CSS class', async () => {
      await ctx.page.evaluate(`window.term.options.allowTransparency = true`);
      await ctx.proxy.write(`\x1b_Ga=T,f=100,z=-1;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);
      const hasClass = await ctx.page.evaluate(() => {
        const el = document.querySelector('.xterm-image-layer-bottom');
        return el !== null;
      });
      strictEqual(hasClass, true);
    });

    test('bottom layer canvas is before text canvas in DOM order', async () => {
      await ctx.page.evaluate(`window.term.options.allowTransparency = true`);
      await ctx.proxy.write(`\x1b_Ga=T,f=100,z=-1;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);
      const isFirst = await ctx.page.evaluate(() => {
        const screen = document.querySelector('.xterm-screen');
        return screen?.firstElementChild?.classList.contains('xterm-image-layer-bottom') ?? false;
      });
      strictEqual(isFirst, true);
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

  test.describe('Larger image (200x100 multicolor PNG)', () => {
    test.describe('Basic transmission and storage', () => {
      test('stores 200x100 PNG with a=T', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=100;${KITTY_MULTICOLOR_200X100_BASE64}\x1b\\`);
        await timeout(200);
        strictEqual(await getImageStorageLength(), 1);
        deepStrictEqual(await getOrigSize(1), [200, 100]);
      });

      test('transmit only (a=t) stores 200x100 image without display', async () => {
        await ctx.proxy.write(`\x1b_Ga=t,f=100;${KITTY_MULTICOLOR_200X100_BASE64}\x1b\\`);
        await timeout(200);
        strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.size`), 1);
      });

      test('stores with specified image ID', async () => {
        await ctx.proxy.write(`\x1b_Ga=t,f=100,i=400;${KITTY_MULTICOLOR_200X100_BASE64}\x1b\\`);
        await timeout(200);
        strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.has(400)`), true);
      });
    });

    test.describe('Chunked transmission', () => {
      test('handles 2-chunk transmission', async () => {
        const half = Math.floor(KITTY_MULTICOLOR_200X100_BASE64.length / 2);
        const part1 = KITTY_MULTICOLOR_200X100_BASE64.substring(0, half);
        const part2 = KITTY_MULTICOLOR_200X100_BASE64.substring(half);

        await ctx.proxy.write(`\x1b_Ga=T,f=100,i=500,m=1;${part1}\x1b\\`);
        await timeout(50);
        strictEqual(await getImageStorageLength(), 0);

        await ctx.proxy.write(`\x1b_Ga=T,f=100,i=500;${part2}\x1b\\`);
        await timeout(200);
        strictEqual(await getImageStorageLength(), 1);
        deepStrictEqual(await getOrigSize(1), [200, 100]);
      });

      test('handles 3-chunk transmission', async () => {
        const third = Math.floor(KITTY_MULTICOLOR_200X100_BASE64.length / 3);
        const p1 = KITTY_MULTICOLOR_200X100_BASE64.substring(0, third);
        const p2 = KITTY_MULTICOLOR_200X100_BASE64.substring(third, third * 2);
        const p3 = KITTY_MULTICOLOR_200X100_BASE64.substring(third * 2);

        await ctx.proxy.write(`\x1b_Ga=T,f=100,i=501,m=1;${p1}\x1b\\`);
        await timeout(50);
        await ctx.proxy.write(`\x1b_Ga=T,f=100,i=501,m=1;${p2}\x1b\\`);
        await timeout(50);
        await ctx.proxy.write(`\x1b_Ga=T,f=100,i=501;${p3}\x1b\\`);
        await timeout(200);
        strictEqual(await getImageStorageLength(), 1);
        deepStrictEqual(await getOrigSize(1), [200, 100]);
      });

      test('verifies chunked data assembles correctly', async () => {
        const half = Math.floor(KITTY_MULTICOLOR_200X100_BASE64.length / 2);
        const part1 = KITTY_MULTICOLOR_200X100_BASE64.substring(0, half);
        const part2 = KITTY_MULTICOLOR_200X100_BASE64.substring(half);

        await ctx.proxy.write(`\x1b_Ga=t,f=100,i=502,m=1;${part1}\x1b\\`);
        await ctx.proxy.write(`\x1b_Ga=t,f=100,i=502;${part2}\x1b\\`);
        await timeout(200);

        const storedData = await ctx.page.evaluate(async () => {
          const blob = (window as any).imageAddon._handlers.get('kitty').images.get(502).data;
          const buffer = await blob.arrayBuffer();
          return Array.from(new Uint8Array(buffer));
        });
        deepStrictEqual(storedData, KITTY_MULTICOLOR_200X100_BYTES);
      });
    });

    test.describe('Cursor positioning', () => {
      test('cursor advances past multi-cell image', async () => {
        const dim = await getDimensions();
        await ctx.proxy.write(`\x1b_Ga=T,f=100;${KITTY_MULTICOLOR_200X100_BASE64}\x1b\\`);
        await timeout(200);

        const expectedCols = Math.ceil(200 / dim.cellWidth);
        const expectedRows = Math.ceil(100 / dim.cellHeight) - 1;
        const cursor = await getCursor();
        strictEqual(cursor[0], expectedCols, 'cursor should advance by image columns');
        strictEqual(cursor[1], expectedRows, 'cursor should be on last row of image');
      });

      test('cursor does not move with C=1', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=100,C=1;${KITTY_MULTICOLOR_200X100_BASE64}\x1b\\`);
        await timeout(200);
        deepStrictEqual(await getCursor(), [0, 0]);
      });

      test('cursor uses explicit c and r over image dimensions', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=100,c=10,r=5;${KITTY_MULTICOLOR_200X100_BASE64}\x1b\\`);
        await timeout(200);
        deepStrictEqual(await getCursor(), [10, 4]);
      });
    });

    test.describe('Pixel verification', () => {
      // The 200x100 image has 20 colored rectangles in a 10x2 grid.
      // Each rectangle is 20px wide x 50px tall.
      // Top row (y=0..49):  Red, Orange, Yellow, Lime, Green, Cyan, SkyBlue, Blue, Purple, Magenta
      // Bottom row (y=50..99): Pink, Brown, Maroon, Olive, Teal, Navy, Gray, DarkGray, LightGray, White

      test('renders red rectangle at top-left origin (0,0)', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=100;${KITTY_MULTICOLOR_200X100_BASE64}\x1b\\`);
        await timeout(200);
        // Pixel (0,0) is in the first rectangle: Red
        deepStrictEqual(await getPixel(0, 0, 0, 0), [255, 0, 0, 255]);
      });

      test('renders top row colors at rectangle centers', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=100;${KITTY_MULTICOLOR_200X100_BASE64}\x1b\\`);
        await timeout(200);

        // Sample center of each top-row rectangle (y=25, x=10,30,50,...,190)
        // All within the first cell row, so we read from the canvas at cell (0,0)
        // Red at x=10
        deepStrictEqual(await getPixel(0, 0, 10, 25), [255, 0, 0, 255]);
        // Orange at x=30
        deepStrictEqual(await getPixel(0, 0, 30, 25), [255, 128, 0, 255]);
        // Yellow at x=50
        deepStrictEqual(await getPixel(0, 0, 50, 25), [255, 255, 0, 255]);
        // Lime at x=70
        deepStrictEqual(await getPixel(0, 0, 70, 25), [0, 255, 0, 255]);
        // Green at x=90
        deepStrictEqual(await getPixel(0, 0, 90, 25), [0, 128, 0, 255]);
      });

      test('renders bottom row colors at rectangle centers', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=100;${KITTY_MULTICOLOR_200X100_BASE64}\x1b\\`);
        await timeout(200);

        // Bottom row starts at y=50. Center at y=75.
        // Pink at x=10
        deepStrictEqual(await getPixel(0, 0, 10, 75), [255, 192, 203, 255]);
        // Brown at x=30
        deepStrictEqual(await getPixel(0, 0, 30, 75), [165, 42, 42, 255]);
        // Maroon at x=50
        deepStrictEqual(await getPixel(0, 0, 50, 75), [128, 0, 0, 255]);
        // Olive at x=70
        deepStrictEqual(await getPixel(0, 0, 70, 75), [128, 128, 0, 255]);
        // Teal at x=90
        deepStrictEqual(await getPixel(0, 0, 90, 75), [0, 128, 128, 255]);
      });

      test('renders correct colors at rectangle boundaries', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=100;${KITTY_MULTICOLOR_200X100_BASE64}\x1b\\`);
        await timeout(200);

        // Last pixel of first rectangle (x=19, y=0): still Red
        deepStrictEqual(await getPixel(0, 0, 19, 0), [255, 0, 0, 255]);
        // First pixel of second rectangle (x=20, y=0): Orange
        deepStrictEqual(await getPixel(0, 0, 20, 0), [255, 128, 0, 255]);
        // Last pixel of top row (x=199, y=49): Magenta
        deepStrictEqual(await getPixel(0, 0, 199, 49), [255, 0, 255, 255]);
        // First pixel of bottom row (x=0, y=50): Pink
        deepStrictEqual(await getPixel(0, 0, 0, 50), [255, 192, 203, 255]);
      });

      test('renders correct color at bottom-right corner', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=100;${KITTY_MULTICOLOR_200X100_BASE64}\x1b\\`);
        await timeout(200);

        // Bottom-right corner (x=199, y=99): White
        deepStrictEqual(await getPixel(0, 0, 199, 99), [255, 255, 255, 255]);
      });

      test('renders a strip of top-row pixels via getPixels', async () => {
        await ctx.proxy.write(`\x1b_Ga=T,f=100;${KITTY_MULTICOLOR_200X100_BASE64}\x1b\\`);
        await timeout(200);

        // Read 3 pixels starting at x=18 y=0, spanning the Red/Orange boundary
        const pixels = await getPixels(0, 0, 18, 0, 3, 1);
        // x=18,19 -> Red; x=20 -> Orange
        deepStrictEqual(pixels?.slice(0, 4), [255, 0, 0, 255]);     // x=18: Red
        deepStrictEqual(pixels?.slice(4, 8), [255, 0, 0, 255]);     // x=19: Red
        deepStrictEqual(pixels?.slice(8, 12), [255, 128, 0, 255]);  // x=20: Orange
      });
    });

    test.describe('Query support', () => {
      test('responds with OK for valid 200x100 PNG query', async () => {
        await ctx.page.evaluate(() => {
          (window as any).kittyResponse = '';
          (window as any).term.onData((data: string) => { (window as any).kittyResponse = data; });
        });

        await ctx.proxy.write(`\x1b_Gi=600,a=q,f=100;${KITTY_MULTICOLOR_200X100_BASE64}\x1b\\`);
        await timeout(200);

        const response = await ctx.page.evaluate('window.kittyResponse');
        strictEqual(response, '\x1b_Gi=600;OK\x1b\\');
      });

      test('query does not store the 200x100 image', async () => {
        await ctx.page.evaluate(() => {
          (window as any).term.onData(() => { /* consume response */ });
        });

        await ctx.proxy.write(`\x1b_Gi=601,a=q,f=100;${KITTY_MULTICOLOR_200X100_BASE64}\x1b\\`);
        await timeout(200);
        strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.has(601)`), false);
      });
    });

    test.describe('Delete commands', () => {
      test('delete removes 200x100 image by id', async () => {
        await ctx.proxy.write(`\x1b_Ga=t,f=100,i=700;${KITTY_MULTICOLOR_200X100_BASE64}\x1b\\`);
        await timeout(200);
        strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.has(700)`), true);

        await ctx.proxy.write(`\x1b_Ga=d,d=i,i=700\x1b\\`);
        await timeout(50);
        strictEqual(await ctx.page.evaluate(`window.imageAddon._handlers.get('kitty').images.has(700)`), false);
      });
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
