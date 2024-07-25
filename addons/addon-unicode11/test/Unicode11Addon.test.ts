/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test from '@playwright/test';
import { deepStrictEqual } from 'assert';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx);
});
test.afterAll(async () => await ctx.page.close());

test.describe('Unicode11Addon', () => {

  test.beforeEach(async () => {
    await ctx.page.evaluate(`
      window.term.reset()
      window.unicode11?.dispose();
      window.unicode11 = new Unicode11Addon();
      window.term.loadAddon(window.unicode11);
    `);
  });

  test('wcwidth V11 emoji test', async () => {
    // should have loaded '11'
    deepStrictEqual((await ctx.page.evaluate(`window.term.unicode.versions`) as string[]).includes('11'), true);
    // switch should not throw
    await ctx.page.evaluate(`window.term.unicode.activeVersion = '11';`);
    deepStrictEqual(await ctx.page.evaluate(`window.term.unicode.activeVersion`), '11');
    // v6: 10, V11: 20
    deepStrictEqual(await ctx.page.evaluate(`window.term._core.unicodeService.getStringCellWidth('🤣🤣🤣🤣🤣🤣🤣🤣🤣🤣')`), 20);
  });
});
