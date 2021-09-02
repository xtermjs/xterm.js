import { Page, test } from '@playwright/test';
import { strictEqual } from 'assert';
import { createTextContext as createTestContext, ITestContext, openTerminal, pollFor } from './TestUtils';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => ctx = await createTestContext(browser));

test.describe.serial('API integration tests', () => {
  test('Default options', async () => {
    await openTerminal(ctx);
    await ctx.page.evaluate(([term]) => term.cols, [ctx.termHandle]);
    strictEqual(await ctx.proxy.cols, 81);
    strictEqual(await ctx.proxy.rows, 24);
  });

  test('Proposed API check', async () => {
    await openTerminal(ctx, { allowProposedApi: false });
    await ctx.page.evaluate(`
      try {
        window.term.buffer;
      } catch (e) {
        window.throwMessage = e.message;
      }
    `);
    await pollFor(ctx.page, 'window.throwMessage', 'You must set the allowProposedApi option to true to use proposed API');
  });
});
