/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test, { expect } from '@playwright/test';
import type { Terminal } from '@xterm/xterm';
import type { WebglAddon } from '@xterm/addon-webgl';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';
import { platform } from 'os';

interface ITestTextureAtlas {
  _tmpCtx: CanvasRenderingContext2D;
  clearTexture(): void;
  getRasterizedGlyph(code: number, bg: number, fg: number, ext: number, restrictToCellHeight: boolean, domContainer: HTMLElement | undefined): unknown;
  warmUp(domContainer?: HTMLElement): void;
}

interface ITestWebglAddon extends WebglAddon {
  _renderer?: {
    _charAtlas?: ITestTextureAtlas;
  };
}

interface IWarmUpTest {
  callbacks: Map<number, IdleRequestCallback>;
  draws: string[];
  atlas?: ITestTextureAtlas;
  runNext(timeRemaining: number): void;
  flush(): void;
}

interface ITestWindow {
  Terminal: typeof Terminal;
  WebglAddon: new () => ITestWebglAddon;
  term: Terminal;
  warmUpTest: IWarmUpTest;
}

let ctx: ITestContext;

test.beforeEach(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await ctx.page.addInitScript(() => {
    const w = window as unknown as ITestWindow;
    const callbacks = new Map<number, IdleRequestCallback>();
    let nextId = 1;
    window.requestIdleCallback = callback => {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    };
    window.cancelIdleCallback = id => {
      callbacks.delete(id);
    };
    w.warmUpTest = {
      callbacks,
      draws: [],
      runNext(timeRemaining: number): void {
        const next = callbacks.entries().next().value;
        if (next) {
          const [id, callback] = next;
          callbacks.delete(id);
          callback({ didTimeout: false, timeRemaining: () => timeRemaining });
        }
      },
      flush(): void {
        while (callbacks.size) {
          this.runNext(Infinity);
        }
      }
    };
  });
  await ctx.page.reload();
  await openTerminal(ctx);
  await ctx.page.evaluate(() => {
    const w = window as unknown as ITestWindow;
    const addon = new w.WebglAddon();
    w.term.loadAddon(addon);
    const atlas = addon._renderer?._charAtlas;
    if (!atlas) {
      throw new Error('WebGL texture atlas must be active');
    }
    w.warmUpTest.flush();
    atlas.clearTexture();
    w.warmUpTest.atlas = atlas;
    const fillText = atlas._tmpCtx.fillText.bind(atlas._tmpCtx);
    atlas._tmpCtx.fillText = (text, x, y, maxWidth) => {
      w.warmUpTest.draws.push(text);
      fillText(text, x, y, maxWidth);
    };
    atlas.warmUp();
  });
  expect(await ctx.page.evaluate(() => (window as unknown as ITestWindow).warmUpTest.callbacks.size)).toBe(1);
});

test.afterEach(async () => {
  await ctx.page.close();
});

test.describe('texture atlas warm-up', () => {
  if (platform() === 'linux') {
    test.skip(({ browserName }) => browserName === 'firefox' || browserName === 'webkit');
  }

  test('warms up every ASCII glyph once while the atlas is live', async () => {
    const result = await ctx.page.evaluate(() => {
      const state = (window as unknown as ITestWindow).warmUpTest;
      state.atlas!.warmUp();
      state.flush();
      return { draws: state.draws, pending: state.callbacks.size };
    });
    expect(result.draws).toEqual(Array.from({ length: 93 }, (_, i) => String.fromCharCode(i + 33)));
    expect(result.pending).toBe(0);
  });

  for (const partial of [false, true]) {
    test(`cancels ${partial ? 'remaining' : 'all'} warm-up work when the last owner is disposed`, async () => {
      const result = await ctx.page.evaluate(runFirst => {
        const w = window as unknown as ITestWindow;
        const state = w.warmUpTest;
        if (runFirst) {
          state.runNext(0);
        }
        const before = state.draws.length;
        w.term.dispose();
        const pending = state.callbacks.size;
        state.flush();
        return { before, pending, after: state.draws.length };
      }, partial);
      expect(result.before).toBe(partial ? 1 : 0);
      expect(result.after).toBe(result.before);
      expect(result.pending).toBe(0);
    });
  }

  test('cancels the previous queue when warm-up restarts after a clear', async () => {
    const result = await ctx.page.evaluate(() => {
      const state = (window as unknown as ITestWindow).warmUpTest;
      state.runNext(0);
      const previousId = state.callbacks.keys().next().value!;
      state.atlas!.clearTexture();
      state.atlas!.warmUp();
      const previousPending = state.callbacks.has(previousId);
      const pending = state.callbacks.size;
      state.draws.length = 0;
      state.flush();
      return { previousPending, pending, draws: state.draws };
    });
    expect(result.previousPending).toBe(false);
    expect(result.pending).toBe(1);
    expect(result.draws).toEqual(Array.from({ length: 93 }, (_, i) => String.fromCharCode(i + 33)));
  });

  test('preserves warm-up while a shared atlas still has an owner', async () => {
    const result = await ctx.page.evaluate(() => {
      const w = window as unknown as ITestWindow;
      const state = w.warmUpTest;
      const element = document.createElement('div');
      document.body.appendChild(element);
      const terminal = new w.Terminal({ allowProposedApi: true });
      terminal.open(element);
      const addon = new w.WebglAddon();
      terminal.loadAddon(addon);
      const shared = addon._renderer?._charAtlas === state.atlas;
      state.flush();
      state.atlas!.clearTexture();
      state.draws.length = 0;
      state.atlas!.warmUp();
      w.term.dispose();
      const pending = state.callbacks.size;
      state.flush();
      terminal.dispose();
      return { shared, pending, draws: state.draws };
    });
    expect(result.shared).toBe(true);
    expect(result.pending).toBe(1);
    expect(result.draws).toEqual(Array.from({ length: 93 }, (_, i) => String.fromCharCode(i + 33)));
  });

  test('#5455: draws warm-up glyphs with the terminal element\'s font-feature-settings', async () => {
    const result = await ctx.page.evaluate(() => {
      const w = window as unknown as ITestWindow;
      const state = w.warmUpTest;
      const element = document.createElement('div');
      document.body.appendChild(element);
      // A different font size gives this terminal its own atlas, with nothing drawn yet
      const terminal = new w.Terminal({ fontSize: 20 });
      terminal.open(element);
      // The same style the ligatures addon sets
      terminal.element!.style.fontFeatureSettings = '"zero" on';
      const addon = new w.WebglAddon();
      terminal.loadAddon(addon);
      const atlas = addon._renderer!._charAtlas!;
      const featureSettings: string[] = [];
      const fillText = atlas._tmpCtx.fillText.bind(atlas._tmpCtx);
      atlas._tmpCtx.fillText = (text, x, y, maxWidth) => {
        featureSettings.push(getComputedStyle(atlas._tmpCtx.canvas).fontFeatureSettings);
        fillText(text, x, y, maxWidth);
      };
      state.flush();
      const expected = getComputedStyle(terminal.element!).fontFeatureSettings;
      terminal.dispose();
      element.remove();
      return { separate: atlas !== state.atlas, expected, featureSettings };
    });
    expect(result.separate).toBe(true);
    expect(result.expected).not.toBe('normal');
    expect(result.featureSettings).toEqual(Array(93).fill(result.expected));
  });

  test('does not move the canvas from a live owner into the element of a disposed owner', async () => {
    const result = await ctx.page.evaluate(() => {
      const w = window as unknown as ITestWindow;
      const state = w.warmUpTest;
      const element = document.createElement('div');
      document.body.appendChild(element);
      const terminal = new w.Terminal({ allowProposedApi: true });
      terminal.open(element);
      const addon = new w.WebglAddon();
      terminal.loadAddon(addon);
      const shared = addon._renderer?._charAtlas === state.atlas;
      state.flush();
      state.atlas!.clearTexture();
      // A glyph drawn for the other owner moves the canvas into its element
      state.atlas!.getRasterizedGlyph(0xE9, 0, 0, 0, false, terminal.element);
      state.atlas!.warmUp(w.term.element);
      w.term.dispose();
      state.flush();
      const inLiveOwner = !!terminal.element?.contains(state.atlas!._tmpCtx.canvas);
      terminal.dispose();
      element.remove();
      return { shared, inLiveOwner };
    });
    expect(result.shared).toBe(true);
    expect(result.inLiveOwner).toBe(true);
  });
});
