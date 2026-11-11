/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { test } from '@playwright/test';
import { deepStrictEqual, ok, strictEqual } from 'assert';
import { createTestContext, ITestContext, openTerminal, pollFor } from './TestUtils';
import { IRenderDimensions } from '../../src/browser/renderer/shared/Types';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx);
});
test.afterAll(async () => await ctx.page.close());

test.describe('RenderService dimensions after dispose', () => {
  test('dimensions does not throw after dispose', async () => {
    // Cold read: openTerminal does not write, so nothing on the open path (including
    // _syncTextArea) touches RenderService.dimensions. Sample the live renderer directly,
    // dispose, then read the getter. A 0×0 fallback or a TypeError must fail (#6070).
    await openTerminal(ctx);
    const size: { width: number, height: number } = await ctx.page.evaluate(`
      (() => {
        const dimensions = window.term._core._renderService._renderer.value.dimensions;
        return { width: dimensions.css.canvas.width, height: dimensions.css.canvas.height };
      })()
    `);
    ok(size.width > 0);
    ok(size.height > 0);

    await ctx.page.evaluate(`window.term.dispose()`);
    const dimensions: IRenderDimensions = await ctx.page.evaluate(`window.term._core._renderService.dimensions`);
    strictEqual(dimensions.css.canvas.width, size.width);
    strictEqual(dimensions.css.canvas.height, size.height);
    ok(dimensions.css.canvas.width > 0);
    ok(dimensions.css.canvas.height > 0);
    ok(dimensions.css.cell.width > 0);

    // leave the page in a clean state for the next test
    await openTerminal(ctx);
  });

  test('a mouseup/mousemove reaching a disposed terminal mid-drag does not throw', async () => {
    // Companion end-to-end guard for the listener-lifecycle half of the same reports
    // (xtermjs/xterm.js#6070, #6086): document-level mouseup/mousemove listeners installed for
    // mouse reporting must not survive dispose() mid-drag. Fixed by #6019 registering them as
    // MutableDisposables; this exercises that path directly rather than the getter above.
    const errors: string[] = [];
    const onPageError = (e: Error): number => errors.push(e.message);
    ctx.page.on('pageerror', onPageError);

    try {
      // enable mouse-drag reporting (DECSET 1002), same as an app like vim/tmux would
      await ctx.proxy.write('\x1b[?1002h');

      const rect: { left: number, top: number, width: number, height: number } = await ctx.page.evaluate(`
        window.term.element.getBoundingClientRect().toJSON()
      `);
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      await ctx.page.mouse.move(x, y);
      await ctx.page.mouse.down({ button: 'left' });

      // dispose while the button is still held, before the paired mouseup can self-remove
      // the document-level listeners
      await ctx.page.evaluate(`window.term.dispose()`);

      // the release the disposed terminal never got to see
      await ctx.page.mouse.up({ button: 'left' });
      // and a move for good measure, covering the mousemove listener too
      await ctx.page.mouse.move(x + 10, y + 10);
    } finally {
      ctx.page.off('pageerror', onPageError);
    }

    deepStrictEqual(errors, []);

    // leave the page in a clean state for any tests that might run after this file
    await openTerminal(ctx);
  });
});

test.describe('RenderService resize while paused', () => {
  // While the terminal is off screen its renderer is paused and a resize reaches the renderer
  // later. Putting a terminal back and resizing it in the same task, as a layout that moves a
  // terminal between containers does, lands the resize before the renderer resumes.
  async function resizeWhileOffScreen(rows: number): Promise<void> {
    await ctx.page.evaluate(`
      window.terminalParent = window.term.element.parentElement;
      window.term.element.remove();
    `);
    await pollFor(ctx.page, `window.term._core._renderService._isPaused`, true);
    // Hold back idle callbacks so the renderer takes the new size only when it resumes, after the
    // viewport's queued sync has run. An idle period before the next frame would otherwise let it
    // take the size first and hide the problem.
    await ctx.page.evaluate(`
      if (window.requestIdleCallback) {
        window.originalRequestIdleCallback = window.requestIdleCallback;
        window.requestIdleCallback = () => 0;
      }
      window.terminalParent.appendChild(window.term.element);
      window.term.resize(window.term.cols, ${rows});
    `);
    try {
      await pollFor(ctx.page, `window.term._core._renderService._isPaused`, false);
    } finally {
      await ctx.page.evaluate(`
        if (window.originalRequestIdleCallback) {
          window.requestIdleCallback = window.originalRequestIdleCallback;
          delete window.originalRequestIdleCallback;
        }
      `);
    }
  }

  test.beforeEach(async () => {
    await openTerminal(ctx, { rows: 10 });
  });

  test('fires onDimensionsChange when the resize reaches the renderer', async () => {
    await ctx.page.evaluate(`
      window.canvasHeights = [];
      window.term.onDimensionsChange(e => window.canvasHeights.push(e.css.canvas.height));
    `);
    await resizeWhileOffScreen(20);
    const canvasHeight: number = await ctx.page.evaluate(`window.term.dimensions.css.canvas.height`);
    await pollFor(ctx.page, `window.canvasHeights.at(-1)`, canvasHeight);
  });

  test('leaves the viewport without a scroll range in the alternate buffer', async () => {
    // A full screen application repaints in place and never scrolls, so no scroll event would
    // sync the viewport again (#6117)
    await ctx.proxy.write('\x1b[?1049h');
    await resizeWhileOffScreen(20);
    const canvasHeight: number = await ctx.page.evaluate(`window.term.dimensions.css.canvas.height`);
    await pollFor(ctx.page, `(() => {
      const dimensions = window.term._core._viewport._scrollableElement.getScrollDimensions();
      return [dimensions.height, dimensions.scrollHeight];
    })()`, [canvasHeight, canvasHeight]);
  });

  test('keeps following output in the normal buffer after shrinking', async () => {
    // Syncing to the old, taller canvas would clamp the scroll position short of the bottom, which
    // reads as the user scrolling up
    await ctx.proxy.write(Array.from({ length: 50 }, (_, i) => `line ${i}`).join('\r\n'));
    await resizeWhileOffScreen(5);
    await ctx.proxy.write('\r\nnew output');
    await pollFor(ctx.page, `window.term.buffer.active.viewportY === window.term.buffer.active.baseY`, true);
  });
});
