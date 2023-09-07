/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { test } from '@playwright/test';
import { deepStrictEqual, notStrictEqual, strictEqual } from 'assert';
import { ITestContext, createTestContext, openTerminal, pollFor, timeout } from './TestUtils';
import { IRenderDimensions } from 'browser/renderer/shared/Types';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx);
});
test.afterAll(async () => await ctx.page.close());


test.describe('API Integration Tests', () => {
  test('Default options', async () => {
    strictEqual(await ctx.proxy.cols, 80);
    strictEqual(await ctx.proxy.rows, 24);
  });

  test('Proposed API check', async () => {
    await openTerminal(ctx, { allowProposedApi: false }, { loadUnicodeGraphemesAddon: false });
    await ctx.page.evaluate(`
      try {
        window.term.markers;
      } catch (e) {
        window.throwMessage = e.message;
      }
    `);
    await pollFor(ctx.page, 'window.throwMessage', 'You must set the allowProposedApi option to true to use proposed API');
  });

  test('write', async () => {
    await openTerminal(ctx);
    await ctx.page.evaluate(`
      window.term.write('foo');
      window.term.write('bar');
      window.term.write('文');
    `);
    await pollFor(ctx.page, `window.term.buffer.active.getLine(0).translateToString(true)`, 'foobar文');
  });

  test('write with callback', async () => {
    await openTerminal(ctx);
    await ctx.page.evaluate(`
      window.term.write('foo', () => { window.__x = 'a'; });
      window.term.write('bar', () => { window.__x += 'b'; });
      window.term.write('文', () => { window.__x += 'c'; });
    `);
    await pollFor(ctx.page, `window.term.buffer.active.getLine(0).translateToString(true)`, 'foobar文');
    await pollFor(ctx.page, `window.__x`, 'abc');
  });

  test('write - bytes (UTF8)', async () => {
    await openTerminal(ctx);
    await ctx.page.evaluate(`
      window.term.write(new Uint8Array([102, 111, 111])); // foo
      window.term.write(new Uint8Array([98, 97, 114])); // bar
      window.term.write(new Uint8Array([230, 150, 135])); // 文
    `);
    await pollFor(ctx.page, `window.term.buffer.active.getLine(0).translateToString(true)`, 'foobar文');
  });

  test('write - bytes (UTF8) with callback', async () => {
    await openTerminal(ctx);
    await ctx.page.evaluate(`
      window.term.write(new Uint8Array([102, 111, 111]), () => { window.__x = 'A'; }); // foo
      window.term.write(new Uint8Array([98, 97, 114]), () => { window.__x += 'B'; }); // bar
      window.term.write(new Uint8Array([230, 150, 135]), () => { window.__x += 'C'; }); // 文
    `);
    await pollFor(ctx.page, `window.term.buffer.active.getLine(0).translateToString(true)`, 'foobar文');
    await pollFor(ctx.page, `window.__x`, 'ABC');
  });

  test('writeln', async () => {
    await openTerminal(ctx);
    await ctx.page.evaluate(`
      window.term.writeln('foo');
      window.term.writeln('bar');
      window.term.writeln('文');
    `);
    await pollFor(ctx.page, `window.term.buffer.active.getLine(0).translateToString(true)`, 'foo');
    await pollFor(ctx.page, `window.term.buffer.active.getLine(1).translateToString(true)`, 'bar');
    await pollFor(ctx.page, `window.term.buffer.active.getLine(2).translateToString(true)`, '文');
  });

  test('writeln with callback', async () => {
    await openTerminal(ctx);
    await ctx.page.evaluate(`
      window.term.writeln('foo', () => { window.__x = '1'; });
      window.term.writeln('bar', () => { window.__x += '2'; });
      window.term.writeln('文', () => { window.__x += '3'; });
    `);
    await pollFor(ctx.page, `window.term.buffer.active.getLine(0).translateToString(true)`, 'foo');
    await pollFor(ctx.page, `window.term.buffer.active.getLine(1).translateToString(true)`, 'bar');
    await pollFor(ctx.page, `window.term.buffer.active.getLine(2).translateToString(true)`, '文');
    await pollFor(ctx.page, `window.__x`, '123');
  });

  test('writeln - bytes (UTF8)', async () => {
    await openTerminal(ctx);
    await ctx.page.evaluate(`
      window.term.writeln(new Uint8Array([102, 111, 111]));
      window.term.writeln(new Uint8Array([98, 97, 114]));
      window.term.writeln(new Uint8Array([230, 150, 135]));
    `);
    await pollFor(ctx.page, `window.term.buffer.active.getLine(0).translateToString(true)`, 'foo');
    await pollFor(ctx.page, `window.term.buffer.active.getLine(1).translateToString(true)`, 'bar');
    await pollFor(ctx.page, `window.term.buffer.active.getLine(2).translateToString(true)`, '文');
  });

  test('paste', async () => {
    await openTerminal(ctx);
    const calls: string[] = [];
    ctx.proxy.onData(e => calls.push(e));
    await ctx.proxy.paste('foo');
    await ctx.proxy.paste('\r\nfoo\nbar\r');
    await ctx.proxy.write('\x1b[?2004h');
    await ctx.proxy.paste('foo');
    await ctx.page.evaluate(`window.term.options.ignoreBracketedPasteMode = true;`);
    await ctx.proxy.paste('check_mode');
    deepStrictEqual(calls, ['foo', '\rfoo\rbar\r', '\x1b[200~foo\x1b[201~', 'check_mode']);
  });

  test('clear', async () => {
    await openTerminal(ctx, { rows: 5 });
    await ctx.page.evaluate(`
      window.term.write('test0');
      window.parsed = 0;
      for (let i = 1; i < 10; i++) {
        window.term.write('\\n\\rtest' + i, () => window.parsed++);
      }
    `);
    await pollFor(ctx.page, `window.parsed`, 9);
    await ctx.page.evaluate(`window.term.clear()`);
    await pollFor(ctx.page, `window.term.buffer.active.length`, 5);
    await pollFor(ctx.page, `window.term.buffer.active.getLine(0).translateToString(true)`, 'test9');
    for (let i = 1; i < 5; i++) {
      await pollFor(ctx.page, `window.term.buffer.active.getLine(${i}).translateToString(true)`, '');
    }
  });

  test.describe('options', () => {
    test('getter', async () => {
      await openTerminal(ctx);
      strictEqual(await ctx.page.evaluate(`window.term.options.cols`), 80);
      strictEqual(await ctx.page.evaluate(`window.term.options.rows`), 24);
    });
    test('setter', async () => {
      await openTerminal(ctx);
      try {
        await ctx.page.evaluate('window.term.options.cols = 40');
        test.fail();
      } catch {}
      try {
        await ctx.page.evaluate('window.term.options.rows = 20');
        test.fail();
      } catch {}
      await ctx.page.evaluate('window.term.options.scrollback = 1');
      strictEqual(await ctx.page.evaluate(`window.term.options.scrollback`), 1);
      await ctx.page.evaluate(`
        window.term.options = {
          fontSize: 30,
          fontFamily: 'Arial'
        };
      `);
      strictEqual(await ctx.page.evaluate(`window.term.options.fontSize`), 30);
      strictEqual(await ctx.page.evaluate(`window.term.options.fontFamily`), 'Arial');
    });
    test('object.keys return the correct number of options', async () => {
      await openTerminal(ctx);
      notStrictEqual(await ctx.page.evaluate(`Object.keys(window.term.options).length`), 0);
    });
  });

  test.describe('renderer', () => {
    test('foreground', async () => {
      await openTerminal(ctx);
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
      await openTerminal(ctx);
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
    strictEqual(await ctx.page.evaluate(`window.term.hasSelection()`), false);
    strictEqual(await ctx.page.evaluate(`window.term.getSelection()`), '');
    deepStrictEqual(await ctx.page.evaluate(`window.term.getSelectionPosition()`), undefined);
    await ctx.page.evaluate(`window.term.selectAll()`);
    strictEqual(await ctx.page.evaluate(`window.term.hasSelection()`), true);
    if (process.platform === 'win32') {
      strictEqual(await ctx.page.evaluate(`window.term.getSelection()`), '\r\n\r\nfoo\r\n\r\nbar\r\n\r\nbaz');
    } else {
      strictEqual(await ctx.page.evaluate(`window.term.getSelection()`), '\n\nfoo\n\nbar\n\nbaz');
    }
    deepStrictEqual(await ctx.page.evaluate(`window.term.getSelectionPosition()`), { start: { x: 0, y: 0 }, end: { x: 5, y: 6 } });
    await ctx.page.evaluate(`window.term.clearSelection()`);
    strictEqual(await ctx.page.evaluate(`window.term.hasSelection()`), false);
    strictEqual(await ctx.page.evaluate(`window.term.getSelection()`), '');
    deepStrictEqual(await ctx.page.evaluate(`window.term.getSelectionPosition()`), undefined);
    await ctx.page.evaluate(`window.term.select(1, 2, 2)`);
    strictEqual(await ctx.page.evaluate(`window.term.hasSelection()`), true);
    strictEqual(await ctx.page.evaluate(`window.term.getSelection()`), 'oo');
    deepStrictEqual(await ctx.page.evaluate(`window.term.getSelectionPosition()`), { start: { x: 1, y: 2 }, end: { x: 3, y: 2 } });
  });

  test('focus, blur', async () => {
    await openTerminal(ctx);
    strictEqual(await ctx.page.evaluate(`document.activeElement.className`), '');
    await ctx.page.evaluate(`window.term.focus()`);
    strictEqual(await ctx.page.evaluate(`document.activeElement.className`), 'xterm-helper-textarea');
    await ctx.page.evaluate(`window.term.blur()`);
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
      strictEqual(await ctx.page.evaluate(`window.cols`), 5);
    });

    test('dispose (addon)', async () => {
      await openTerminal(ctx);
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
      await openTerminal(ctx);
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
    test('onCursorMove', async () => {
      await openTerminal(ctx);
      await ctx.page.evaluate(`
        window.callCount = 0;
        window.term.onCursorMove(e => window.callCount++);
        window.term.write('foo');
      `);
      await pollFor(ctx.page, `window.callCount`, 1);
      await ctx.page.evaluate(`window.term.write('bar')`);
      await pollFor(ctx.page, `window.callCount`, 2);
    });

    test('onData', async () => {
      await openTerminal(ctx);
      await ctx.page.evaluate(`
        window.calls = [];
        window.term.onData(e => calls.push(e));
      `);
      await ctx.page.type('.xterm-helper-textarea', 'foo');
      deepStrictEqual(await ctx.page.evaluate(`window.calls`), ['f', 'o', 'o']);
    });

    test('onKey', async () => {
      await openTerminal(ctx);
      await ctx.page.evaluate(`
        window.calls = [];
        window.term.onKey(e => calls.push(e.key));
      `);
      await ctx.page.type('.xterm-helper-textarea', 'foo');
      deepStrictEqual(await ctx.page.evaluate(`window.calls`), ['f', 'o', 'o']);
    });

    test('onLineFeed', async () => {
      await openTerminal(ctx);
      await ctx.page.evaluate(`
        window.callCount = 0;
        window.term.onLineFeed(() => callCount++);
        window.term.writeln('foo');
      `);
      await pollFor(ctx.page, `window.callCount`, 1);
      await ctx.page.evaluate(`window.term.writeln('bar')`);
      await pollFor(ctx.page, `window.callCount`, 2);
    });

    test('onScroll', async () => {
      await openTerminal(ctx, { rows: 5 });
      await ctx.page.evaluate(`
        window.calls = [];
        window.term.onScroll(e => window.calls.push(e));
        for (let i = 0; i < 4; i++) {
          window.term.writeln('foo');
        }
      `);
      await pollFor(ctx.page, `window.calls`, []);
      await ctx.page.evaluate(`window.term.writeln('bar')`);
      await pollFor(ctx.page, `window.calls`, [1]);
      await ctx.page.evaluate(`window.term.writeln('baz')`);
      await pollFor(ctx.page, `window.calls`, [1, 2]);
    });

    test('onSelectionChange', async () => {
      await openTerminal(ctx);
      await ctx.page.evaluate(`
        window.callCount = 0;
        window.term.onSelectionChange(() => window.callCount++);
      `);
      await pollFor(ctx.page, `window.callCount`, 0);
      await ctx.page.evaluate(`window.term.selectAll()`);
      await pollFor(ctx.page, `window.callCount`, 1);
      await ctx.page.evaluate(`window.term.clearSelection()`);
      await pollFor(ctx.page, `window.callCount`, 2);
    });

    test('onRender', async () => {
      await openTerminal(ctx);
      await timeout(20); // Ensure all init events are fired
      await ctx.page.evaluate(`
        window.calls = [];
        window.term.onRender(e => window.calls.push([e.start, e.end]));
      `);
      await pollFor(ctx.page, `window.calls`, []);
      await ctx.page.evaluate(`window.term.write('foo')`);
      await pollFor(ctx.page, `window.calls`, [[0, 0]]);
      await ctx.page.evaluate(`window.term.write('bar\\n\\nbaz')`);
      await pollFor(ctx.page, `window.calls`, [[0, 0], [0, 2]]);
    });

    test('onResize', async () => {
      await openTerminal(ctx);
      await timeout(20); // Ensure all init events are fired
      await ctx.page.evaluate(`
        window.calls = [];
        window.term.onResize(e => window.calls.push([e.cols, e.rows]));
      `);
      await pollFor(ctx.page, `window.calls`, []);
      await ctx.page.evaluate(`window.term.resize(10, 5)`);
      await pollFor(ctx.page, `window.calls`, [[10, 5]]);
      await ctx.page.evaluate(`window.term.resize(20, 15)`);
      await pollFor(ctx.page, `window.calls`, [[10, 5], [20, 15]]);
    });

    test('onTitleChange', async () => {
      await openTerminal(ctx);
      await ctx.page.evaluate(`
        window.calls = [];
        window.term.onTitleChange(e => window.calls.push(e));
      `);
      await pollFor(ctx.page, `window.calls`, []);
      await ctx.page.evaluate(`window.term.write('\x1b]2;foo\x9c')`);
      await pollFor(ctx.page, `window.calls`, ['foo']);
    });
    test('onBell', async () => {
      await openTerminal(ctx);
      await ctx.page.evaluate(`
        window.calls = [];
        window.term.onBell(() => window.calls.push(true));
      `);
      await pollFor(ctx.page, `window.calls`, []);
      await ctx.page.evaluate(`window.term.write('\x07')`);
      await pollFor(ctx.page, `window.calls`, [true]);
    });
  });

  test.describe('buffer', () => {
    test('cursorX, cursorY', async () => {
      await openTerminal(ctx, { rows: 5, cols: 5 });
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.cursorX`), 0);
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.cursorY`), 0);
      await ctx.proxy.write('foo');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.cursorX`), 3);
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.cursorY`), 0);
      await ctx.proxy.write('\n');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.cursorX`), 3);
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.cursorY`), 1);
      await ctx.proxy.write('\r');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.cursorX`), 0);
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.cursorY`), 1);
      await ctx.proxy.write('abcde');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.cursorX`), 5);
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.cursorY`), 1);
      await ctx.proxy.write('\n\r\n\n\n\n\n');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.cursorX`), 0);
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.cursorY`), 4);
    });

    test('viewportY', async () => {
      await openTerminal(ctx, { rows: 5 });
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.viewportY`), 0);
      await ctx.proxy.write('\n\n\n\n');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.viewportY`), 0);
      await ctx.proxy.write('\n');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.viewportY`), 1);
      await ctx.proxy.write('\n\n\n\n');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.viewportY`), 5);
      await ctx.page.evaluate(`window.term.scrollLines(-1)`);
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.viewportY`), 4);
      await ctx.page.evaluate(`window.term.scrollToTop()`);
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.viewportY`), 0);
    });

    test('baseY', async () => {
      await openTerminal(ctx, { rows: 5 });
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.baseY`), 0);
      await ctx.proxy.write('\n\n\n\n');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.baseY`), 0);
      await ctx.proxy.write('\n');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.baseY`), 1);
      await ctx.proxy.write('\n\n\n\n');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.baseY`), 5);
      await ctx.page.evaluate(`window.term.scrollLines(-1)`);
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.baseY`), 5);
      await ctx.page.evaluate(`window.term.scrollToTop()`);
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.baseY`), 5);
    });

    test('length', async () => {
      await openTerminal(ctx, { rows: 5 });
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.length`), 5);
      await ctx.proxy.write('\n\n\n\n');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.length`), 5);
      await ctx.proxy.write('\n');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.length`), 6);
      await ctx.proxy.write('\n\n\n\n');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.length`), 10);
    });

    test.describe('getLine', () => {
      test('invalid index', async () => {
        await openTerminal(ctx, { rows: 5 });
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(-1)`), undefined);
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(5)`), undefined);
      });

      test('isWrapped', async () => {
        await openTerminal(ctx, { cols: 5 });
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).isWrapped`), false);
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(1).isWrapped`), false);
        await ctx.proxy.write('abcde');
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).isWrapped`), false);
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(1).isWrapped`), false);
        await ctx.proxy.write('f');
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).isWrapped`), false);
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(1).isWrapped`), true);
      });

      test('translateToString', async () => {
        await openTerminal(ctx, { cols: 5 });
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), '     ');
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).translateToString(true)`), '');
        await ctx.proxy.write('foo');
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), 'foo  ');
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).translateToString(true)`), 'foo');
        await ctx.proxy.write('bar');
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), 'fooba');
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).translateToString(true)`), 'fooba');
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(1).translateToString(true)`), 'r');
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).translateToString(false, 1)`), 'ooba');
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).translateToString(false, 1, 3)`), 'oo');
      });

      test('getCell', async () => {
        await openTerminal(ctx, { cols: 5 });
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).getCell(-1)`), undefined);
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).getCell(5)`), undefined);
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).getCell(0).getChars()`), '');
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).getCell(0).getWidth()`), 1);
        await ctx.proxy.write('a文');
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).getCell(0).getChars()`), 'a');
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).getCell(0).getWidth()`), 1);
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).getCell(1).getChars()`), '文');
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).getCell(1).getWidth()`), 2);
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).getCell(2).getChars()`), '');
        strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).getCell(2).getWidth()`), 0);
      });

      test('clearMarkers', async () => {
        await openTerminal(ctx, { cols: 5 });
        await ctx.page.evaluate(`
          window.disposeStack = [];
          `);
        await ctx.proxy.write('\n\n\n\n');
        await ctx.proxy.write('\n\n\n\n');
        await ctx.proxy.write('\n\n\n\n');
        await ctx.proxy.write('\n\n\n\n');
        await ctx.page.evaluate(`window.term.registerMarker(1)`);
        await ctx.page.evaluate(`window.term.registerMarker(2)`);
        await ctx.page.evaluate(`window.term.scrollLines(10)`);
        await ctx.page.evaluate(`window.term.registerMarker(3)`);
        await ctx.page.evaluate(`window.term.registerMarker(4)`);
        await ctx.page.evaluate(`
          for (let i = 0; i < window.term.markers.length; ++i) {
              const marker = window.term.markers[i];
              marker.onDispose(() => window.disposeStack.push(marker));
          }`);
        await ctx.page.evaluate(`window.term.clear()`);
        strictEqual(await ctx.page.evaluate(`window.disposeStack.length`), 4);
      });
    });

    test('active, normal, alternate', async () => {
      await openTerminal(ctx, { cols: 5 });
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.type`), 'normal');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.normal.type`), 'normal');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.alternate.type`), 'alternate');

      await ctx.proxy.write('norm ');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), 'norm ');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.normal.getLine(0).translateToString()`), 'norm ');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.alternate.getLine(0)`), undefined);

      await ctx.proxy.write('\x1b[?47h\r'); // use alternate screen buffer
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.type`), 'alternate');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.normal.type`), 'normal');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.alternate.type`), 'alternate');

      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), '     ');
      await ctx.proxy.write('alt  ');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), 'alt  ');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.normal.getLine(0).translateToString()`), 'norm ');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.alternate.getLine(0).translateToString()`), 'alt  ');

      await ctx.proxy.write('\x1b[?47l\r'); // use normal screen buffer
      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.type`), 'normal');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.normal.type`), 'normal');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.alternate.type`), 'alternate');

      strictEqual(await ctx.page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), 'norm ');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.normal.getLine(0).translateToString()`), 'norm ');
      strictEqual(await ctx.page.evaluate(`window.term.buffer.alternate.getLine(0)`), undefined);
    });
  });

  test.describe('modes', () => {
    test.beforeEach(() => openTerminal(ctx));
    test('defaults', async () => {
      deepStrictEqual(await ctx.page.evaluate(`window.term.modes`), {
        applicationCursorKeysMode: false,
        applicationKeypadMode: false,
        bracketedPasteMode: false,
        insertMode: false,
        mouseTrackingMode: 'none',
        originMode: false,
        reverseWraparoundMode: false,
        sendFocusMode: false,
        wraparoundMode: true
      });
    });
    test('applicationCursorKeysMode', async () => {
      await ctx.proxy.write('\x1b[?1h');
      strictEqual(await ctx.page.evaluate(`window.term.modes.applicationCursorKeysMode`), true);
      await ctx.proxy.write('\x1b[?1l');
      strictEqual(await ctx.page.evaluate(`window.term.modes.applicationCursorKeysMode`), false);
    });
    test('applicationKeypadMode', async () => {
      await ctx.proxy.write('\x1b[?66h');
      strictEqual(await ctx.page.evaluate(`window.term.modes.applicationKeypadMode`), true);
      await ctx.proxy.write('\x1b[?66l');
      strictEqual(await ctx.page.evaluate(`window.term.modes.applicationKeypadMode`), false);
    });
    test('bracketedPasteMode', async () => {
      await ctx.proxy.write('\x1b[?2004h');
      strictEqual(await ctx.page.evaluate(`window.term.modes.bracketedPasteMode`), true);
      await ctx.proxy.write('\x1b[?2004l');
      strictEqual(await ctx.page.evaluate(`window.term.modes.bracketedPasteMode`), false);
    });
    test('insertMode', async () => {
      await ctx.proxy.write('\x1b[4h');
      strictEqual(await ctx.page.evaluate(`window.term.modes.insertMode`), true);
      await ctx.proxy.write('\x1b[4l');
      strictEqual(await ctx.page.evaluate(`window.term.modes.insertMode`), false);
    });
    test('mouseTrackingMode', async () => {
      await ctx.proxy.write('\x1b[?9h');
      strictEqual(await ctx.page.evaluate(`window.term.modes.mouseTrackingMode`), 'x10');
      await ctx.proxy.write('\x1b[?9l');
      strictEqual(await ctx.page.evaluate(`window.term.modes.mouseTrackingMode`), 'none');
      await ctx.proxy.write('\x1b[?1000h');
      strictEqual(await ctx.page.evaluate(`window.term.modes.mouseTrackingMode`), 'vt200');
      await ctx.proxy.write('\x1b[?1000l');
      strictEqual(await ctx.page.evaluate(`window.term.modes.mouseTrackingMode`), 'none');
      await ctx.proxy.write('\x1b[?1002h');
      strictEqual(await ctx.page.evaluate(`window.term.modes.mouseTrackingMode`), 'drag');
      await ctx.proxy.write('\x1b[?1002l');
      strictEqual(await ctx.page.evaluate(`window.term.modes.mouseTrackingMode`), 'none');
      await ctx.proxy.write('\x1b[?1003h');
      strictEqual(await ctx.page.evaluate(`window.term.modes.mouseTrackingMode`), 'any');
      await ctx.proxy.write('\x1b[?1003l');
      strictEqual(await ctx.page.evaluate(`window.term.modes.mouseTrackingMode`), 'none');
    });
    test('originMode', async () => {
      await ctx.proxy.write('\x1b[?6h');
      strictEqual(await ctx.page.evaluate(`window.term.modes.originMode`), true);
      await ctx.proxy.write('\x1b[?6l');
      strictEqual(await ctx.page.evaluate(`window.term.modes.originMode`), false);
    });
    test('reverseWraparoundMode', async () => {
      await ctx.proxy.write('\x1b[?45h');
      strictEqual(await ctx.page.evaluate(`window.term.modes.reverseWraparoundMode`), true);
      await ctx.proxy.write('\x1b[?45l');
      strictEqual(await ctx.page.evaluate(`window.term.modes.reverseWraparoundMode`), false);
    });
    test('sendFocusMode', async () => {
      await ctx.proxy.write('\x1b[?1004h');
      strictEqual(await ctx.page.evaluate(`window.term.modes.sendFocusMode`), true);
      await ctx.proxy.write('\x1b[?1004l');
      strictEqual(await ctx.page.evaluate(`window.term.modes.sendFocusMode`), false);
    });
    test('wraparoundMode', async () => {
      await ctx.proxy.write('\x1b[?7h');
      strictEqual(await ctx.page.evaluate(`window.term.modes.wraparoundMode`), true);
      await ctx.proxy.write('\x1b[?7l');
      strictEqual(await ctx.page.evaluate(`window.term.modes.wraparoundMode`), false);
    });
  });

  test('dispose', async () => {
    await ctx.page.evaluate(`
      if ('term' in window) {
        try {
          window.term.dispose();
        } catch {}
      }
      window.term = new Terminal();
      window.term.dispose();
    `);
    strictEqual(await ctx.page.evaluate(`window.term._core._isDisposed`), true);
  });

  test('dispose (opened)', async () => {
    await openTerminal(ctx);
    await ctx.page.evaluate(`
      if ('term' in window) {
        try {
          window.term.dispose();
        } catch {}
      }
    `);
    strictEqual(await ctx.page.evaluate(`window.term._core._isDisposed`), true);
  });

  test('render when visible after hidden', async () => {
    await openTerminal(ctx);
    await ctx.page.evaluate(`
      if ('term' in window) {
        try {
          window.term.dispose();
        } catch {}
      }
    `);
    await ctx.page.evaluate(`document.querySelector('#terminal-container').style.display='none'`);
    await ctx.page.evaluate(`window.term = new Terminal()`);
    await ctx.page.evaluate(`window.term.open(document.querySelector('#terminal-container'))`);
    await ctx.page.evaluate(`document.querySelector('#terminal-container').style.display=''`);
    await pollFor(ctx.page, `window.term._core._renderService.dimensions.css.cell.width > 0`, true);
  });

  test.describe('registerDecoration', () => {
    test.describe('bufferDecorations', () => {
      test('should register decorations and render them when terminal open is called', async () => {
        await openTerminal(ctx);
        await ctx.page.evaluate(`window.marker1 = window.term.registerMarker(1)`);
        await ctx.page.evaluate(`window.marker2 = window.term.registerMarker(2)`);
        await ctx.page.evaluate(`window.term.registerDecoration({ marker: window.marker1 })`);
        await ctx.page.evaluate(`window.term.registerDecoration({ marker: window.marker2 })`);
        await pollFor(ctx.page, `document.querySelectorAll('.xterm-screen .xterm-decoration').length`, 2);
      });
      test('should return undefined when the marker has already been disposed of', async () => {
        await openTerminal(ctx);
        await ctx.page.evaluate(`window.marker = window.term.registerMarker(1)`);
        await ctx.page.evaluate(`window.marker.dispose()`);
        await pollFor(ctx.page, `window.decoration = window.term.registerDecoration({ marker: window.marker });`, undefined);
      });
      test('should throw when a negative x offset is provided', async () => {
        await openTerminal(ctx);
        await ctx.page.evaluate(`window.marker = window.term.registerMarker(1)`);
        await ctx.page.evaluate(`
        try {
          window.decoration = window.term.registerDecoration({ marker: window.marker, x: -2 });
        } catch (e) {
          window.throwMessage = e.message;
        }
      `);
        await pollFor(ctx.page, 'window.throwMessage', 'This API only accepts positive integers');
      });
    });
    test.describe('overviewRulerDecorations', () => {
      test('should not add an overview ruler when width is not set', async () => {
        await openTerminal(ctx);
        await ctx.page.evaluate(`window.marker1 = window.term.registerMarker(1)`);
        await ctx.page.evaluate(`window.marker2 = window.term.registerMarker(2)`);
        await ctx.page.evaluate(`window.term.registerDecoration({ marker: window.marker1, overviewRulerOptions: { color: 'red', position: 'full' } })`);
        await ctx.page.evaluate(`window.term.registerDecoration({ marker: window.marker2, overviewRulerOptions: { color: 'blue', position: 'full' } })`);
        await pollFor(ctx.page, `document.querySelectorAll('.xterm-decoration-overview-ruler').length`, 0);
      });
      test('should add an overview ruler when width is set', async () => {
        await openTerminal(ctx, { overviewRulerWidth: 15 });
        await ctx.page.evaluate(`window.marker1 = window.term.registerMarker(1)`);
        await ctx.page.evaluate(`window.marker2 = window.term.registerMarker(2)`);
        await ctx.page.evaluate(`window.term.registerDecoration({ marker: window.marker1, overviewRulerOptions: { color: 'red', position: 'full' } })`);
        await ctx.page.evaluate(`window.term.registerDecoration({ marker: window.marker2, overviewRulerOptions: { color: 'blue', position: 'full' } })`);
        await pollFor(ctx.page, `document.querySelectorAll('.xterm-decoration-overview-ruler').length`, 1);
      });
    });
  });

  test.describe('registerLinkProvider', () => {
    test('should fire provideLinks when hovering cells', async () => {
      await openTerminal(ctx);
      // Focus the terminal as the cursor will show and trigger a rerender, which can clear the
      // active link
      await ctx.proxy.focus();
      await ctx.page.evaluate(`
        window.calls = [];
        window.disposable = window.term.registerLinkProvider({
          provideLinks: (position, cb) => {
            calls.push(position);
            cb(undefined);
          }
        });
      `);
      const dims = await getDimensions();
      await moveMouseCell(dims, 1, 1);
      await moveMouseCell(dims, 2, 2);
      await moveMouseCell(dims, 10, 4);
      await pollFor(ctx.page, `window.calls`, [1, 2, 4]);
      await ctx.page.evaluate(`window.disposable.dispose()`);
    });

    test('should fire hover and leave events on the link', async () => {
      await openTerminal(ctx);
      // Focus the terminal as the cursor will show and trigger a rerender, which can clear the
      // active link
      await ctx.page.evaluate('window.term.focus()');
      await ctx.proxy.write('foo bar baz');
      // Wait for renderer to catch up as links are cleared on render
      await pollFor(ctx.page, `document.querySelector('.xterm-rows').textContent`, 'foo bar baz ');
      await ctx.page.evaluate(`
        window.calls = [];
        window.disposable = window.term.registerLinkProvider({
          provideLinks: (position, cb) => {
            window.calls.push('provide ' + position);
            if (position === 1) {
              window.calls.push('match');
              cb([{
                range: { start: { x: 5, y: 1 }, end: { x: 7, y: 1 } },
                text: 'bar',
                activate: () => window.calls.push('activate'),
                hover: () => window.calls.push('hover'),
                leave: () => window.calls.push('leave')
              }]);
            }
          }
        });
      `);
      const dims = await getDimensions();
      await moveMouseCell(dims, 5, 1);
      await timeout(100);
      await moveMouseCell(dims, 4, 1);
      await pollFor(ctx.page, `window.calls`, ['provide 1', 'match', 'hover', 'leave' ]);
      await moveMouseCell(dims, 7, 1);
      await timeout(100);
      await moveMouseCell(dims, 8, 1);
      await pollFor(ctx.page, `window.calls`, ['provide 1', 'match', 'hover', 'leave', 'hover', 'leave']);
      await ctx.page.evaluate(`window.disposable.dispose()`);
    });

    test('should work fine when hover and leave callbacks are not provided', async () => {
      await openTerminal(ctx);
      // Focus the terminal as the cursor will show and trigger a rerender, which can clear the
      // active link
      await ctx.page.evaluate('window.term.focus()');
      await ctx.proxy.write('foo bar baz');
      // Wait for renderer to catch up as links are cleared on render
      await pollFor(ctx.page, `document.querySelector('.xterm-rows').textContent`, 'foo bar baz ');
      await ctx.page.evaluate(`
        window.calls = [];
        window.disposable = window.term.registerLinkProvider({
          provideLinks: (position, cb) => {
            window.calls.push('provide ' + position);
            if (position === 1) {
              window.calls.push('match 1');
              cb([{
                range: { start: { x: 5, y: 1 }, end: { x: 7, y: 1 } },
                text: 'bar',
                activate: () => window.calls.push('activate')
              }]);
            } else if (position === 2) {
              window.calls.push('match 2');
              cb([{
                range: { start: { x: 5, y: 2 }, end: { x: 7, y: 2 } },
                text: 'bar',
                activate: () => window.calls.push('activate')
              }]);
            }
          }
        });
      `);
      const dims = await getDimensions();
      await moveMouseCell(dims, 5, 1);
      await pollFor(ctx.page, `window.calls`, ['provide 1', 'match 1']);
      await moveMouseCell(dims, 4, 2);
      await pollFor(ctx.page, `window.calls`, ['provide 1', 'match 1', 'provide 2', 'match 2']);
      await moveMouseCell(dims, 7, 1);
      await pollFor(ctx.page, `window.calls`, ['provide 1', 'match 1', 'provide 2', 'match 2', 'provide 1', 'match 1']);
      await moveMouseCell(dims, 6, 2);
      await pollFor(ctx.page, `window.calls`, ['provide 1', 'match 1', 'provide 2', 'match 2', 'provide 1', 'match 1', 'provide 2', 'match 2']);
      await ctx.page.evaluate(`window.disposable.dispose()`);
    });

    test('should fire activate events when clicking the link', async () => {
      await openTerminal(ctx);
      // Focus the terminal as the cursor will show and trigger a rerender, which can clear the
      // active link
      await ctx.page.evaluate('window.term.focus()');
      await ctx.proxy.write('a b c');
      // Wait for renderer to catch up as links are cleared on render
      await pollFor(ctx.page, `document.querySelector('.xterm-rows').textContent`, 'a b c ');
      await ctx.page.evaluate(`
        window.calls = [];
        window.disposable = window.term.registerLinkProvider({
          provideLinks: (y, cb) => {
            window.calls.push('provide ' + y);
            cb([{
              range: { start: { x: 1, y }, end: { x: 80, y } },
              text: window.term.buffer.active.getLine(y - 1).translateToString(),
              activate: (_, text) => window.calls.push('activate ' + y),
              hover: () => window.calls.push('hover ' + y),
              leave: () => window.calls.push('leave ' + y)
            }]);
          }
        });
      `);
      const dims = await getDimensions();
      await moveMouseCell(dims, 3, 1);
      await pollFor(ctx.page, `window.calls`, ['provide 1', 'hover 1']);
      await ctx.page.mouse.down();
      await ctx.page.mouse.up();
      await pollFor(ctx.page, `window.calls`, ['provide 1', 'hover 1', 'activate 1']);
      await moveMouseCell(dims, 1, 2);
      await pollFor(ctx.page, `window.calls`, ['provide 1', 'hover 1', 'activate 1', 'leave 1', 'provide 2', 'hover 2']);
      await ctx.page.mouse.down();
      await ctx.page.mouse.up();
      await pollFor(ctx.page, `window.calls`, ['provide 1', 'hover 1', 'activate 1', 'leave 1', 'provide 2', 'hover 2', 'activate 2']);
      await moveMouseCell(dims, 5, 1);
      await pollFor(ctx.page, `window.calls`, ['provide 1', 'hover 1', 'activate 1', 'leave 1', 'provide 2', 'hover 2', 'activate 2', 'leave 2', 'provide 1', 'hover 1']);
      await ctx.page.mouse.down();
      await ctx.page.mouse.up();
      await pollFor(ctx.page, `window.calls`, ['provide 1', 'hover 1', 'activate 1', 'leave 1', 'provide 2', 'hover 2', 'activate 2', 'leave 2', 'provide 1', 'hover 1', 'activate 1']);
      await ctx.page.evaluate(`window.disposable.dispose()`);
    });

    test('should work when multiple links are provided on the same line', async () => {
      await openTerminal(ctx);
      // Focus the terminal as the cursor will show and trigger a rerender, which can clear the
      // active link
      await ctx.page.evaluate('window.term.focus()');
      await ctx.proxy.write('foo bar baz');
      // Wait for renderer to catch up as links are cleared on render
      await pollFor(ctx.page, `document.querySelector('.xterm-rows').textContent`, 'foo bar baz ');
      await ctx.page.evaluate(`
        window.calls = [];
        window.disposable = window.term.registerLinkProvider({
          provideLinks: (position, cb) => {
            window.calls.push('provide ' + position);
            if (position === 1) {
              cb([{
                range: { start: { x: 1, y: 1 }, end: { x: 3, y: 1 } },
                text: '',
                activate: () => window.calls.push('activate'),
                hover: () => window.calls.push('hover 1-3'),
                leave: () => window.calls.push('leave 1-3')
              }, {
                range: { start: { x: 5, y: 1 }, end: { x: 7, y: 1 } },
                text: '',
                activate: () => window.calls.push('activate'),
                hover: () => window.calls.push('hover 5-7'),
                leave: () => window.calls.push('leave 5-7')
              }, {
                range: { start: { x: 9, y: 1 }, end: { x: 11, y: 1 } },
                text: '',
                activate: () => window.calls.push('activate'),
                hover: () => window.calls.push('hover 9-11'),
                leave: () => window.calls.push('leave 9-11')
              }]);
            }
          }
        });
      `);
      const dims = await getDimensions();
      await moveMouseCell(dims, 2, 1);
      await pollFor(ctx.page, `window.calls`, ['provide 1', 'hover 1-3']);
      await moveMouseCell(dims, 6, 1);
      await pollFor(ctx.page, `window.calls`, ['provide 1', 'hover 1-3', 'leave 1-3', 'hover 5-7']);
      await moveMouseCell(dims, 6, 2);
      await pollFor(ctx.page, `window.calls`, ['provide 1', 'hover 1-3', 'leave 1-3', 'hover 5-7', 'leave 5-7', 'provide 2']);
      await moveMouseCell(dims, 10, 1);
      await pollFor(ctx.page, `window.calls`, ['provide 1', 'hover 1-3', 'leave 1-3', 'hover 5-7', 'leave 5-7', 'provide 2', 'provide 1', 'hover 9-11']);
      await ctx.page.evaluate(`window.disposable.dispose()`);
    });

    test('should dispose links when hovering away', async () => {
      await openTerminal(ctx);
      // Focus the terminal as the cursor will show and trigger a rerender, which can clear the
      // active link
      await ctx.page.evaluate('window.term.focus()');
      await ctx.proxy.write('foo bar baz');
      // Wait for renderer to catch up as links are cleared on render
      await pollFor(ctx.page, `document.querySelector('.xterm-rows').textContent`, 'foo bar baz ');
      await ctx.page.evaluate(`
        window.calls = [];
        window.disposable = window.term.registerLinkProvider({
          provideLinks: (position, cb) => {
            window.calls.push('provide ' + position);
            if (position === 1) {
              cb([{
                range: { start: { x: 1, y: 1 }, end: { x: 3, y: 1 } },
                text: '',
                activate: () => window.calls.push('activate'),
                dispose: () => window.calls.push('dispose 1-3'),
                hover: () => window.calls.push('hover 1-3'),
                leave: () => window.calls.push('leave 1-3')
              }, {
                range: { start: { x: 5, y: 1 }, end: { x: 7, y: 1 } },
                text: '',
                activate: () => window.calls.push('activate'),
                dispose: () => window.calls.push('dispose 5-7'),
                hover: () => window.calls.push('hover 5-7'),
                leave: () => window.calls.push('leave 5-7')
              }, {
                range: { start: { x: 9, y: 1 }, end: { x: 11, y: 1 } },
                text: '',
                activate: () => window.calls.push('activate'),
                dispose: () => window.calls.push('dispose 9-11'),
                hover: () => window.calls.push('hover 9-11'),
                leave: () => window.calls.push('leave 9-11')
              }]);
            }
          }
        });
      `);
      const dims = await getDimensions();
      await moveMouseCell(dims, 2, 1);
      await pollFor(ctx.page, `window.calls`, ['provide 1', 'hover 1-3']);
      await moveMouseCell(dims, 6, 1);
      await pollFor(ctx.page, `window.calls`, ['provide 1', 'hover 1-3', 'leave 1-3', 'hover 5-7']);
      await moveMouseCell(dims, 6, 2);
      await pollFor(ctx.page, `window.calls`, ['provide 1', 'hover 1-3', 'leave 1-3', 'hover 5-7', 'leave 5-7', 'dispose 1-3', 'dispose 5-7', 'dispose 9-11', 'provide 2']);
      await moveMouseCell(dims, 10, 1);
      await pollFor(ctx.page, `window.calls`, ['provide 1', 'hover 1-3', 'leave 1-3', 'hover 5-7', 'leave 5-7', 'dispose 1-3', 'dispose 5-7', 'dispose 9-11', 'provide 2', 'provide 1', 'hover 9-11']);
      await moveMouseCell(dims, 10, 2);
      await pollFor(ctx.page, `window.calls`, ['provide 1', 'hover 1-3', 'leave 1-3', 'hover 5-7', 'leave 5-7', 'dispose 1-3', 'dispose 5-7', 'dispose 9-11', 'provide 2', 'provide 1', 'hover 9-11', 'leave 9-11', 'dispose 1-3', 'dispose 5-7', 'dispose 9-11', 'provide 2']);
      await ctx.page.evaluate(`window.disposable.dispose()`);
    });
  });
});

interface IDimensions {
  top: number;
  left: number;
  renderDimensions: IRenderDimensions;
}

async function getDimensions(): Promise<IDimensions> {
  return await ctx.page.evaluate(`
    (function() {
      const rect = document.querySelector('.xterm-rows').getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        renderDimensions: window.term._core._renderService.dimensions
      };
    })();
  `);
}

async function getCellCoordinates(dimensions: IDimensions, col: number, row: number): Promise<{ x: number, y: number }> {
  return {
    x: dimensions.left + dimensions.renderDimensions.device.cell.width * (col - 0.5),
    y: dimensions.top + dimensions.renderDimensions.device.cell.height * (row - 0.5)
  };
}

async function moveMouseCell(dimensions: IDimensions, col: number, row: number): Promise<void> {
  const coords = await getCellCoordinates(dimensions, col, row);
  await ctx.page.mouse.move(coords.x, coords.y);
}
