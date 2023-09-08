/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { decodePng } from '@lunapaint/png-codec';
import { LocatorScreenshotOptions, test } from '@playwright/test';
import { ITheme } from 'xterm';
import { createTestContext, ITestContext, openTerminal, pollFor } from './TestUtils';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx);
});
test.afterAll(async () => await ctx.page.close());

test.describe.only('WebGL Renderer Integration Tests', async () => {
  test.beforeEach(() => ctx.proxy.reset());

  test.describe('colors', () => {
    test('foreground 0-15', async () => {
      const theme: ITheme = {
        black: '#010203',
        red: '#040506',
        green: '#070809',
        yellow: '#0a0b0c',
        blue: '#0d0e0f',
        magenta: '#101112',
        cyan: '#131415',
        white: '#161718'
      };
      await ctx.page.evaluate(`window.term.options.theme = ${JSON.stringify(theme)};`);
      await ctx.proxy.write(`\x1b[30m█\x1b[31m█\x1b[32m█\x1b[33m█\x1b[34m█\x1b[35m█\x1b[36m█\x1b[37m█`);
      await pollFor(ctx.page, () => getCellColor(1, 1), [1, 2, 3, 255]);
      await pollFor(ctx.page, () => getCellColor(2, 1), [4, 5, 6, 255]);
      await pollFor(ctx.page, () => getCellColor(3, 1), [7, 8, 9, 255]);
      await pollFor(ctx.page, () => getCellColor(4, 1), [10, 11, 12, 255]);
      await pollFor(ctx.page, () => getCellColor(5, 1), [13, 14, 15, 255]);
      await pollFor(ctx.page, () => getCellColor(6, 1), [16, 17, 18, 255]);
      await pollFor(ctx.page, () => getCellColor(7, 1), [19, 20, 21, 255]);
      await pollFor(ctx.page, () => getCellColor(8, 1), [22, 23, 24, 255]);
    });
  });

  test('foreground 0-7 drawBoldTextInBrightColors', async () => {
    const theme: ITheme = {
      brightBlack: '#010203',
      brightRed: '#040506',
      brightGreen: '#070809',
      brightYellow: '#0a0b0c',
      brightBlue: '#0d0e0f',
      brightMagenta: '#101112',
      brightCyan: '#131415',
      brightWhite: '#161718'
    };
    await ctx.page.evaluate(`
      window.term.options.theme = ${JSON.stringify(theme)};
      window.term.options.drawBoldTextInBrightColors = true;
    `);
    await ctx.proxy.write(`\x1b[1;30m█\x1b[1;31m█\x1b[1;32m█\x1b[1;33m█\x1b[1;34m█\x1b[1;35m█\x1b[1;36m█\x1b[1;37m█`);
    await pollFor(ctx.page, () => getCellColor(1, 1), [1, 2, 3, 255]);
    await pollFor(ctx.page, () => getCellColor(2, 1), [4, 5, 6, 255]);
    await pollFor(ctx.page, () => getCellColor(3, 1), [7, 8, 9, 255]);
    await pollFor(ctx.page, () => getCellColor(4, 1), [10, 11, 12, 255]);
    await pollFor(ctx.page, () => getCellColor(5, 1), [13, 14, 15, 255]);
    await pollFor(ctx.page, () => getCellColor(6, 1), [16, 17, 18, 255]);
    await pollFor(ctx.page, () => getCellColor(7, 1), [19, 20, 21, 255]);
    await pollFor(ctx.page, () => getCellColor(8, 1), [22, 23, 24, 255]);
  });
});

/**
 * Gets the color of the pixel in the center of a cell.
 * @param col The 1-based column index to get the color for.
 * @param row The 1-based row index to get the color for.
 */
async function getCellColor(col: number, row: number): Promise<[red: number, green: number, blue: number, alpha: number]> {
  const screenshotOptions: LocatorScreenshotOptions | undefined = process.env.DEBUG ? { path: 'out-test/playwright/screenshot.png' } : undefined;
  const buffer = await ctx.page.locator('#terminal-container .xterm-rows').screenshot(screenshotOptions);
  const decoded = (await decodePng(buffer)).image;
  const cellSize = {
    width: decoded.width / await ctx.proxy.cols,
    height: decoded.height / await ctx.proxy.rows
  };
  const x = Math.floor((col - 1/* 1- to 0-based index */ + 0.5/* middle of cell */) * cellSize.width);
  const y = Math.floor((row - 1/* 1- to 0-based index */ + 0.5/* middle of cell */) * cellSize.height);
  const i = (y * decoded.width + x) * 4/* 4 channels per pixel */;
  return Array.from(decoded.data.slice(i, i + 4)) as [number, number, number, number];
}
