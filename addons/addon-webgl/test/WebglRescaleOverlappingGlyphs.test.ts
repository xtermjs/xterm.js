/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test from '@playwright/test';
import type { Terminal } from '@xterm/xterm';
import type { WebglAddon } from '@xterm/addon-webgl';
import { ITestContext, createTestContext, openTerminal, pollFor } from '../../../test/playwright/TestUtils';
import { platform } from 'os';

interface ITestGlyph {
  size: { x: number, y: number };
  offset: { x: number, y: number };
}

interface ITestTextureAtlas {
  getRasterizedGlyph(code: number, ...args: unknown[]): ITestGlyph;
}

interface ITestWebglAddon extends WebglAddon {
  _renderer?: {
    dimensions: { device: { cell: { width: number }, char: { left: number }, canvas: { width: number } } };
    _charAtlas?: ITestTextureAtlas;
    _glyphRenderer: { value?: { _vertices: { attributes: Float32Array } } };
  };
}

interface ITestWindow {
  WebglAddon: new () => ITestWebglAddon;
  term: Terminal;
  addon: ITestWebglAddon;
}

test.describe('WebGL rescale overlapping glyphs', () => {
  if (platform() === 'linux') {
    test.skip(({ browserName }) => browserName === 'firefox' || browserName === 'webkit');
  }

  test('rescaled glyphs are drawn inside their cell', async ({ browser }) => {
    const ctx = await createTestContext(browser);
    try {
      await openTerminal(ctx, { rescaleOverlappingGlyphs: true });
      const cellWidth = await loadWebglAddon(ctx);
      await writeGlyphs(ctx, {
        [0x2228]: { width: cellWidth + 2, left: Math.floor(cellWidth / 2) },
        [0x222A]: { width: cellWidth * 2, left: -2 }
      });
      await pollFor(ctx.page, () => getGlyphBounds(ctx), [[1, cellWidth], [0, cellWidth - 1]]);
    } finally {
      await ctx.page.close();
    }
  });
});

async function loadWebglAddon(ctx: ITestContext): Promise<number> {
  return ctx.page.evaluate(() => {
    const w = window as unknown as ITestWindow;
    w.addon = new w.WebglAddon();
    w.term.loadAddon(w.addon);
    const renderer = w.addon._renderer;
    if (!renderer) {
      throw new Error('WebGL renderer must be available');
    }
    return renderer.dimensions.device.cell.width;
  });
}

async function writeGlyphs(ctx: ITestContext, glyphs: { [code: number]: { width: number, left: number } }): Promise<void> {
  await ctx.page.evaluate(glyphs => {
    const w = window as unknown as ITestWindow;
    const renderer = w.addon._renderer;
    const atlas = renderer?._charAtlas;
    if (!renderer || !atlas) {
      throw new Error('WebGL renderer and texture atlas must be available');
    }
    // Patch the prototype so the glyphs stay the same if the atlas is recreated, for example after
    // the WebGL context is restored
    const atlasPrototype = Object.getPrototypeOf(atlas) as ITestTextureAtlas;
    const getRasterizedGlyph = atlasPrototype.getRasterizedGlyph;
    atlasPrototype.getRasterizedGlyph = function(code, ...args) {
      const glyph = getRasterizedGlyph.call(this, code, ...args);
      const fake = glyphs[code];
      if (!fake) {
        return glyph;
      }
      return { ...glyph, size: { x: fake.width, y: glyph.size.y }, offset: { x: renderer.dimensions.device.char.left - fake.left, y: glyph.offset.y } };
    };
    w.term.write('a\u2228b\u222Ac');
  }, glyphs);
}

async function getGlyphBounds(ctx: ITestContext): Promise<number[][] | undefined> {
  return ctx.page.evaluate(() => {
    const indicesPerCell = 11;
    const renderer = (window as unknown as ITestWindow).addon._renderer;
    const attributes = renderer?._glyphRenderer.value?._vertices.attributes;
    if (!renderer || !attributes) {
      return undefined;
    }
    return [1, 3].map(x => {
      const left = attributes[x * indicesPerCell];
      return [left, Math.round(left + attributes[x * indicesPerCell + 2] * renderer.dimensions.device.canvas.width)];
    });
  });
}
