/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Playwright integration tests for Kitty Graphics Addon.
 * These test the addon in a real browser with visual verification.
 *
 * Unit tests for parsing are in src/KittyGraphicsAddon.test.ts
 */

import test from '@playwright/test';
import { deepStrictEqual, strictEqual } from 'assert';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';

let ctx: ITestContext;

test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
});

test.afterAll(async () => {
  await ctx.page.close();
});

test.describe('KittyGraphicsAddon', () => {
  test.beforeEach(async () => {
    await openTerminal(ctx, { cols: 80, rows: 24 });
    await ctx.page.evaluate(`
      window.term.reset();
    `);
  });

  test('addon should be loaded and activated', async () => {
    // Verify the addon is available on the window
    const hasAddon = await ctx.page.evaluate(`typeof window.KittyGraphicsAddon !== 'undefined'`);
    strictEqual(hasAddon, true, 'KittyGraphicsAddon should be available');
  });

  // TODO: WAYYYYYY More tests that would initially fail, but work when addon work is complete. Like implementation of the handler.

});
