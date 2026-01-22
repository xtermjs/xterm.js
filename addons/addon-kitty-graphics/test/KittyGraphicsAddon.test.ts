/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Playwright integration tests for Kitty Graphics Addon.
 * These test the addon in a real browser with visual verification.
 *
 * Unit tests for parsing are in src/KittyGraphicsAddon.test.ts
 */

import test from '@playwright/test';
import { readFileSync } from 'fs';
import { deepStrictEqual, strictEqual } from 'assert';
import { ITestContext, createTestContext, openTerminal, timeout } from '../../../test/playwright/TestUtils';

// Load test images as base64
const BLACK_1X1_BASE64 = readFileSync('./addons/addon-kitty-graphics/fixture/black-1x1.png').toString('base64');
const RGB_3X1_BASE64 = readFileSync('./addons/addon-kitty-graphics/fixture/rgb-3x1.png').toString('base64');

let ctx: ITestContext;

test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
});

test.afterAll(async () => {
  await ctx.page.close();
});

test.describe('KittyGraphicsAddon', () => {
  test.beforeEach(async () => {
    await openTerminal(ctx, { cols: 80, rows: 24 });
    await ctx.page.evaluate(`
      window.term.reset();
      window.kittyAddon?.dispose();
      window.kittyAddon = new KittyGraphicsAddon({ debug: true });
      window.term.loadAddon(window.kittyAddon);
    `);
  });

  test('addon should be loaded and activated', async () => {
    const hasAddon = await ctx.page.evaluate(`typeof window.KittyGraphicsAddon !== 'undefined'`);
    strictEqual(hasAddon, true, 'KittyGraphicsAddon should be available');
  });

  test.describe('image storage', () => {
    test('stores PNG image with a=t (transmit only)', async () => {
      const seq = `\x1b_Ga=t,f=100;${BLACK_1X1_BASE64}\x1b\\`;
      await ctx.proxy.write(seq);
      await timeout(50);
      strictEqual(await ctx.page.evaluate('window.kittyAddon.images.size'), 1);
    });

    test('stores PNG image with a=T (transmit and display)', async () => {
      const seq = `\x1b_Ga=T,f=100;${BLACK_1X1_BASE64}\x1b\\`;
      await ctx.proxy.write(seq);
      await timeout(50);
      strictEqual(await ctx.page.evaluate('window.kittyAddon.images.size'), 1);
    });

    test('assigns auto-incrementing IDs when not specified', async () => {
      const seq1 = `\x1b_Ga=t,f=100;${BLACK_1X1_BASE64}\x1b\\`;
      const seq2 = `\x1b_Ga=t,f=100;${RGB_3X1_BASE64}\x1b\\`;
      await ctx.proxy.write(seq1);
      await ctx.proxy.write(seq2);
      await timeout(50);
      strictEqual(await ctx.page.evaluate('window.kittyAddon.images.size'), 2);
      strictEqual(await ctx.page.evaluate('window.kittyAddon.images.has(1)'), true);
      strictEqual(await ctx.page.evaluate('window.kittyAddon.images.has(2)'), true);
    });

    test('uses specified image ID', async () => {
      const seq = `\x1b_Ga=t,f=100,i=42;${BLACK_1X1_BASE64}\x1b\\`;
      await ctx.proxy.write(seq);
      await timeout(50);
      strictEqual(await ctx.page.evaluate('window.kittyAddon.images.has(42)'), true);
    });

    test('deletes specific image with a=d', async () => {
      const seq1 = `\x1b_Ga=t,f=100,i=10;${BLACK_1X1_BASE64}\x1b\\`;
      const seq2 = `\x1b_Ga=d,i=10;\x1b\\`;
      await ctx.proxy.write(seq1);
      await timeout(50);
      strictEqual(await ctx.page.evaluate('window.kittyAddon.images.size'), 1);
      await ctx.proxy.write(seq2);
      await timeout(50);
      strictEqual(await ctx.page.evaluate('window.kittyAddon.images.size'), 0);
    });

    test('deletes all images with a=d (no id)', async () => {
      const seq1 = `\x1b_Ga=t,f=100,i=1;${BLACK_1X1_BASE64}\x1b\\`;
      const seq2 = `\x1b_Ga=t,f=100,i=2;${RGB_3X1_BASE64}\x1b\\`;
      const seqDelete = `\x1b_Ga=d;\x1b\\`;
      await ctx.proxy.write(seq1);
      await ctx.proxy.write(seq2);
      await timeout(50);
      strictEqual(await ctx.page.evaluate('window.kittyAddon.images.size'), 2);
      await ctx.proxy.write(seqDelete);
      await timeout(50);
      strictEqual(await ctx.page.evaluate('window.kittyAddon.images.size'), 0);
    });
  });

  test.describe('chunked transmission (m=1)', () => {
    test('assembles multi-chunk image', async () => {
      // Split the base64 in half
      const half = Math.floor(BLACK_1X1_BASE64.length / 2);
      const part1 = BLACK_1X1_BASE64.substring(0, half);
      const part2 = BLACK_1X1_BASE64.substring(half);

      const seq1 = `\x1b_Ga=t,f=100,i=99,m=1;${part1}\x1b\\`;
      const seq2 = `\x1b_Ga=t,f=100,i=99;${part2}\x1b\\`;

      await ctx.proxy.write(seq1);
      await timeout(50);
      // Image should not be stored yet (still pending)
      strictEqual(await ctx.page.evaluate('window.kittyAddon.images.has(99)'), false);

      await ctx.proxy.write(seq2);
      await timeout(50);
      // Now it should be stored
      strictEqual(await ctx.page.evaluate('window.kittyAddon.images.has(99)'), true);

      // Verify the full data was assembled
      const storedData = await ctx.page.evaluate('window.kittyAddon.images.get(99).data');
      strictEqual(storedData, BLACK_1X1_BASE64);
    });
  });

  // TODO: These tests will fail until decode + rendering is implemented
  test.describe.skip('pixel verification', () => {
    test('renders 1x1 black PNG at cursor position', async () => {
      // Send image with a=T to transmit and display
      const seq = `\x1b_Ga=T,f=100;${BLACK_1X1_BASE64}\x1b\\`;
      await ctx.proxy.write(seq);
      await timeout(100);

      // Read pixel from addon's canvas overlay
      const pixel = await ctx.page.evaluate(() => {
        const canvas = document.querySelector('.xterm-kitty-graphics-layer') as HTMLCanvasElement;
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        return Array.from(ctx.getImageData(0, 0, 1, 1).data);
      });

      // Black pixel: [0, 0, 0, 255]
      deepStrictEqual(pixel, [0, 0, 0, 255]);
    });

    test('renders 3x1 RGB PNG (red, green, blue pixels)', async () => {
      const seq = `\x1b_Ga=T,f=100;${RGB_3X1_BASE64}\x1b\\`;
      await ctx.proxy.write(seq);
      await timeout(100);

      const pixels = await ctx.page.evaluate(() => {
        const canvas = document.querySelector('.xterm-kitty-graphics-layer') as HTMLCanvasElement;
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

      // Verify RGB pixels
      deepStrictEqual(pixels?.red, [255, 0, 0, 255]);
      deepStrictEqual(pixels?.green, [0, 255, 0, 255]);
      deepStrictEqual(pixels?.blue, [0, 0, 255, 255]);
    });
  });
});
