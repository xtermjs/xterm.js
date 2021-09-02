import { test } from '@playwright/test';
import { strictEqual } from 'assert';
import { createTextContext as createTestContext, ITestContext, openTerminal, asyncThrows, pollFor } from './TestUtils';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => ctx = await createTestContext(browser));

test.describe.serial('API integration tests', () => {
  test.beforeEach(async () => await openTerminal(ctx));

  test('Default options', async () => {
    await ctx.page.evaluate(([term]) => term.cols, [ctx.termHandle]);
    strictEqual(await ctx.proxy.cols, 80);
    strictEqual(await ctx.proxy.rows, 24);
  });

  test('Proposed API check', async () => {
    await openTerminal(ctx, { allowProposedApi: false });
    await asyncThrows(async () => await ctx.proxy.evaluate(([term]) => term.buffer), 'You must set the allowProposedApi option to true to use proposed API');
  });

  test('write', async () => {
    await ctx.proxy.write('foo');
    await ctx.proxy.write('bar');
    await ctx.proxy.write('文');
    strictEqual(await (await ctx.proxy.buffer.active.getLine(0))!.translateToString(true), 'foobar文');
  });

  test('write - bytes (UTF8)', async () => {
    await ctx.proxy.write(new Uint8Array([102, 111, 111])); // foo
    await ctx.proxy.write(new Uint8Array([98, 97, 114])); // bar
    await ctx.proxy.write(new Uint8Array([230, 150, 135])); // 文
    strictEqual(await (await ctx.proxy.buffer.active.getLine(0))!.translateToString(true), 'foobar文');
  });
});
