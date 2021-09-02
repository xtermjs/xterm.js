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

  test('selection', async () => {
    await openTerminal(ctx, { rows: 5, cols: 5 });
    await ctx.proxy.write(`\n\nfoo\n\n\rbar\n\n\rbaz`);
    strictEqual(await ctx.proxy.hasSelection(), false);
    strictEqual(await ctx.proxy.getSelection(), '');
    deepStrictEqual(await ctx.proxy.getSelectionPosition(), undefined);
    await ctx.proxy.selectAll();
    strictEqual(await ctx.proxy.hasSelection(), true);
    if (process.platform === 'win32') {
      strictEqual(await ctx.proxy.getSelection(), '\r\n\r\nfoo\r\n\r\nbar\r\n\r\nbaz');
    } else {
      strictEqual(await ctx.proxy.getSelection(), '\n\nfoo\n\nbar\n\nbaz');
    }
    deepStrictEqual(await ctx.proxy.getSelectionPosition(), { startColumn: 0, startRow: 0, endColumn: 5, endRow: 6 });
    await ctx.proxy.clearSelection();
    strictEqual(await ctx.proxy.hasSelection(), false);
    strictEqual(await ctx.proxy.getSelection(), '');
    deepStrictEqual(await ctx.proxy.getSelectionPosition(), undefined);
    await ctx.proxy.select(1, 2, 2);
    strictEqual(await ctx.proxy.hasSelection(), true);
    strictEqual(await ctx.proxy.getSelection(), 'oo');
    deepStrictEqual(await ctx.proxy.getSelectionPosition(), { startColumn: 1, startRow: 2, endColumn: 3, endRow: 2 });
  });

  test('focus, blur', async () => {
    strictEqual(await ctx.page.evaluate(`document.activeElement.className`), '');
    await ctx.proxy.focus();
    strictEqual(await ctx.page.evaluate(`document.activeElement.className`), 'xterm-helper-textarea');
    await ctx.proxy.blur();
    strictEqual(await ctx.page.evaluate(`document.activeElement.className`), '');
  });

  test.describe('loadAddon', () => {
    test('constructor', async () => {
      await openTerminal(ctx, { cols: 5 });
      await ctx.page.evaluate(`
        window.cols = 0;
        window.term.loadAddon({
          activate: (t) => window.cols = t.cols,
          dispose: () => {}
        });
      `);
      strictEqual(await ctx.proxy.cols, 5);
    });

    test('dispose (addon)', async () => {
      await ctx.page.evaluate(`
        window.disposeCalled = false
        window.addon = {
          activate: () => {},
          dispose: () => window.disposeCalled = true
        };
        window.term.loadAddon(window.addon);
      `);
      strictEqual(await ctx.page.evaluate(`window.disposeCalled`), false);
      await ctx.page.evaluate(`window.addon.dispose()`);
      strictEqual(await ctx.page.evaluate(`window.disposeCalled`), true);
    });

    test('dispose (terminal)', async () => {
      await ctx.page.evaluate(`
        window.disposeCalled = false
        window.term.loadAddon({
          activate: () => {},
          dispose: () => window.disposeCalled = true
        });
      `);
      strictEqual(await ctx.page.evaluate(`window.disposeCalled`), false);
      await ctx.page.evaluate(`window.term.dispose()`);
      strictEqual(await ctx.page.evaluate(`window.disposeCalled`), true);
    });
  });

  test.describe('Events', () => {
    test('onBell', async () => {
      let callCount = 0;
      ctx.proxy.onBell(() => callCount++);
      strictEqual(callCount, 0);
      await ctx.proxy.write('\x07');
      strictEqual(callCount, 1);
    });

    // TODO: onBinary test

    test('onCursorMove', async () => {
      let callCount = 0;
      ctx.proxy.onCursorMove(() => callCount++);
      await ctx.proxy.write('foo');
      strictEqual(callCount, 1);
      await ctx.proxy.write('bar');
      strictEqual(callCount, 2);
    });

    test('onData', async () => {
      const calls: string[] = [];
      ctx.proxy.onData(e => calls.push(e));
      await ctx.page.type('.xterm-helper-textarea', 'foo');
      deepStrictEqual(calls, ['f', 'o', 'o']);
    });

    test('onKey', async () => {
      const calls: string[] = [];
      ctx.proxy.onKey(e => calls.push(e.key));
      await ctx.page.type('.xterm-helper-textarea', 'foo');
      deepStrictEqual(calls, ['f', 'o', 'o']);
    });

    test('onLineFeed', async () => {
      let callCount = 0;
      ctx.proxy.onLineFeed(() => callCount++);
      await ctx.proxy.writeln('foo');
      strictEqual(callCount, 1);
      await ctx.proxy.writeln('bar');
      strictEqual(callCount, 2);
    });

    test('onScroll', async () => {
      await openTerminal(ctx, { rows: 5 });
      const calls: number[] = [];
      ctx.proxy.onScroll(e => calls.push(e));
      for (let i = 0; i < 4; i++) {
        await ctx.proxy.writeln('foo');
      }
      deepStrictEqual(calls, []);
      await ctx.proxy.writeln('bar');
      deepStrictEqual(calls, [1]);
      await ctx.proxy.writeln('baz');
      deepStrictEqual(calls, [1, 2]);
    });

    test('onSelectionChange', async () => {
      let callCount = 0;
      ctx.proxy.onSelectionChange(() => callCount++);
      strictEqual(callCount, 0);
      await ctx.proxy.selectAll();
      strictEqual(callCount, 1);
      await ctx.proxy.clearSelection();
      strictEqual(callCount, 2);
    });

    test('onRender', async function(): Promise<void> {
      const calls: { start: number, end: number }[] = [];
      ctx.proxy.onRender(e => calls.push(e));
      deepStrictEqual(calls, []);
      // Polling is required here because the event is fired on the animation frame
      await ctx.proxy.write('foo');
      await pollFor(ctx.page, async () => calls, [{ start: 0, end: 0 }]);
      await ctx.proxy.write('bar\n\nbaz');
      await pollFor(ctx.page, async () => calls, [{ start: 0, end: 0 }, { start: 0, end: 2 }]);
    });

    test('onResize', async () => {
      // await timeout(20); // Ensure all init events are fired
      const calls: { cols: number, rows: number }[] = [];
      ctx.proxy.onResize(e => calls.push(e));
      deepStrictEqual(calls, []);
      await ctx.proxy.resize(10, 5);
      deepStrictEqual(calls, [{ cols: 10, rows: 5 }]);
      await ctx.proxy.resize(20, 15);
      deepStrictEqual(calls, [{ cols: 10, rows: 5 }, { cols: 20, rows: 15 }]);
    });

    test('onTitleChange', async () => {
      const calls: string[] = [];
      ctx.proxy.onTitleChange(e => calls.push(e));
      deepStrictEqual(calls, []);
      await ctx.proxy.write('\x1b]2;foo\x9c');
      deepStrictEqual(calls, ['foo']);
    });
  });

  // describe('buffer', () => {
  //   test('cursorX, cursorY', async () => {
  //     await openTerminal(ctx, { rows: 5, cols: 5 });
  //     assert.equal(await page.evaluate(`window.term.buffer.active.cursorX`), 0);
  //     assert.equal(await page.evaluate(`window.term.buffer.active.cursorY`), 0);
  //     await ctx.proxy.write('foo');
  //     assert.equal(await page.evaluate(`window.term.buffer.active.cursorX`), 3);
  //     assert.equal(await page.evaluate(`window.term.buffer.active.cursorY`), 0);
  //     await ctx.proxy.write('\\n');
  //     assert.equal(await page.evaluate(`window.term.buffer.active.cursorX`), 3);
  //     assert.equal(await page.evaluate(`window.term.buffer.active.cursorY`), 1);
  //     await ctx.proxy.write('\\r');
  //     assert.equal(await page.evaluate(`window.term.buffer.active.cursorX`), 0);
  //     assert.equal(await page.evaluate(`window.term.buffer.active.cursorY`), 1);
  //     await ctx.proxy.write('abcde');
  //     assert.equal(await page.evaluate(`window.term.buffer.active.cursorX`), 5);
  //     assert.equal(await page.evaluate(`window.term.buffer.active.cursorY`), 1);
  //     await ctx.proxy.write('\\n\\r\\n\\n\\n\\n\\n');
  //     assert.equal(await page.evaluate(`window.term.buffer.active.cursorX`), 0);
  //     assert.equal(await page.evaluate(`window.term.buffer.active.cursorY`), 4);
  //   });

  //   test('viewportY', async () => {
  //     await openTerminal(ctx, { rows: 5 });
  //     assert.equal(await page.evaluate(`window.term.buffer.active.viewportY`), 0);
  //     await ctx.proxy.write('\\n\\n\\n\\n');
  //     assert.equal(await page.evaluate(`window.term.buffer.active.viewportY`), 0);
  //     await ctx.proxy.write('\\n');
  //     assert.equal(await page.evaluate(`window.term.buffer.active.viewportY`), 1);
  //     await ctx.proxy.write('\\n\\n\\n\\n');
  //     assert.equal(await page.evaluate(`window.term.buffer.active.viewportY`), 5);
  //     await page.evaluate(`window.term.scrollLines(-1)`);
  //     assert.equal(await page.evaluate(`window.term.buffer.active.viewportY`), 4);
  //     await page.evaluate(`window.term.scrollToTop()`);
  //     assert.equal(await page.evaluate(`window.term.buffer.active.viewportY`), 0);
  //   });

  //   test('baseY', async () => {
  //     await openTerminal(ctx, { rows: 5 });
  //     assert.equal(await page.evaluate(`window.term.buffer.active.baseY`), 0);
  //     await ctx.proxy.write('\\n\\n\\n\\n');
  //     assert.equal(await page.evaluate(`window.term.buffer.active.baseY`), 0);
  //     await ctx.proxy.write('\\n');
  //     assert.equal(await page.evaluate(`window.term.buffer.active.baseY`), 1);
  //     await ctx.proxy.write('\\n\\n\\n\\n');
  //     assert.equal(await page.evaluate(`window.term.buffer.active.baseY`), 5);
  //     await page.evaluate(`window.term.scrollLines(-1)`);
  //     assert.equal(await page.evaluate(`window.term.buffer.active.baseY`), 5);
  //     await page.evaluate(`window.term.scrollToTop()`);
  //     assert.equal(await page.evaluate(`window.term.buffer.active.baseY`), 5);
  //   });

  //   test('length', async () => {
  //     await openTerminal(ctx, { rows: 5 });
  //     assert.equal(await page.evaluate(`window.term.buffer.active.length`), 5);
  //     await ctx.proxy.write('\\n\\n\\n\\n');
  //     assert.equal(await page.evaluate(`window.term.buffer.active.length`), 5);
  //     await ctx.proxy.write('\\n');
  //     assert.equal(await page.evaluate(`window.term.buffer.active.length`), 6);
  //     await ctx.proxy.write('\\n\\n\\n\\n');
  //     assert.equal(await page.evaluate(`window.term.buffer.active.length`), 10);
  //   });

  //   describe('getLine', () => {
  //     test('invalid index', async () => {
  //       await openTerminal(ctx, { rows: 5 });
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(-1)`), undefined);
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(5)`), undefined);
  //     });

  //     test('isWrapped', async () => {
  //       await openTerminal(ctx, { cols: 5 });
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).isWrapped`), false);
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(1).isWrapped`), false);
  //       await ctx.proxy.write('abcde');
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).isWrapped`), false);
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(1).isWrapped`), false);
  //       await ctx.proxy.write('f');
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).isWrapped`), false);
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(1).isWrapped`), true);
  //     });

  //     test('translateToString', async () => {
  //       await openTerminal(ctx, { cols: 5 });
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), '     ');
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString(true)`), '');
  //       await ctx.proxy.write('foo');
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), 'foo  ');
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString(true)`), 'foo');
  //       await ctx.proxy.write('bar');
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), 'fooba');
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString(true)`), 'fooba');
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(1).translateToString(true)`), 'r');
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString(false, 1)`), 'ooba');
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString(false, 1, 3)`), 'oo');
  //     });

  //     test('getCell', async () => {
  //       await openTerminal(ctx, { cols: 5 });
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(-1)`), undefined);
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(5)`), undefined);
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(0).getChars()`), '');
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(0).getWidth()`), 1);
  //       await ctx.proxy.write('a文');
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(0).getChars()`), 'a');
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(0).getWidth()`), 1);
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(1).getChars()`), '文');
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(1).getWidth()`), 2);
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(2).getChars()`), '');
  //       assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(2).getWidth()`), 0);
  //     });
  //   });

  //   test('active, normal, alternate', async () => {
  //     await openTerminal(ctx, { cols: 5 });
  //     assert.equal(await page.evaluate(`window.term.buffer.active.type`), 'normal');
  //     assert.equal(await page.evaluate(`window.term.buffer.normal.type`), 'normal');
  //     assert.equal(await page.evaluate(`window.term.buffer.alternate.type`), 'alternate');

  //     await ctx.proxy.write('norm ');
  //     assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), 'norm ');
  //     assert.equal(await page.evaluate(`window.term.buffer.normal.getLine(0).translateToString()`), 'norm ');
  //     assert.equal(await page.evaluate(`window.term.buffer.alternate.getLine(0)`), undefined);

  //     await ctx.proxy.write('\\x1b[?47h\\r'); // use alternate screen buffer
  //     assert.equal(await page.evaluate(`window.term.buffer.active.type`), 'alternate');
  //     assert.equal(await page.evaluate(`window.term.buffer.normal.type`), 'normal');
  //     assert.equal(await page.evaluate(`window.term.buffer.alternate.type`), 'alternate');

  //     assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), '     ');
  //     await ctx.proxy.write('alt  ');
  //     assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), 'alt  ');
  //     assert.equal(await page.evaluate(`window.term.buffer.normal.getLine(0).translateToString()`), 'norm ');
  //     assert.equal(await page.evaluate(`window.term.buffer.alternate.getLine(0).translateToString()`), 'alt  ');

  //     await ctx.proxy.write('\\x1b[?47l\\r'); // use normal screen buffer
  //     assert.equal(await page.evaluate(`window.term.buffer.active.type`), 'normal');
  //     assert.equal(await page.evaluate(`window.term.buffer.normal.type`), 'normal');
  //     assert.equal(await page.evaluate(`window.term.buffer.alternate.type`), 'alternate');

  //     assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), 'norm ');
  //     assert.equal(await page.evaluate(`window.term.buffer.normal.getLine(0).translateToString()`), 'norm ');
  //     assert.equal(await page.evaluate(`window.term.buffer.alternate.getLine(0)`), undefined);
  //   });
  // });

  // describe('modes', () => {
  //   test('defaults', async () => {
  //     assert.deepStrictEqual(await page.evaluate(`window.term.modes`), {
  //       applicationCursorKeysMode: false,
  //       applicationKeypadMode: false,
  //       bracketedPasteMode: false,
  //       insertMode: false,
  //       mouseTrackingMode: 'none',
  //       originMode: false,
  //       reverseWraparoundMode: false,
  //       sendFocusMode: false,
  //       wraparoundMode: true
  //     });
  //   });
  //   test('applicationCursorKeysMode', async () => {
  //     await ctx.proxy.write('\\x1b[?1h');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.applicationCursorKeysMode`), true);
  //     await ctx.proxy.write('\\x1b[?1l');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.applicationCursorKeysMode`), false);
  //   });
  //   test('applicationKeypadMode', async () => {
  //     await ctx.proxy.write('\\x1b[?66h');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.applicationKeypadMode`), true);
  //     await ctx.proxy.write('\\x1b[?66l');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.applicationKeypadMode`), false);
  //   });
  //   test('bracketedPasteMode', async () => {
  //     await ctx.proxy.write('\\x1b[?2004h');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.bracketedPasteMode`), true);
  //     await ctx.proxy.write('\\x1b[?2004l');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.bracketedPasteMode`), false);
  //   });
  //   test('insertMode', async () => {
  //     await ctx.proxy.write('\\x1b[4h');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.insertMode`), true);
  //     await ctx.proxy.write('\\x1b[4l');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.insertMode`), false);
  //   });
  //   test('mouseTrackingMode', async () => {
  //     await ctx.proxy.write('\\x1b[?9h');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.mouseTrackingMode`), 'x10');
  //     await ctx.proxy.write('\\x1b[?9l');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.mouseTrackingMode`), 'none');
  //     await ctx.proxy.write('\\x1b[?1000h');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.mouseTrackingMode`), 'vt200');
  //     await ctx.proxy.write('\\x1b[?1000l');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.mouseTrackingMode`), 'none');
  //     await ctx.proxy.write('\\x1b[?1002h');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.mouseTrackingMode`), 'drag');
  //     await ctx.proxy.write('\\x1b[?1002l');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.mouseTrackingMode`), 'none');
  //     await ctx.proxy.write('\\x1b[?1003h');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.mouseTrackingMode`), 'any');
  //     await ctx.proxy.write('\\x1b[?1003l');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.mouseTrackingMode`), 'none');
  //   });
  //   test('originMode', async () => {
  //     await ctx.proxy.write('\\x1b[?6h');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.originMode`), true);
  //     await ctx.proxy.write('\\x1b[?6l');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.originMode`), false);
  //   });
  //   test('reverseWraparoundMode', async () => {
  //     await ctx.proxy.write('\\x1b[?45h');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.reverseWraparoundMode`), true);
  //     await ctx.proxy.write('\\x1b[?45l');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.reverseWraparoundMode`), false);
  //   });
  //   test('sendFocusMode', async () => {
  //     await ctx.proxy.write('\\x1b[?1004h');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.sendFocusMode`), true);
  //     await ctx.proxy.write('\\x1b[?1004l');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.sendFocusMode`), false);
  //   });
  //   test('wraparoundMode', async () => {
  //     await ctx.proxy.write('\\x1b[?7h');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.wraparoundMode`), true);
  //     await ctx.proxy.write('\\x1b[?7l');
  //     assert.strictEqual(await page.evaluate(`window.term.modes.wraparoundMode`), false);
  //   });
  // });

  // test('dispose', async () => {
  //   await page.evaluate(`
  //     window.term = new Terminal();
  //     window.term.dispose();
  //   `);
  //   assert.equal(await page.evaluate(`window.term._core._isDisposed`), true);
  // });

  // test('dispose (opened)', async () => {
  //   await page.evaluate(`window.term.dispose()`);
  //   assert.equal(await page.evaluate(`window.term._core._isDisposed`), true);
  // });

  // test('render when visible after hidden', async () => {
  //   await page.evaluate(`document.querySelector('#terminal-container').style.display='none'`);
  //   await page.evaluate(`window.term = new Terminal()`);
  //   await page.evaluate(`window.term.open(document.querySelector('#terminal-container'))`);
  //   await page.evaluate(`document.querySelector('#terminal-container').style.display=''`);
  //   await pollFor(page, `window.term._core._renderService.dimensions.actualCellWidth > 0`, true);
  // });

  // describe('registerLinkProvider', () => {
  //   test('should fire provideLinks when hovering cells', async () => {
  //     await openTerminal(ctx, { rendererType: 'dom' });
  //     await page.evaluate(`
  //       window.calls = [];
  //       window.disposable = window.term.registerLinkProvider({
  //         provideLinks: (position, cb) => {
  //           calls.push(position);
  //           cb(undefined);
  //         }
  //       });
  //     `);
  //     const dims = await getDimensions();
  //     await moveMouseCell(page, dims, 1, 1);
  //     await moveMouseCell(page, dims, 2, 2);
  //     await moveMouseCell(page, dims, 10, 4);
  //     await pollFor(page, `window.calls`, [1, 2, 4]);
  //     await page.evaluate(`window.disposable.dispose()`);
  //   });

  //   test('should fire hover and leave events on the link', async () => {
  //     await openTerminal(ctx, { rendererType: 'dom' });
  //     await ctx.proxy.write('foo bar baz');
  //     // Wait for renderer to catch up as links are cleared on render
  //     await pollFor(page, `document.querySelector('.xterm-rows').textContent`, 'foo bar baz ');
  //     await page.evaluate(`
  //       window.calls = [];
  //       window.disposable = window.term.registerLinkProvider({
  //         provideLinks: (position, cb) => {
  //           window.calls.push('provide ' + position);
  //           if (position === 1) {
  //             window.calls.push('match');
  //             cb([{
  //               range: { start: { x: 5, y: 1 }, end: { x: 7, y: 1 } },
  //               text: 'bar',
  //               activate: () => window.calls.push('activate'),
  //               hover: () => window.calls.push('hover'),
  //               leave: () => window.calls.push('leave')
  //             }]);
  //           }
  //         }
  //       });
  //     `);
  //     const dims = await getDimensions();
  //     await moveMouseCell(page, dims, 5, 1);
  //     await timeout(100);
  //     await moveMouseCell(page, dims, 4, 1);
  //     await pollFor(page, `window.calls`, ['provide 1', 'match', 'hover', 'leave' ]);
  //     await moveMouseCell(page, dims, 7, 1);
  //     await timeout(100);
  //     await moveMouseCell(page, dims, 8, 1);
  //     await pollFor(page, `window.calls`, ['provide 1', 'match', 'hover', 'leave', 'hover', 'leave']);
  //     await page.evaluate(`window.disposable.dispose()`);
  //   });

  //   test('should work fine when hover and leave callbacks are not provided', async () => {
  //     await openTerminal(ctx, { rendererType: 'dom' });
  //     await ctx.proxy.write('foo bar baz');
  //     // Wait for renderer to catch up as links are cleared on render
  //     await pollFor(page, `document.querySelector('.xterm-rows').textContent`, 'foo bar baz ');
  //     await page.evaluate(`
  //       window.calls = [];
  //       window.disposable = window.term.registerLinkProvider({
  //         provideLinks: (position, cb) => {
  //           window.calls.push('provide ' + position);
  //           if (position === 1) {
  //             window.calls.push('match 1');
  //             cb([{
  //               range: { start: { x: 5, y: 1 }, end: { x: 7, y: 1 } },
  //               text: 'bar',
  //               activate: () => window.calls.push('activate')
  //             }]);
  //           } else if (position === 2) {
  //             window.calls.push('match 2');
  //             cb([{
  //               range: { start: { x: 5, y: 2 }, end: { x: 7, y: 2 } },
  //               text: 'bar',
  //               activate: () => window.calls.push('activate')
  //             }]);
  //           }
  //         }
  //       });
  //     `);
  //     const dims = await getDimensions();
  //     await moveMouseCell(page, dims, 5, 1);
  //     await pollFor(page, `window.calls`, ['provide 1', 'match 1']);
  //     await moveMouseCell(page, dims, 4, 2);
  //     await pollFor(page, `window.calls`, ['provide 1', 'match 1', 'provide 2', 'match 2']);
  //     await moveMouseCell(page, dims, 7, 1);
  //     await pollFor(page, `window.calls`, ['provide 1', 'match 1', 'provide 2', 'match 2', 'provide 1', 'match 1']);
  //     await moveMouseCell(page, dims, 6, 2);
  //     await pollFor(page, `window.calls`, ['provide 1', 'match 1', 'provide 2', 'match 2', 'provide 1', 'match 1', 'provide 2', 'match 2']);
  //     await page.evaluate(`window.disposable.dispose()`);
  //   });

  //   test('should fire activate events when clicking the link', async () => {
  //     await openTerminal(ctx, { rendererType: 'dom' });
  //     await ctx.proxy.write('a b c');

  //     // Wait for renderer to catch up as links are cleared on render
  //     await pollFor(page, `document.querySelector('.xterm-rows').textContent`, 'a b c ');

  //     // Focus terminal to avoid a render event clearing the active link
  //     const dims = await getDimensions();
  //     await moveMouseCell(page, dims, 5, 5);
  //     await page.mouse.down();
  //     await page.mouse.up();
  //     await timeout(200); // Not sure how to avoid this timeout, checking for xterm-focus doesn't help

  //     await page.evaluate(`
  //       window.calls = [];
  //       window.disposable = window.term.registerLinkProvider({
  //         provideLinks: (y, cb) => {
  //           window.calls.push('provide ' + y);
  //           cb([{
  //             range: { start: { x: 1, y }, end: { x: 80, y } },
  //             text: window.term.buffer.active.getLine(y - 1).translateToString(),
  //             activate: (_, text) => window.calls.push('activate ' + y),
  //             hover: () => window.calls.push('hover ' + y),
  //             leave: () => window.calls.push('leave ' + y)
  //           }]);
  //         }
  //       });
  //     `);
  //     await moveMouseCell(page, dims, 3, 1);
  //     await pollFor(page, `window.calls`, ['provide 1', 'hover 1']);
  //     await page.mouse.down();
  //     await page.mouse.up();
  //     await pollFor(page, `window.calls`, ['provide 1', 'hover 1', 'activate 1']);
  //     await moveMouseCell(page, dims, 1, 2);
  //     await pollFor(page, `window.calls`, ['provide 1', 'hover 1', 'activate 1', 'leave 1', 'provide 2', 'hover 2']);
  //     await page.mouse.down();
  //     await page.mouse.up();
  //     await pollFor(page, `window.calls`, ['provide 1', 'hover 1', 'activate 1', 'leave 1', 'provide 2', 'hover 2', 'activate 2']);
  //     await moveMouseCell(page, dims, 5, 1);
  //     await pollFor(page, `window.calls`, ['provide 1', 'hover 1', 'activate 1', 'leave 1', 'provide 2', 'hover 2', 'activate 2', 'leave 2', 'provide 1', 'hover 1']);
  //     await page.mouse.down();
  //     await page.mouse.up();
  //     await pollFor(page, `window.calls`, ['provide 1', 'hover 1', 'activate 1', 'leave 1', 'provide 2', 'hover 2', 'activate 2', 'leave 2', 'provide 1', 'hover 1', 'activate 1']);
  //     await page.evaluate(`window.disposable.dispose()`);
  //   });

  //   test('should work when multiple links are provided on the same line', async () => {
  //     await openTerminal(ctx, { rendererType: 'dom' });
  //     await ctx.proxy.write('foo bar baz');
  //     // Wait for renderer to catch up as links are cleared on render
  //     await pollFor(page, `document.querySelector('.xterm-rows').textContent`, 'foo bar baz ');
  //     await page.evaluate(`
  //       window.calls = [];
  //       window.disposable = window.term.registerLinkProvider({
  //         provideLinks: (position, cb) => {
  //           window.calls.push('provide ' + position);
  //           if (position === 1) {
  //             cb([{
  //               range: { start: { x: 1, y: 1 }, end: { x: 3, y: 1 } },
  //               text: '',
  //               activate: () => window.calls.push('activate'),
  //               hover: () => window.calls.push('hover 1-3'),
  //               leave: () => window.calls.push('leave 1-3')
  //             }, {
  //               range: { start: { x: 5, y: 1 }, end: { x: 7, y: 1 } },
  //               text: '',
  //               activate: () => window.calls.push('activate'),
  //               hover: () => window.calls.push('hover 5-7'),
  //               leave: () => window.calls.push('leave 5-7')
  //             }, {
  //               range: { start: { x: 9, y: 1 }, end: { x: 11, y: 1 } },
  //               text: '',
  //               activate: () => window.calls.push('activate'),
  //               hover: () => window.calls.push('hover 9-11'),
  //               leave: () => window.calls.push('leave 9-11')
  //             }]);
  //           }
  //         }
  //       });
  //     `);
  //     const dims = await getDimensions();
  //     await moveMouseCell(page, dims, 2, 1);
  //     await pollFor(page, `window.calls`, ['provide 1', 'hover 1-3']);
  //     await moveMouseCell(page, dims, 6, 1);
  //     await pollFor(page, `window.calls`, ['provide 1', 'hover 1-3', 'leave 1-3', 'hover 5-7']);
  //     await moveMouseCell(page, dims, 6, 2);
  //     await pollFor(page, `window.calls`, ['provide 1', 'hover 1-3', 'leave 1-3', 'hover 5-7', 'leave 5-7', 'provide 2']);
  //     await moveMouseCell(page, dims, 10, 1);
  //     await pollFor(page, `window.calls`, ['provide 1', 'hover 1-3', 'leave 1-3', 'hover 5-7', 'leave 5-7', 'provide 2', 'provide 1', 'hover 9-11']);
  //     await page.evaluate(`window.disposable.dispose()`);
  //   });

  //   test('should dispose links when hovering away', async () => {
  //     await openTerminal(ctx, { rendererType: 'dom' });
  //     await ctx.proxy.write('foo bar baz');
  //     // Wait for renderer to catch up as links are cleared on render
  //     await pollFor(page, `document.querySelector('.xterm-rows').textContent`, 'foo bar baz ');
  //     await page.evaluate(`
  //       window.calls = [];
  //       window.disposable = window.term.registerLinkProvider({
  //         provideLinks: (position, cb) => {
  //           window.calls.push('provide ' + position);
  //           if (position === 1) {
  //             cb([{
  //               range: { start: { x: 1, y: 1 }, end: { x: 3, y: 1 } },
  //               text: '',
  //               activate: () => window.calls.push('activate'),
  //               dispose: () => window.calls.push('dispose 1-3'),
  //               hover: () => window.calls.push('hover 1-3'),
  //               leave: () => window.calls.push('leave 1-3')
  //             }, {
  //               range: { start: { x: 5, y: 1 }, end: { x: 7, y: 1 } },
  //               text: '',
  //               activate: () => window.calls.push('activate'),
  //               dispose: () => window.calls.push('dispose 5-7'),
  //               hover: () => window.calls.push('hover 5-7'),
  //               leave: () => window.calls.push('leave 5-7')
  //             }, {
  //               range: { start: { x: 9, y: 1 }, end: { x: 11, y: 1 } },
  //               text: '',
  //               activate: () => window.calls.push('activate'),
  //               dispose: () => window.calls.push('dispose 9-11'),
  //               hover: () => window.calls.push('hover 9-11'),
  //               leave: () => window.calls.push('leave 9-11')
  //             }]);
  //           }
  //         }
  //       });
  //     `);
  //     const dims = await getDimensions();
  //     await moveMouseCell(page, dims, 2, 1);
  //     await pollFor(page, `window.calls`, ['provide 1', 'hover 1-3']);
  //     await moveMouseCell(page, dims, 6, 1);
  //     await pollFor(page, `window.calls`, ['provide 1', 'hover 1-3', 'leave 1-3', 'hover 5-7']);
  //     await moveMouseCell(page, dims, 6, 2);
  //     await pollFor(page, `window.calls`, ['provide 1', 'hover 1-3', 'leave 1-3', 'hover 5-7', 'leave 5-7', 'dispose 1-3', 'dispose 5-7', 'dispose 9-11', 'provide 2']);
  //     await moveMouseCell(page, dims, 10, 1);
  //     await pollFor(page, `window.calls`, ['provide 1', 'hover 1-3', 'leave 1-3', 'hover 5-7', 'leave 5-7', 'dispose 1-3', 'dispose 5-7', 'dispose 9-11', 'provide 2', 'provide 1', 'hover 9-11']);
  //     await moveMouseCell(page, dims, 10, 2);
  //     await pollFor(page, `window.calls`, ['provide 1', 'hover 1-3', 'leave 1-3', 'hover 5-7', 'leave 5-7', 'dispose 1-3', 'dispose 5-7', 'dispose 9-11', 'provide 2', 'provide 1', 'hover 9-11', 'leave 9-11', 'dispose 1-3', 'dispose 5-7', 'dispose 9-11', 'provide 2']);
  //     await page.evaluate(`window.disposable.dispose()`);
  //   });
  // });
});
