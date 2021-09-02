import { test } from '@playwright/test';
import { deepStrictEqual, strictEqual } from 'assert';
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

  test('writeln', async () => {
    await ctx.proxy.writeln('foo');
    await ctx.proxy.writeln('bar');
    await ctx.proxy.writeln('文');
    strictEqual(await (await ctx.proxy.buffer.active.getLine(0))!.translateToString(true), 'foo');
    strictEqual(await (await ctx.proxy.buffer.active.getLine(1))!.translateToString(true), 'bar');
    strictEqual(await (await ctx.proxy.buffer.active.getLine(2))!.translateToString(true), '文');
  });

  test('writeln - bytes (UTF8)', async () => {
    await ctx.proxy.writeln(new Uint8Array([102, 111, 111])); // foo
    await ctx.proxy.writeln(new Uint8Array([98, 97, 114])); // bar
    await ctx.proxy.writeln(new Uint8Array([230, 150, 135])); // 文
    strictEqual(await (await ctx.proxy.buffer.active.getLine(0))!.translateToString(true), 'foo');
    strictEqual(await (await ctx.proxy.buffer.active.getLine(1))!.translateToString(true), 'bar');
    strictEqual(await (await ctx.proxy.buffer.active.getLine(2))!.translateToString(true), '文');
  });

  test('paste', async () => {
    const calls: string[] = [];
    await ctx.proxy.onData(e => calls.push(e));
    await ctx.proxy.paste('foo');
    await ctx.proxy.paste('\r\nfoo\nbar\r');
    await ctx.proxy.write('\x1b[?2004h');
    await ctx.proxy.paste('foo');
    deepStrictEqual(calls, ['foo', '\rfoo\rbar\r', '\x1b[200~foo\x1b[201~']);
  });

  // it('clear', async () => {
  //   await openTerminal(page, { rows: 5 });
  //   await page.evaluate(`
  //     window.term.write('test0');
  //     window.parsed = 0;
  //     for (let i = 1; i < 10; i++) {
  //       window.term.write('\\n\\rtest' + i, () => window.parsed++);
  //     }
  //   `);
  //   await pollFor(page, `window.parsed`, 9);
  //   await page.evaluate(`window.term.clear()`);
  //   await pollFor(page, `window.term.buffer.active.length`, 5);
  //   await pollFor(page, `window.term.buffer.active.getLine(0).translateToString(true)`, 'test9');
  //   for (let i = 1; i < 5; i++) {
  //     await pollFor(page, `window.term.buffer.active.getLine(${i}).translateToString(true)`, '');
  //   }
  // });

  // it('getOption, setOption', async () => {
  //   await openTerminal(page);
  //   assert.equal(await page.evaluate(`window.term.getOption('rendererType')`), 'canvas');
  //   await page.evaluate(`window.term.setOption('rendererType', 'dom')`);
  //   assert.equal(await page.evaluate(`window.term.getOption('rendererType')`), 'dom');
  // });
});
