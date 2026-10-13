/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test, { expect } from '@playwright/test';
import { platform } from 'os';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';

interface ITestRendererWithAtlasCanvas {
  readonly _charAtlas?: {
    readonly _tmpCanvas?: HTMLCanvasElement;
  };
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
});
