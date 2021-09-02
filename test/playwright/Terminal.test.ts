import { Page, test } from '@playwright/test';
import { fail, ok, strictEqual, throws } from 'assert';
import { createTextContext as createTestContext, ITestContext, openTerminal, asyncThrows } from './TestUtils';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => ctx = await createTestContext(browser));

test.describe.serial('API integration tests', () => {
  test('Default options', async () => {
    await openTerminal(ctx);
    await ctx.page.evaluate(([term]) => term.cols, [ctx.termHandle]);
    strictEqual(await ctx.proxy.cols, 80);
    strictEqual(await ctx.proxy.rows, 24);
  });

  test('Proposed API check', async () => {
    await openTerminal(ctx, { allowProposedApi: false });
    await asyncThrows(() => ctx.proxy.evaluate(([term]) => term.buffer), 'You must set the allowProposedApi option to true to use proposed API');
  });
});
