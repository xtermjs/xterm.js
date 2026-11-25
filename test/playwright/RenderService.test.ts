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

test.describe('RenderService while the terminal is not visible', () => {
  test.afterEach(async () => {
    await ctx.page.evaluate(`document.querySelector('#terminal-container').style.transform = ''`);
    await openTerminal(ctx);
  });

  test('does not redraw rows for output, a held selection, blur or focus until visible again', async () => {
    await openTerminal(ctx, { cursorBlink: false, cols: 40, rows: 10, theme: { selectionForeground: '#ff0000' } });
    for (let i = 0; i < 12; i++) {
      await ctx.proxy.writeln(`before ${i}`);
    }
    await ctx.page.evaluate(`window.term.selectAll()`);
    // Let the selection and the output render while visible.
    await ctx.page.evaluate(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);

    // Out of the viewport, keeping its size, so the IntersectionObserver pauses rendering.
    await ctx.page.evaluate(`document.querySelector('#terminal-container').style.transform = 'translateX(-100000px)'`);
    await pollFor(ctx.page, `window.term._core._renderService._isPaused`, true);
    await ctx.page.evaluate(`
      window.rowChanges = 0;
      window.rowObserver = new MutationObserver(records => window.rowChanges += records.length);
      window.rowObserver.observe(document.querySelector('.xterm-rows'), { childList: true, subtree: true, characterData: true });
    `);
    const baseYBefore: number = await ctx.page.evaluate(`window.term.buffer.active.baseY`);

    // Output that scrolls, with the selection still held, then focus changes ending blurred.
    for (let i = 0; i < 30; i++) {
      await ctx.proxy.writeln(`while hidden ${i}`);
    }
    for (let i = 0; i < 5; i++) {
      await ctx.page.evaluate(`window.term.focus()`);
      await ctx.page.evaluate(`window.term.blur()`);
    }
    await ctx.page.evaluate(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))))`);

    strictEqual(await ctx.page.evaluate(`window.term.hasSelection()`), true);
    const baseYAfter: number = await ctx.page.evaluate(`window.term.buffer.active.baseY`);
    ok(baseYAfter > baseYBefore, 'the buffer took the output');
    strictEqual(await ctx.page.evaluate(`window.rowChanges`), 0, 'no row was redrawn while not visible');
    await ctx.page.evaluate(`window.rowObserver.disconnect()`);

    // Visible again: the latest output is drawn, in the selection's colour, with a blurred cursor.
    await ctx.page.evaluate(`document.querySelector('#terminal-container').style.transform = ''`);
    await pollFor(ctx.page, `window.term._core._renderService._isPaused`, false);
    await pollFor(ctx.page, `document.querySelector('.xterm-rows').textContent.includes('while hidden 29')`, true);
    const selectionParts: number = await ctx.page.evaluate(`document.querySelectorAll('.xterm-selection div').length`);
    ok(selectionParts > 0, 'the selection is drawn');
    strictEqual(await ctx.page.evaluate(`document.querySelector('.xterm-rows').classList.contains('xterm-focus')`), false);
    const latestColour: string = await ctx.page.evaluate(`(() => {
      const row = [...document.querySelectorAll('.xterm-rows > div')].find(r => r.textContent.includes('while hidden 29'));
      return row ? getComputedStyle(row.querySelector('span')).color : 'no row';
    })()`);
    strictEqual(latestColour, 'rgb(255, 0, 0)', 'the latest output is drawn as selected');
    const cursorClasses: string = await ctx.page.evaluate(`document.querySelector('.xterm-rows .xterm-cursor')?.className ?? 'no cursor'`);
    ok(cursorClasses.includes('xterm-cursor-outline'), `the cursor is drawn inactive: ${cursorClasses}`);
  });
});
