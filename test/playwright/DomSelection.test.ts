/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { test, expect } from '@playwright/test';
import { ITestContext, createTestContext, openTerminal } from './TestUtils';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
});
test.afterAll(async () => await ctx.page.close());
test.beforeEach(async () => {
  await openTerminal(ctx, { cols: 80, rows: 24 });
  await ctx.proxy.write('selection regression test');
});

async function waitForRender(): Promise<void> {
  await ctx.page.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
}

test.describe('DOM selection after resize', () => {
  for (const action of ['clearSelection', 'input'] as const) {
    test(`should not redraw a selection cleared by ${action}`, async () => {
      await ctx.proxy.select(0, 0, 20);
      await expect(ctx.page.locator('.xterm-selection > div')).not.toHaveCount(0);
      if (action === 'clearSelection') {
        await ctx.proxy.clearSelection();
      } else {
        await ctx.page.evaluate('window.term.input("\\r", true)');
      }
      await waitForRender();
      expect(await ctx.proxy.hasSelection()).toBe(false);
      await expect(ctx.page.locator('.xterm-selection > div')).toHaveCount(0);

      for (const cols of [90, 80, 100, 85]) {
        await ctx.proxy.resize(cols, 24);
        await waitForRender();
        expect(await ctx.proxy.hasSelection()).toBe(false);
        await expect(ctx.page.locator('.xterm-selection > div')).toHaveCount(0);
      }
    });
  }

  test('should preserve a live selection across column changes', async () => {
    await ctx.proxy.select(0, 0, 20);
    await expect(ctx.page.locator('.xterm-selection > div')).not.toHaveCount(0);
    for (const cols of [90, 80, 100, 85]) {
      await ctx.proxy.resize(cols, 24);
      await waitForRender();
      expect(await ctx.proxy.getSelection()).toBe('selection regression');
      await expect(ctx.page.locator('.xterm-selection > div')).not.toHaveCount(0);
    }
  });
});
