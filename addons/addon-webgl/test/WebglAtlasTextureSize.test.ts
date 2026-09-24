/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test, { expect } from '@playwright/test';
import type { Terminal } from '@xterm/xterm';
import type { WebglAddon } from '@xterm/addon-webgl';
import { createTestContext, openTerminal } from '../../../test/playwright/TestUtils';

interface ISizeTestTextureAtlas {
  constructor: {
    maxTextureSize: number | undefined;
  };
  getRasterizedGlyph(code: number, bg: number, fg: number, ext: number, restrictToCellHeight: boolean, domContainer: HTMLElement | undefined): unknown;
}

interface ISizeTestTerminal extends Terminal {
  _core?: {
    _renderService?: {
      _renderer?: {
        value?: {
          _charAtlas?: ISizeTestTextureAtlas;
        };
      };
    };
  };
}

interface ISizeTestWindow {
  WebglAddon: new () => WebglAddon;
  term: ISizeTestTerminal;
}

test.describe('atlas texture size', () => {
  test.skip(({ browserName }) => browserName !== 'chromium');
  test.describe.configure({ timeout: 60000 });

  test('merges pages no larger than FORCED_MAX_TEXTURE_SIZE and releases discarded pages', async ({ browser }) => {
    const ctx = await createTestContext(browser);
    try {
      await openTerminal(ctx, { fontSize: 128 });
      const result = await ctx.page.evaluate(() => {
        const w = window as unknown as ISizeTestWindow;
        const addon = new w.WebglAddon();
        w.term.loadAddon(addon);
        const atlas = w.term._core?._renderService?._renderer?.value?._charAtlas;
        if (!atlas) {
          return undefined;
        }
        // A device limit well above the forced maximum.
        const deviceMaxTextureSize = atlas.constructor.maxTextureSize;
        atlas.constructor.maxTextureSize = 16384;
        let largestPage = 0;
        const removed: HTMLCanvasElement[] = [];
        addon.onAddTextureAtlasCanvas(canvas => largestPage = Math.max(largestPage, canvas.width));
        addon.onRemoveTextureAtlasCanvas(canvas => removed.push(canvas));
        try {
          // A new truecolor foreground makes every glyph a new atlas entry.
          for (let i = 0; i < 30000; i++) {
            atlas.getRasterizedGlyph(0x41, 0, 0x3000000 | i, 0, false, undefined);
          }
        } finally {
          atlas.constructor.maxTextureSize = deviceMaxTextureSize;
        }
        return {
          largestPage,
          removed: removed.length,
          unreleased: removed.filter(canvas => canvas.width !== 0 || canvas.height !== 0).length
        };
      });
      expect(result, 'WebGL atlas must be initialized').toBeDefined();
      expect(result!.largestPage, 'pages must merge up to, and not past, the forced maximum').toBe(4096);
      expect(result!.removed, 'pages must have been merged or evicted').toBeGreaterThan(0);
      expect(result!.unreleased, 'discarded pages must release their canvas').toBe(0);
    } finally {
      await ctx.page.close();
    }
  });
});
