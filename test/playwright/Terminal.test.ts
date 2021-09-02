import { test } from '@playwright/test';
import { deepStrictEqual, strictEqual } from 'assert';
import { createTextContext as createTestContext, ITestContext, openTerminal, asyncThrows, pollFor } from './TestUtils';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => ctx = await createTestContext(browser));

test.describe.serial('API integration', () => {
  test.beforeEach(async () => await openTerminal(ctx));

  test('default options', async () => {
    await ctx.page.evaluate(([term]) => term.cols, [ctx.termHandle]);
    strictEqual(await ctx.proxy.cols, 80);
    strictEqual(await ctx.proxy.rows, 24);
  });

  test('proposed API check', async () => {
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

  test('clear', async () => {
    await openTerminal(ctx, { rows: 5 });
    let data = 'test0';
    for (let i = 1; i < 10; i++) {
      data += '\n\rtest' + i;
    }
    await ctx.proxy.write(data);
    await ctx.proxy.clear();
    strictEqual(await ctx.proxy.buffer.active.length, 5);
    strictEqual(await (await ctx.proxy.buffer.active.getLine(0))!.translateToString(true), 'test9');
    for (let i = 1; i < 5; i++) {
      strictEqual(await (await ctx.proxy.buffer.active.getLine(i))!.translateToString(true), '');
    }
  });

  test('getOption, setOption', async () => {
    strictEqual(await ctx.proxy.getOption('rendererType'), 'canvas');
    await ctx.proxy.setOption('rendererType', 'dom');
    strictEqual(await ctx.proxy.getOption('rendererType'), 'dom');
  });

  test.describe('renderer', () => {
    test('foreground', async () => {
      await openTerminal(ctx, { rendererType: 'dom' });
      await ctx.proxy.write('\x1b[30m0\x1b[31m1\x1b[32m2\x1b[33m3\x1b[34m4\x1b[35m5\x1b[36m6\x1b[37m7');
      await pollFor(ctx.page, `document.querySelectorAll('.xterm-rows > :nth-child(1) > *').length`, 9);
      deepStrictEqual(await ctx.page.evaluate(`
        [
          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(1)').className,
          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(2)').className,
          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(3)').className,
          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(4)').className,
          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(5)').className,
          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(6)').className,
          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(7)').className
        ]
      `), [
        'xterm-fg-0',
        'xterm-fg-1',
        'xterm-fg-2',
        'xterm-fg-3',
        'xterm-fg-4',
        'xterm-fg-5',
        'xterm-fg-6'
      ]);
    });

    test('background', async () => {
      await openTerminal(ctx, { rendererType: 'dom' });
      await ctx.proxy.write('\x1b[40m0\x1b[41m1\x1b[42m2\x1b[43m3\x1b[44m4\x1b[45m5\x1b[46m6\x1b[47m7');
      await pollFor(ctx.page, `document.querySelectorAll('.xterm-rows > :nth-child(1) > *').length`, 9);
      deepStrictEqual(await ctx.page.evaluate(`
        [
          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(1)').className,
          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(2)').className,
          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(3)').className,
          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(4)').className,
          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(5)').className,
          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(6)').className,
          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(7)').className
        ]
      `), [
        'xterm-bg-0',
        'xterm-bg-1',
        'xterm-bg-2',
        'xterm-bg-3',
        'xterm-bg-4',
        'xterm-bg-5',
        'xterm-bg-6'
      ]);
    });
  });
});
