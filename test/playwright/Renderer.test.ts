/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { decodePng } from '@lunapaint/png-codec';
import { test } from '@playwright/test';
import { ITheme } from 'xterm';
import { createTestContext, ITestContext, openTerminal, pollFor } from './TestUtils';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx);
});
test.afterAll(async () => await ctx.page.close());

test.describe('WebGL Renderer Integration Tests', async () => {
  // itWebgl('dispose removes renderer canvases', async function(): Promise<void> {
  //   await setupBrowser();
  //   assert.equal(await page.evaluate(`document.querySelectorAll('.xterm canvas').length`), 2);
  //   await page.evaluate(`addon.dispose()`);
  //   assert.equal(await page.evaluate(`document.querySelectorAll('.xterm canvas').length`), 0);
  //   await browser.close();
  // });

  test.describe.only('colors', () => {
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
});

async function getCellColor(col: number, row: number): Promise<number[]> {
  const buffer = await ctx.page.locator('#terminal-container .xterm-rows').screenshot({ path: 'ss.png' });
  const decoded = (await decodePng(buffer)).image;
  const cellSize = {
    width: decoded.width / await ctx.proxy.cols,
    height: decoded.height / await ctx.proxy.rows,
  };
  console.log('buffer', buffer);
  console.log('decoded', decoded);
  console.log('cellSize', cellSize);
  const x = 1; //Math.floor((col - 1) + 0.5 * cellSize.width);
  const y = 1; //Math.floor((row - 1) + 0.5 * cellSize.height);
  const i = y * decoded.width + x;
  console.log({ x, y, i });
  console.log('result', Array.from(decoded.data.slice(i, i + 4)));
  return Array.from(decoded.data.slice(i, i + 4));

  await ctx.page.evaluate(`
    window.gl = window.term._core._renderService._renderer.value._gl;
    window.result = new Uint8Array(4);
    window.d = window.term._core._renderService.dimensions;
    window.gl.readPixels(
      Math.floor((${col - 0.5}) * window.d.device.cell.width),
      Math.floor(window.gl.drawingBufferHeight - 1 - (${row - 0.5}) * window.d.device.cell.height),
      1, 1, window.gl.RGBA, window.gl.UNSIGNED_BYTE, window.result
    );
  `);
  // await page.locator('.header').screenshot({ path: 'screenshot.png' });
  return await ctx.page.evaluate(`Array.from(window.result)`);
}
