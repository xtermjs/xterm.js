/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { test } from '@playwright/test';
import { deepStrictEqual } from 'assert';
import { createTestContext, ITestContext, openTerminal, pollFor } from './TestUtils';

const cols = 10;

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
});
test.afterAll(async () => await ctx.page.close());

async function selectInAccessibilityTree(setRange: string): Promise<void> {
  await ctx.page.evaluate(`
    (() => {
      const rows = document.querySelector('.xterm-accessibility-tree').children;
      const text = i => rows[i].childNodes[0];
      const range = document.createRange();
      ${setRange}
      const selection = document.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    })()
  `);
}

test.describe('AccessibilityManager', () => {
  test.describe('a selection in the accessibility tree that maps onto no cells', () => {
    let errors: string[];
    const onPageError = (e: Error): number => errors.push(e.message);

    test.beforeEach(async () => {
      await openTerminal(ctx, { screenReaderMode: true, cols, rows: 3 });
      await ctx.proxy.write('X'.repeat(cols) + 'Y'.repeat(cols) + 'short');
      await pollFor(ctx.page, `document.querySelector('.xterm-accessibility-tree').children[2].textContent`, 'short');
      await selectInAccessibilityTree(`range.setStart(text(0), 0); range.setEnd(text(0), ${cols});`);
      await pollFor(ctx.page, `window.term.getSelection()`, 'X'.repeat(cols));
      errors = [];
      ctx.page.on('pageerror', onPageError);
    });
    test.afterEach(() => {
      ctx.page.off('pageerror', onPageError);
    });

    test('from the end of a full row to the start of the next row', async () => {
      await selectInAccessibilityTree(`range.setStart(text(0), ${cols}); range.setEnd(text(1), 0);`);
      await pollFor(ctx.page, `window.term.hasSelection()`, false);
      deepStrictEqual(errors, []);
    });

    test('from above the terminal to the start of the first row', async () => {
      await selectInAccessibilityTree(`range.setStart(document.body, 0); range.setEnd(text(0), 0);`);
      await pollFor(ctx.page, `window.term.hasSelection()`, false);
      deepStrictEqual(errors, []);
    });

    test('from the end of the last row to below the terminal', async () => {
      await selectInAccessibilityTree(`range.setStart(text(2), 5); range.setEnd(document.body.appendChild(document.createElement('div')), 0);`);
      await pollFor(ctx.page, `window.term.hasSelection()`, false);
      deepStrictEqual(errors, []);
    });
  });
});
