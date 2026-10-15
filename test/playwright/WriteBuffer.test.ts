/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { createTestContext, ITestContext, openTerminal } from './TestUtils';

let ctx: ITestContext;
test.beforeEach(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx, { cols: 40, rows: 10, scrollback: 100 });
});
test.afterEach(async () => ctx.page.close());

for (const fallback of [false, true]) {
  test(`burst writes yield to rendering and timers, resume async handlers (${fallback ? 'timer fallback' : 'native tasks'})`, async () => {
    const result = await ctx.page.evaluate<{ callbacks: number[], handlers: number[], frames: number, timerBeforeDone: boolean, lines: string[] }>(`(async () => {
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'scheduler');
      if (${fallback}) Object.defineProperty(globalThis, 'scheduler', { configurable: true, value: undefined });
      const callbacks = [], handlers = [];
      let frames = 0, done = false, timerBeforeDone = false;
      const sample = () => { if (!done) { frames++; requestAnimationFrame(sample); } };
      requestAnimationFrame(sample);
      setTimeout(() => { timerBeforeDone = !done; }, 0);
      const first = window.term.parser.registerCsiHandler({ final: 'z' }, params => { handlers.push(params[0]); return true; });
      const second = window.term.parser.registerCsiHandler({ final: 'z' }, () => {
        const start = performance.now();
        while (performance.now() - start < 2) {}
        return Promise.resolve(false);
      });
      try {
        const writes = [];
        const encoder = new TextEncoder();
        for (let i = 0; i < 60; i++) {
          const bytes = encoder.encode('漢');
          // Keep a partial UTF-8 sequence pending across two public writes.
          window.term.write(bytes.subarray(0, 1));
          window.term.write(bytes.subarray(1));
          writes.push(new Promise(resolve => window.term.write('\\x1b[' + i + 'z' + i + '\\r\\n', () => { callbacks.push(i); resolve(); })));
        }
        await Promise.all(writes);
        done = true;
        const lines = [];
        for (let i = 0; i < 60; i++) lines.push(window.term.buffer.active.getLine(i).translateToString(true));
        return { callbacks, handlers, frames, timerBeforeDone, lines };
      } finally {
        done = true;
        first.dispose(); second.dispose();
        if (${fallback}) {
          if (descriptor) Object.defineProperty(globalThis, 'scheduler', descriptor);
          else delete globalThis.scheduler;
        }
      }
    })()`);
    expect(result.callbacks).toEqual(Array.from({ length: 60 }, (_, i) => i));
    expect(result.handlers).toEqual(result.callbacks);
    expect(result.lines).toEqual(result.callbacks.map(i => `漢${i}`));
    expect(result.frames).toBeGreaterThan(0);
    expect(result.timerBeforeDone).toBe(true);
  });
}
