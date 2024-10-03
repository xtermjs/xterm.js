/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import test from '@playwright/test';
import { deepStrictEqual, strictEqual } from 'assert';
import { ITestContext, createTestContext, openTerminal, pollFor, timeout } from '../../../test/playwright/TestUtils';


let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx, { cols: 40 });
});
test.afterAll(async () => await ctx.page.close());

test.describe('WebFontsAddon', () => {
  test('nothing', () => {});
});
