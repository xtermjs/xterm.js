/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test, { expect } from '@playwright/test';
import { platform } from 'os';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';

interface ITestRasterizedGlyph {
  readonly texturePage: number;
  readonly texturePosition: {
    readonly x: number;
    readonly y: number;
  };
  readonly size: {
    readonly x: number;
    readonly y: number;
  };
}

interface ITestGlyphPixels {
  readonly code: number;
  readonly colored: number;
  readonly partial: number;
}

interface ITestRendererWithAtlasCanvas {
  readonly _charAtlas?: {
    readonly _tmpCanvas?: HTMLCanvasElement;
    readonly pages: ReadonlyArray<{
      readonly canvas: HTMLCanvasElement;
    }>;
    getRasterizedGlyph(code: number, bg: number, fg: number, ext: number, restrictToCellHeight: boolean, domContainer: HTMLElement | undefined): ITestRasterizedGlyph;
    getRasterizedGlyphCombinedChar(chars: string, bg: number, fg: number, ext: number, restrictToCellHeight: boolean, domContainer: HTMLElement | undefined): ITestRasterizedGlyph;
  };
  readonly dimensions: {
    readonly device: {
      readonly char: {
        readonly width: number;
      };
      readonly cell: {
        readonly width: number;
        readonly height: number;
      };
    };
  };
}

async function getGlyphPixels(ctx: ITestContext, chars: ReadonlyArray<string>): Promise<ITestGlyphPixels[]> {
  return ctx.page.evaluate(chars => {
    const renderer = window.term._core?._renderService?._renderer?.value as ITestRendererWithAtlasCanvas | undefined;
    const atlas = renderer?._charAtlas;
    if (!atlas || !window.term.element) {
      throw new Error('Texture atlas and terminal element must be available');
    }
    return chars.map(char => {
      const code = char.codePointAt(0)!;
      const glyph = char.length > 1
        ? atlas.getRasterizedGlyphCombinedChar(char, 0, 0, 0, false, window.term.element)
        : atlas.getRasterizedGlyph(code, 0, 0, 0, false, window.term.element);
      const page = atlas.pages[glyph.texturePage];
      const pageContext = page.canvas.getContext('2d');
      if (!pageContext) {
        throw new Error('Texture atlas page context must be available');
      }
      const rgba = pageContext.getImageData(
        glyph.texturePosition.x,
        glyph.texturePosition.y,
        glyph.size.x,
        glyph.size.y
      ).data;
      let colored = 0;
      let partial = 0;
      for (let i = 3; i < rgba.length; i += 4) {
        if (rgba[i] > 0) {
          colored++;
          if (rgba[i] < 255) {
            partial++;
          }
        }
      }
      return { code, colored, partial };
    });
  }, chars);
}

async function writeAndWaitForRender(ctx: ITestContext, data: string): Promise<void> {
  const renderPromise = new Promise<void>(resolve => {
    const disposable = ctx.proxy.onRender(() => {
      disposable.dispose();
      resolve();
    });
  });
  await ctx.proxy.write(data);
  await renderPromise;
}

test.describe('WebGL custom glyphs', () => {
  if (platform() === 'linux') {
    test.skip(({ browserName }) => browserName === 'firefox' || browserName === 'webkit');
  }

  test('pattern glyphs render after the terminal is adopted into another document', async ({ browser }) => {
    const ctx = await createTestContext(browser);
    const errors: string[] = [];
    const onError = (error: Error): void => { errors.push(error.message); };
    ctx.page.on('pageerror', onError);
    try {
      await openTerminal(ctx);
      await ctx.page.evaluate(`
        window.addon = new window.WebglAddon({ customGlyphs: true });
        window.term.loadAddon(window.addon);
      `);
      await ctx.page.evaluate(() => {
        const frame = document.createElement('iframe');
        document.body.appendChild(frame);
        const auxiliaryDocument = frame.contentDocument;
        if (!auxiliaryDocument?.body || !window.term.element) {
          throw new Error('Auxiliary document and terminal element must be available');
        }
        const renderer = window.term._core?._renderService?._renderer?.value as ITestRendererWithAtlasCanvas | undefined;
        const atlasCanvas = renderer?._charAtlas?._tmpCanvas;
        if (!atlasCanvas) {
          throw new Error('Texture atlas canvas must be available');
        }
        // Model the atlas state after an uncached glyph has attached the measurement canvas.
        window.term.element.appendChild(atlasCanvas);
        auxiliaryDocument.body.appendChild(window.term.element);
        if (atlasCanvas.ownerDocument !== auxiliaryDocument) {
          throw new Error('Texture atlas canvas must be adopted into the auxiliary document');
        }
        auxiliaryDocument.createElement = () => {
          throw new Error('Not allowed to create elements in the auxiliary document');
        };
      });

      await writeAndWaitForRender(ctx, '\u2591');
      await writeAndWaitForRender(ctx, 'X');

      const line = await ctx.page.evaluate(() => window.term.buffer.active.getLine(0)?.translateToString(true));
      expect(errors, `renderer must not create pattern canvases in the auxiliary document: ${errors[0] ?? ''}`).toEqual([]);
      expect(line).toBe('\u2591X');
    } finally {
      ctx.page.off('pageerror', onError);
      await ctx.page.close();
    }
  });

  test('solid block vectors render opaque and preserve narrow stripes', async ({ browser }) => {
    const ctx = await createTestContext(browser);
    try {
      await openTerminal(ctx, {
        cols: 8,
        rows: 2,
        fontSize: 15,
        minimumContrastRatio: 1,
        allowTransparency: true,
        theme: {
          foreground: '#d78787',
          background: 'rgba(0, 0, 0, 0)'
        }
      });
      const charWidth = await ctx.page.evaluate(() => {
        const renderer = window.term._core?._renderService?._renderer?.value as ITestRendererWithAtlasCanvas | undefined;
        if (!renderer) {
          throw new Error('Renderer must be available');
        }
        return renderer.dimensions.device.char.width;
      });
      const deviceCharWidth = Math.floor(charWidth);
      const targetCellWidth = Math.max(9, deviceCharWidth % 2 === 0 ? deviceCharWidth + 1 : deviceCharWidth);
      await ctx.proxy.setOption('letterSpacing', targetCellWidth - deviceCharWidth);
      await ctx.page.evaluate(() => {
        window.addon = new window.WebglAddon({ customGlyphs: true });
        window.term.loadAddon(window.addon);
      });

      const dimensions = await ctx.page.evaluate(() => {
        const renderer = window.term._core?._renderService?._renderer?.value as ITestRendererWithAtlasCanvas | undefined;
        if (!renderer) {
          throw new Error('WebGL renderer must be available');
        }
        return renderer.dimensions.device.cell;
      });
      expect(dimensions.width).toBe(targetCellWidth);
      expect(dimensions.width % 2).toBe(1);

      await writeAndWaitForRender(ctx, '\x1b[?25l\x1b[H\u259B\u259A\u{1FB81}\u{1FB95}');
      const glyphPixels = await getGlyphPixels(ctx, ['\u259B', '\u259A', '\u{1FB81}', '\u{1FB95}']);
      for (const glyph of glyphPixels) {
        expect(glyph.colored, `U+${glyph.code.toString(16).toUpperCase()} must not be empty`).toBeGreaterThan(0);
        expect(glyph.partial, `U+${glyph.code.toString(16).toUpperCase()} must be opaque`).toBe(0);
      }

      const narrowCellWidth = 7;
      await ctx.proxy.setOption('letterSpacing', narrowCellWidth - deviceCharWidth);
      const resizedCellWidth = await ctx.page.evaluate(() => {
        const renderer = window.term._core?._renderService?._renderer?.value as ITestRendererWithAtlasCanvas | undefined;
        if (!renderer) {
          throw new Error('WebGL renderer must be available');
        }
        return renderer.dimensions.device.cell.width;
      });
      expect(resizedCellWidth).toBe(narrowCellWidth);

      await writeAndWaitForRender(ctx, '\x1b[H\u{1FB73}');
      const [narrowStripePixels] = await getGlyphPixels(ctx, ['\u{1FB73}']);
      expect(narrowStripePixels.colored, `U+${narrowStripePixels.code.toString(16).toUpperCase()} must not be empty`).toBeGreaterThan(0);
    } finally {
      await ctx.page.close();
    }
  });
});
