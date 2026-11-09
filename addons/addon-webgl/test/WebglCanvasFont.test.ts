/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test from '@playwright/test';
import type { Terminal } from '@xterm/xterm';
import type { WebglAddon } from '@xterm/addon-webgl';
import { createTestContext, openTerminal, pollFor } from '../../../test/playwright/TestUtils';
import { platform } from 'os';

interface ITestWebglAddon extends WebglAddon {
  _renderer?: {
    _charAtlas?: {
      _tmpCtx: CanvasRenderingContext2D;
      clearTexture(): void;
    };
  };
}

interface ITestWindow {
  WebglAddon: new () => ITestWebglAddon;
  term: Terminal;
  glyphFonts: string[];
}

test.describe('WebGL canvas font parsing', () => {
  if (platform() === 'linux') {
    test.skip(({ browserName }) => browserName === 'firefox' || browserName === 'webkit');
  }

  for (const { style, sgr, font } of [
    { style: 'regular', sgr: '0', font: '24px monospace' },
    { style: 'bold', sgr: '1', font: 'bold 24px monospace' },
    { style: 'italic', sgr: '3', font: 'italic 24px monospace' },
    { style: 'bold italic', sgr: '1;3', font: 'italic bold 24px monospace' }
  ]) {
    test(`uses the configured font for ${style} glyphs when leading whitespace is rejected`, async ({ browser }) => {
      const ctx = await createTestContext(browser);
      try {
        await openTerminal(ctx, { fontSize: 24, fontFamily: 'monospace' });
        await ctx.page.evaluate(() => {
          const w = window as unknown as ITestWindow;
          const addon = new w.WebglAddon();
          w.term.loadAddon(addon);
          const atlas = addon._renderer?._charAtlas;
          const descriptor = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font');
          if (!atlas || !descriptor?.get || !descriptor.set) {
            throw new Error('The texture atlas and canvas font accessor must be available');
          }
          const context = atlas._tmpCtx;
          // Electron 45.2.3 ignores canvas font assignments that start with whitespace.
          Object.defineProperty(context, 'font', {
            get: () => descriptor.get!.call(context),
            set: (value: string) => {
              if (!/^\s/.test(value)) {
                descriptor.set!.call(context, value);
              }
            }
          });
          context.font = '10px sans-serif';
          w.glyphFonts = [];
          const fillText = context.fillText.bind(context);
          context.fillText = (text, x, y, maxWidth) => {
            if (text === 'Ω') {
              w.glyphFonts.push(context.font);
            }
            fillText(text, x, y, maxWidth);
          };
          atlas.clearTexture();
        });
        await ctx.proxy.write(`\x1b[${sgr}mΩ`);
        await pollFor(ctx.page, () => ctx.page.evaluate(() => (window as unknown as ITestWindow).glyphFonts), [font]);
      } finally {
        await ctx.page.close();
      }
    });
  }
});
