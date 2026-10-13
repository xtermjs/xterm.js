/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { test } from '@playwright/test';
import { deepStrictEqual } from 'assert';
import { createTestContext, ITestContext, openTerminal } from './TestUtils';
import { IRenderDimensions } from '../../src/browser/renderer/shared/Types';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx);
});
test.afterAll(async () => await ctx.page.close());

test.describe('RenderService dimensions after dispose', () => {
  test('dimensions does not throw after dispose', async () => {
    // RenderService.dimensions used a non-null assertion on the (MutableDisposable-cleared)
    // renderer, so any caller reaching it after dispose() got an uncaught TypeError instead of
    // a value (xtermjs/xterm.js#6070). CoreBrowserTerminal never nulls out its _renderService
    // reference on dispose, so this is reachable by anything holding on to the terminal, a
    // service, or (before #6019) a leaked document-level listener.
    await ctx.page.evaluate(`window.term.dispose()`);
    const dimensions: IRenderDimensions = await ctx.page.evaluate(`window.term._core._renderService.dimensions`);
    deepStrictEqual(typeof dimensions, 'object');
    deepStrictEqual(typeof dimensions.css.cell.width, 'number');

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
