/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { test } from '@playwright/test';
import { ok, strictEqual } from 'assert';
import { decodePng } from '@lunapaint/png-codec';
import { ITestContext, createTestContext, openTerminal, pollFor } from './TestUtils';
import { ISharedRendererTestContext, injectSharedRendererTestsStandalone, injectSharedRendererTests } from './SharedRendererTests';

let ctx: ITestContext;
const ctxWrapper: ISharedRendererTestContext = {
  value: undefined,
  skipDomExceptions: true
} as any;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  ctxWrapper.value = ctx;
  await openTerminal(ctx);
});
test.afterAll(async () => await ctx.page.close());

test.describe('DOM Renderer Integration Tests', () => {
  // HACK: Skip on WebKit, not clear why it's failing
  test.skip(({ browserName }) => browserName === 'webkit', 'Skipped on WebKit');

  injectSharedRendererTests(ctxWrapper);
  injectSharedRendererTestsStandalone(ctxWrapper, () => {});

  test('#5240: glyphs taller than the cell are not clipped by their row', async () => {
    // Halve the ascent of a bundled font so its glyphs are taller than the cell
    await ctx.page.evaluate(`(async () => {
      window.tallFont = new FontFace('Tall', "url(/fonts/kongtext.regular.ttf) format('truetype')", { ascentOverride: '50%', descentOverride: '0%' });
      await window.tallFont.load();
      document.fonts.add(window.tallFont);
    })()`);
    try {
      await openTerminal(ctx, { cols: 10, rows: 5, fontFamily: 'Tall', fontSize: 24, theme: { background: '#000000', foreground: '#ff0000' } });
      const screen = ctx.page.locator('#terminal-container .xterm-screen');
      const box = (await screen.boundingBox())!;
      ok(box.y >= 1, 'there must be space above the terminal');
      await ctx.proxy.write('HH\r\n\r\n  HH');

      // Counts red (foreground) pixels in the given fraction of a screenshot's height
      const countRedPixels = async (shot: Buffer, start: number, end: number): Promise<number> => {
        const image = (await decodePng(new Uint8Array(shot), { force32: true })).image;
        let count = 0;
        for (let y = Math.ceil(start * image.height); y < Math.floor(end * image.height); y++) {
          for (let x = 0; x < image.width; x++) {
            const i = (y * image.width + x) * 4;
            if (image.data[i] > 128 && image.data[i + 1] < 128) {
              count++;
            }
          }
        }
        return count;
      };

      // The glyphs on row 3 reach into row 2
      // Each poll takes a screenshot, so keep the number of polls low enough to finish before the test timeout
      await pollFor(ctx.page, async () => await countRedPixels(await screen.screenshot(), 1 / 5, 2 / 5) > 0, true, undefined, { maxDuration: 500 });

      // The glyphs on row 1 are still clipped at the top edge of the terminal
      const aboveTerminal = await ctx.page.screenshot({ clip: { x: box.x, y: 0, width: box.width, height: box.y } });
      strictEqual(await countRedPixels(aboveTerminal, 0, 1), 0);
    } finally {
      await ctx.page.evaluate(`document.fonts.delete(window.tallFont); delete window.tallFont;`);
    }
  });
});
