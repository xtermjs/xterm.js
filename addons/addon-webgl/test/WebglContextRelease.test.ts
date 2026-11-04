/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test, { expect } from '@playwright/test';
import { createTestContext, openTerminal } from '../../../test/playwright/TestUtils';
import { platform } from 'os';

test.describe('WebGL context release on dispose', () => {
  // HACK: webgl2 is often not supported in headless firefox on Linux
  // https://github.com/microsoft/playwright/issues/11566, also disable safari (#5852)
  if (platform() === 'linux') {
    test.skip(({ browserName }) => browserName === 'firefox' || browserName === 'webkit');
  }

  // Detaching the canvas on dispose does not free the underlying WebGL2
  // context; it lingers until GC. Browsers cap the number of live contexts per
  // document (Chromium ~16) and force-evict the oldest LIVE context when the cap
  // is exceeded, blanking an active terminal. dispose() must explicitly release
  // the context via WEBGL_lose_context.loseContext().
  //
  // The cap-eviction itself is GPU/driver dependent and does not reproduce under
  // headless SwiftShader, so instead of asserting on eviction this verifies the
  // mechanism directly: that dispose invokes loseContext() on the context.
  test('dispose calls WEBGL_lose_context.loseContext() on the renderer context', async ({ browser }) => {
    const ctx = await createTestContext(browser);
    try {
      await openTerminal(ctx);

      const result = await ctx.page.evaluate(() => {
        const w = window as any;

        // Spy on loseContext for any WEBGL_lose_context extension handed out
        // while this addon is alive.
        const proto = w.WebGL2RenderingContext.prototype;
        const originalGetExtension = proto.getExtension;
        let loseContextCalls = 0;
        proto.getExtension = function (name: string): any {
          const ext = originalGetExtension.call(this, name);
          if (name === 'WEBGL_lose_context' && ext && !ext.__spied) {
            const originalLoseContext = ext.loseContext.bind(ext);
            ext.loseContext = () => {
              loseContextCalls++;
              originalLoseContext();
            };
            ext.__spied = true;
          }
          return ext;
        };

        try {
          const el = document.createElement('div');
          document.body.appendChild(el);
          const term = new w.Terminal({ cols: 80, rows: 24, allowProposedApi: true });
          term.open(el);
          const addon = new w.WebglAddon();
          term.loadAddon(addon);
          const rendererAttached = !!addon._renderer;

          const callsBeforeDispose = loseContextCalls;
          addon.dispose();
          const callsAfterDispose = loseContextCalls;

          term.dispose();
          el.remove();
          return { rendererAttached, callsBeforeDispose, callsAfterDispose };
        } finally {
          proto.getExtension = originalGetExtension;
        }
      });

      test.skip(!result.rendererAttached, 'WebGL2 renderer not available in this browser');
      expect(result.callsBeforeDispose, 'context must not be lost before dispose').toBe(0);
      expect(result.callsAfterDispose, 'dispose must release the WebGL context').toBe(1);
    } finally {
      await ctx.page.close();
    }
  });
});
