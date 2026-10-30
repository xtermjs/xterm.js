/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test, { expect } from '@playwright/test';
import type { Terminal, ITerminalInitOnlyOptions, ITerminalOptions } from '@xterm/xterm';
import type { IWebglAddonOptions, WebglAddon } from '@xterm/addon-webgl';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';

type TestTerminalConstructor = new (options?: ITerminalOptions & ITerminalInitOnlyOptions) => ITestTerminal;
type TestWebglAddonConstructor = new (options?: IWebglAddonOptions) => ITestWebglAddon;

interface ITestTextureAtlas {
  dispose(): void;
  __probeTag?: string;
  __probeDisposeCount?: number;
}

interface ITestRenderer {
  _charAtlas?: ITestTextureAtlas;
}

interface ITestRenderService {
  _renderer?: {
    value?: ITestRenderer;
  };
}

interface ITestTerminal extends Terminal {
  _core?: {
    _renderService?: ITestRenderService;
  };
}

interface ITestWebglAddon extends WebglAddon {
  _renderer?: ITestRenderer;
}

declare global {
  interface Window { // eslint-disable-line @typescript-eslint/naming-convention
    Terminal: TestTerminalConstructor;
    WebglAddon: TestWebglAddonConstructor;
    term: ITestTerminal;
    addon?: ITestWebglAddon;
  }
}

async function loadWebglStrict(ctx: ITestContext): Promise<void> {
  await ctx.page.evaluate(() => {
    window.addon = new window.WebglAddon({ preserveDrawingBuffer: true });
    window.term.loadAddon(window.addon);
  });
  const isWebglRenderer = await ctx.page.evaluate(() => {
    return !!window.addon && window.term?._core?._renderService?._renderer?.value === window.addon._renderer;
  });
  expect(isWebglRenderer, 'WebGL renderer must be active').toBe(true);
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

/**
 * Tags the renderer's current atlas and wraps its dispose so a later check can
 * tell whether the same atlas instance is still in use and whether anything
 * disposed it along the way.
 */
async function tagCurrentAtlas(ctx: ITestContext): Promise<void> {
  const tagged = await ctx.page.evaluate(() => {
    const atlas = window.term._core?._renderService?._renderer?.value?._charAtlas;
    if (!atlas) {
      return false;
    }
    atlas.__probeTag = 'original';
    atlas.__probeDisposeCount = 0;
    const originalDispose = atlas.dispose.bind(atlas);
    atlas.dispose = () => {
      atlas.__probeDisposeCount = (atlas.__probeDisposeCount ?? 0) + 1;
      originalDispose();
    };
    return true;
  });
  expect(tagged, 'the WebGL renderer must have acquired a texture atlas').toBe(true);
}

async function readAtlasProbe(ctx: ITestContext): Promise<{ sameInstance: boolean, disposeCount: number | undefined }> {
  return ctx.page.evaluate(() => {
    const atlas = window.term._core?._renderService?._renderer?.value?._charAtlas;
    return {
      sameInstance: atlas?.__probeTag === 'original',
      disposeCount: atlas?.__probeDisposeCount
    };
  });
}

test.describe('link layer must not churn the shared texture atlas', () => {
  test.skip(({ browserName }) => browserName !== 'chromium');
  test.describe.configure({ timeout: 60000 });

  test('resizing keeps the renderer on the same atlas instance', async ({ browser }) => {
    // The link render layer used to acquire an atlas with a hard-coded device
    // max texture size. Once that field became part of atlas cache equality, a
    // sole-owner terminal would release its real atlas on every layer resize
    // and the renderer would rebuild it straight after, so each terminal resize
    // discarded a full atlas (and every embedder resize on tab switch did too).
    const ctx = await createTestContext(browser);
    try {
      await openTerminal(ctx, { cols: 80, rows: 24 });
      await loadWebglStrict(ctx);
      await writeAndWaitForRender(ctx, 'hello https://example.com world');
      await tagCurrentAtlas(ctx);

      for (const [cols, rows] of [[100, 30], [80, 24], [120, 40], [80, 24]]) {
        await ctx.proxy.resize(cols, rows);
        await writeAndWaitForRender(ctx, `\x1b[${rows};1Hresized ${cols}x${rows}`);
      }

      const probe = await readAtlasProbe(ctx);
      expect(probe.disposeCount, 'the atlas must not be disposed by a resize').toBe(0);
      expect(probe.sameInstance, 'the renderer must still hold the atlas it started with').toBe(true);
    } finally {
      await ctx.page.close();
    }
  });

  test('changing theme colors keeps the renderer on the same atlas instance when the palette is unchanged', async ({ browser }) => {
    const ctx = await createTestContext(browser);
    try {
      await openTerminal(ctx, { cols: 80, rows: 24 });
      await loadWebglStrict(ctx);
      await writeAndWaitForRender(ctx, 'hello world');
      await tagCurrentAtlas(ctx);

      // Re-assigning the same theme fires onChangeColors, which the link layer
      // also listens to; the atlas config is unchanged so it must be reused.
      await ctx.page.evaluate(() => {
        window.term.options.theme = { ...window.term.options.theme };
      });
      await writeAndWaitForRender(ctx, ' again');

      const probe = await readAtlasProbe(ctx);
      expect(probe.disposeCount, 'the atlas must not be disposed by an unchanged theme').toBe(0);
      expect(probe.sameInstance, 'the renderer must still hold the atlas it started with').toBe(true);
    } finally {
      await ctx.page.close();
    }
  });
});
