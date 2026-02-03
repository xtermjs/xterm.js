/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test from '@playwright/test';
import { readFileSync } from 'fs';
import { ITestContext, createTestContext, openTerminal, timeout } from '../../../test/playwright/TestUtils';
import { deepStrictEqual, strictEqual } from 'assert';

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

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx, { cols: 80, rows: 24 });
});
test.afterAll(async () => await ctx.page.close());

test.describe('Kitty Graphics Protocol', () => {
  // TODO: Add tests for larger images with various dimensions
  // TODO: Add tests for different compression formats (f=24, f=32)
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

      const storedData = await ctx.page.evaluate(`Array.from(window.imageAddon._handlers.get('kitty').images.get(99).data)`);
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
    // Kitty spec says cursor SHOULD move by cols/rows unless C=1 is specified
    // See skipped tests below for spec-compliant behavior

    test('cursor remains at origin after transmit and display (a=T) - CURRENT MVP BEHAVIOR', async () => {
      // TODO: This test documents current incomplete behavior
      // Per Kitty spec, cursor should move, but MVP implementation doesn't move it
      const cursorBefore = await getCursor();
      const seq = `\x1b_Ga=T,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`;
      await ctx.proxy.write(seq);
      await timeout(100);
      const cursorAfter = await getCursor();
      deepStrictEqual(cursorBefore, [0, 0]);
      deepStrictEqual(cursorAfter, [0, 0]);
    });

    test('cursor advances with text before image', async () => {
      await ctx.proxy.write('Hello');
      deepStrictEqual(await getCursor(), [5, 0]);

      await ctx.proxy.write(`\x1b_Ga=T,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      // Cursor should remain at position after "Hello"
      deepStrictEqual(await getCursor(), [5, 0]);
    });

    test('cursor advances with text after image', async () => {
      await ctx.proxy.write(`\x1b_Ga=T,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);
      deepStrictEqual(await getCursor(), [0, 0]);

      await ctx.proxy.write('World');
      deepStrictEqual(await getCursor(), [5, 0]);
    });

    test('cursor position with multiple images on same line', async () => {
      await ctx.proxy.write(`\x1b_Ga=T,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(50);
      deepStrictEqual(await getCursor(), [0, 0]);

      await ctx.proxy.write('###');
      deepStrictEqual(await getCursor(), [3, 0]);

      await ctx.proxy.write(`\x1b_Ga=T,f=100;${KITTY_RGB_3X1_BASE64}\x1b\\`);
      await timeout(50);
      deepStrictEqual(await getCursor(), [3, 0]);
    });

    test('cursor advances on newline after image', async () => {
      await ctx.proxy.write(`\x1b_Ga=T,f=100;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);
      deepStrictEqual(await getCursor(), [0, 0]);

      await ctx.proxy.write('\n');
      deepStrictEqual(await getCursor(), [0, 1]);
    });

    test('cursor with placement at specific column (C key)', async () => {
      // Move cursor to column 10
      await ctx.proxy.write('\x1b[11G'); // CHA - move to column 10 (1-indexed)
      deepStrictEqual(await getCursor(), [10, 0]);

      // Place image with column specification
      await ctx.proxy.write(`\x1b_Ga=T,f=100,C=5;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      // Cursor should still be at column 10 (Kitty protocol doesn't move cursor)
      deepStrictEqual(await getCursor(), [10, 0]);
    });

    // ============================================================================
    // SPEC-COMPLIANT CURSOR MOVEMENT TESTS (Currently failing - to be implemented)
    // ============================================================================
    // Per Kitty spec: "After placing an image on the screen the cursor must be
    // moved to the right by the number of cols in the image placement rectangle
    // and down by the number of rows in the image placement rectangle."

    test.skip('cursor should move right by cols when image placed (SPEC BEHAVIOR)', async () => {
      // TODO: Implement cursor movement per Kitty spec
      // When c=5 (5 columns), cursor should move right by 5
      const dim = await getDimensions();
      await ctx.proxy.write(`\x1b_Ga=T,f=100,c=5;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      // Cursor should move right by 5 columns
      deepStrictEqual(await getCursor(), [5, 0]);
    });

    test.skip('cursor should move down by rows when image placed (SPEC BEHAVIOR)', async () => {
      // TODO: Implement cursor movement per Kitty spec
      // When r=3 (3 rows), cursor should move down by 3
      const dim = await getDimensions();
      await ctx.proxy.write(`\x1b_Ga=T,f=100,r=3;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      // Cursor should move down by 3 rows
      deepStrictEqual(await getCursor(), [0, 3]);
    });

    test.skip('cursor should move by cols AND rows when both specified (SPEC BEHAVIOR)', async () => {
      // TODO: Implement cursor movement per Kitty spec
      await ctx.proxy.write(`\x1b_Ga=T,f=100,c=4,r=2;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      // Cursor should move right by 4 cols and down by 2 rows
      deepStrictEqual(await getCursor(), [4, 2]);
    });

    test.skip('cursor should NOT move when C=1 is specified (SPEC BEHAVIOR)', async () => {
      // TODO: Implement cursor movement per Kitty spec
      // C=1 means "no cursor movement"
      await ctx.proxy.write(`\x1b_Ga=T,f=100,c=5,r=3,C=1;${KITTY_BLACK_1X1_BASE64}\x1b\\`);
      await timeout(100);

      // With C=1, cursor should stay at origin even though c=5,r=3
      deepStrictEqual(await getCursor(), [0, 0]);
    });

    test.skip('cursor should calculate cols/rows from image size when not specified (SPEC BEHAVIOR)', async () => {
      // TODO: Implement cursor movement per Kitty spec
      // When c and r are not specified, they should be calculated from image size
      const dim = await getDimensions();

      // 3x1 image at default cell size should occupy certain columns
      await ctx.proxy.write(`\x1b_Ga=T,f=100;${KITTY_RGB_3X1_BASE64}\x1b\\`);
      await timeout(100);

      // Cursor should move based on image pixel size / cell size
      // For 3x1 pixel image, this would be Math.ceil(3/cellWidth) cols and Math.ceil(1/cellHeight) rows
      const expectedCols = Math.ceil(3 / dim.cellWidth);
      const expectedRows = Math.ceil(1 / dim.cellHeight);
      const cursor = await getCursor();

      // For a 3x1 pixel image, cursor should move at least 1 column and row
      // Exact values depend on cell dimensions
      strictEqual(cursor[0] >= 1, true, 'cursor should move at least 1 column');
      strictEqual(cursor[1] >= 1, true, 'cursor should move at least 1 row');
    });
  });

  test.describe('Pixel verification', () => {
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
