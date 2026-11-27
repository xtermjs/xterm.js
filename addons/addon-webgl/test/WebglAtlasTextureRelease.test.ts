/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test, { expect } from '@playwright/test';
import { createTestContext, openTerminal } from '../../../test/playwright/TestUtils';

test.describe('atlas texture release', () => {
  test.skip(({ browserName }) => browserName !== 'chromium');
  test.describe.configure({ timeout: 90000 });

  test('releases the GPU textures of atlas pages removed by eviction', async ({ browser }) => {
    const ctx = await createTestContext(browser);
    try {
      await openTerminal(ctx, { cols: 80, rows: 24 });
      const limits = await ctx.page.evaluate(() => {
        const w = window as any;
        w.addon = new w.WebglAddon();
        w.term.loadAddon(w.addon);
        const atlasClass = w.addon._renderer._charAtlas.constructor;
        const original = { maxAtlasPages: atlasClass.maxAtlasPages, maxTextureSize: atlasClass.maxTextureSize };
        // Pages are created at 512 so they cannot merge, the 5th page evicts every page
        atlasClass.maxAtlasPages = 4;
        atlasClass.maxTextureSize = 512;
        w.atlasStats = { removals: 0, maxPages: 0 };
        w.addon.onAddTextureAtlasCanvas(() => {
          w.atlasStats.maxPages = Math.max(w.atlasStats.maxPages, w.addon._renderer._charAtlas.pages.length);
        });
        w.addon.onRemoveTextureAtlasCanvas(() => w.atlasStats.removals++);
        return original;
      });

      const glyphsPerChunk = 200;
      for (let chunk = 0; chunk < 200; chunk++) {
        let data = '\x1b[H\x1b[2J';
        for (let i = 0; i < glyphsPerChunk; i++) {
          data += String.fromCodePoint(0x4E00 + chunk * glyphsPerChunk + i);
        }
        await ctx.proxy.write(data);
        await ctx.page.waitForTimeout(20);
        if (await ctx.page.evaluate(() => (window as any).atlasStats.removals > 0)) {
          break;
        }
      }
      await ctx.page.evaluate(() => new Promise<void>(resolve => {
        const w = window as any;
        const disposable = w.term.onRender(() => {
          disposable.dispose();
          resolve();
        });
        w.term.write('\x1b[H\x1b[2Jok');
      }));

      const result = await ctx.page.evaluate(original => {
        const w = window as any;
        const renderer = w.addon._renderer;
        const atlasClass = renderer._charAtlas.constructor;
        atlasClass.maxAtlasPages = original.maxAtlasPages;
        atlasClass.maxTextureSize = original.maxTextureSize;
        // A sub-image write at x=1 only succeeds if the texture is wider than 1px
        const gl: WebGL2RenderingContext = renderer._gl;
        const textures = renderer._glyphRenderer.value._atlasTextures;
        const pageCount = renderer._charAtlas.pages.length;
        const retainedSlots: number[] = [];
        for (let i = pageCount; i < 4; i++) {
          gl.activeTexture(gl.TEXTURE0 + i);
          gl.bindTexture(gl.TEXTURE_2D, textures[i].texture);
          while (gl.getError() !== gl.NO_ERROR) { /* drain */ }
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 1, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
          if (gl.getError() === gl.NO_ERROR) {
            retainedSlots.push(i);
          }
        }
        return { pageCount, retainedSlots, ...w.atlasStats };
      }, limits);

      expect(result.maxPages, 'the atlas must fill every page before evicting').toBe(4);
      expect(result.removals, 'atlas pages must be evicted').toBeGreaterThan(0);
      expect(result.pageCount, 'eviction must leave fewer pages than were uploaded').toBeLessThan(4);
      expect(result.retainedSlots, 'texture slots without a page must not keep page-sized storage').toEqual([]);
    } finally {
      await ctx.page.close();
    }
  });
});
