/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { test } from '@playwright/test';
import { deepStrictEqual, ok, strictEqual } from 'assert';
import type { IRenderDimensions } from 'browser/renderer/Types';
import { createTestContext, ITestContext, openTerminal, pollFor } from './TestUtils';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx);
});
test.afterAll(async () => await ctx.page.close());

test.describe('InputHandler Integration Tests', function(): void {
  test.describe('CSI', () => {
    test.beforeEach(async () => await ctx.proxy.reset());

    test('ICH: Insert Ps (Blank) Character(s) (default = 1) - CSI Ps @', async () => {
      await ctx.proxy.write('foo\x1b[3D\x1b[@\n\r'); // Default
      await ctx.proxy.write('bar\x1b[3D\x1b[4@'); // Explicit
      deepStrictEqual(await getLinesAsArray(2), [' foo', '    bar']);
    });

    test('CUU: Cursor Up Ps Times (default = 1) - CSI Ps A', async () => {
      await ctx.proxy.write('\n\n\n\n\x1b[Aa'); // Default
      await ctx.proxy.write('\x1b[2Ab'); // Explicit
      deepStrictEqual(await getLinesAsArray(4), ['', ' b', '', 'a']);
    });

    test('CUD: Cursor Down Ps Times (default = 1) - CSI Ps B', async () => {
      await ctx.proxy.write('\x1b[Ba'); // Default
      await ctx.proxy.write('\x1b[2Bb'); // Explicit
      deepStrictEqual(await getLinesAsArray(4), ['', 'a', '', ' b']);
    });

    test('CUF: Cursor Forward Ps Times (default = 1) - CSI Ps C', async () => {
      await ctx.proxy.write('\x1b[Ca'); // Default
      await ctx.proxy.write('\x1b[2Cb'); // Explicit
      deepStrictEqual(await getLinesAsArray(1), [' a  b']);
    });

    test('CUB: Cursor Backward Ps Times (default = 1) - CSI Ps D', async () => {
      await ctx.proxy.write('foo\x1b[Da'); // Default
      await ctx.proxy.write('\x1b[2Db'); // Explicit
      deepStrictEqual(await getLinesAsArray(1), ['fba']);
    });

    test('CNL: Cursor Next Line Ps Times (default = 1) - CSI Ps E', async () => {
      await ctx.proxy.write('\x1b[Ea'); // Default
      await ctx.proxy.write('\x1b[2Eb'); // Explicit
      deepStrictEqual(await getLinesAsArray(4), ['', 'a', '', 'b']);
    });

    test('CPL: Cursor Preceding Line Ps Times (default = 1) - CSI Ps F', async () => {
      await ctx.proxy.write('\n\n\n\n\x1b[Fa'); // Default
      await ctx.proxy.write('\x1b[2Fb'); // Explicit
      deepStrictEqual(await getLinesAsArray(5), ['', 'b', '', 'a', '']);
    });

    test('CHA: Cursor Character Absolute [column] (default = [row,1]) - CSI Ps G', async () => {
      await ctx.proxy.write('foo\x1b[Ga'); // Default
      await ctx.proxy.write('\x1b[10Gb'); // Explicit
      deepStrictEqual(await getLinesAsArray(1), ['aoo      b']);
    });

    test('CUP: Cursor Position [row;column] (default = [1,1]) - CSI Ps ; Ps H', async () => {
      await ctx.proxy.write('foo\x1b[Ha'); // Default
      await ctx.proxy.write('\x1b[3;3Hb'); // Explicit
      deepStrictEqual(await getLinesAsArray(3), ['aoo', '', '  b']);
    });

    test('CHT: Cursor Forward Tabulation Ps tab stops (default = 1) - CSI Ps I', async () => {
      await ctx.proxy.write('\x1b[Ia'); // Default
      await ctx.proxy.write('\n\r\x1b[2Ib'); // Explicit
      deepStrictEqual(await getLinesAsArray(2), ['        a', '                b']);
    });

    test('ED: Erase in Display, VT100 - CSI Ps J', async () => {
      const fixture = 'abc\n\rdef\n\rghi\x1b[2;2H';
      // Default: Erase Below
      await ctx.proxy.resize(5, 5);
      await ctx.proxy.write(`${fixture}\x1b[J`);
      deepStrictEqual(await getLinesAsArray(3), ['abc', 'd', '']);
      // 0: Erase Below
      await ctx.proxy.reset();
      await ctx.proxy.write(`${fixture}\x1b[0J`);
      deepStrictEqual(await getLinesAsArray(3), ['abc', 'd', '']);
      // 1: Erase Above
      await ctx.proxy.reset();
      await ctx.proxy.write(`${fixture}\x1b[1J`);
      deepStrictEqual(await getLinesAsArray(3), ['', '  f', 'ghi']);
      // 2: Erase Saved Lines (scrollback)
      await ctx.proxy.reset();
      await ctx.proxy.write(`1\n2\n3\n4\n5${fixture}\x1b[3J`);
      strictEqual(await ctx.proxy.buffer.active.length, 5);
      deepStrictEqual(await getLinesAsArray(5), ['   4', '    5', 'abc', 'def', 'ghi']);
    });

    test('DECSED: Erase in Display, VT220 - CSI ? Ps J', async () => {
      const fixture = 'abc\n\rdef\n\rghi\x1b[2;2H';
      // Default: Erase Below
      await ctx.proxy.resize(5, 5);
      await ctx.proxy.write(`${fixture}\x1b[?J`);
      deepStrictEqual(await getLinesAsArray(3), ['abc', 'd', '']);
      // 0: Erase Below
      await ctx.proxy.reset();
      await ctx.proxy.write(`${fixture}\x1b[?0J`);
      deepStrictEqual(await getLinesAsArray(3), ['abc', 'd', '']);
      // 1: Erase Above
      await ctx.proxy.reset();
      await ctx.proxy.write(`${fixture}\x1b[?1J`);
      deepStrictEqual(await getLinesAsArray(3), ['', '  f', 'ghi']);
      // 2: Erase Saved Lines (scrollback)
      await ctx.proxy.reset();
      await ctx.proxy.write(`1\n2\n3\n4\n5${fixture}\x1b[?3J`);
      strictEqual(await ctx.proxy.buffer.active.length, 5);
      deepStrictEqual(await getLinesAsArray(5), ['   4', '    5', 'abc', 'def', 'ghi']);
    });

    test('IL: Insert Ps Line(s) (default = 1) - CSI Ps L', async () => {
      await ctx.proxy.write('foo\x1b[La'); // Default
      await ctx.proxy.write('\x1b[2Lb'); // Explicit
      deepStrictEqual(await getLinesAsArray(4), ['b', '', 'a', 'foo']);
    });

    test('DL: Delete Ps Line(s) (default = 1) - CSI Ps M', async () => {
      await ctx.proxy.write('a\nb\x1b[1F\x1b[M'); // Default
      await ctx.proxy.write('\x1b[1Ed\ne\nf\x1b[2F\x1b[2M'); // Explicit
      deepStrictEqual(await getLinesAsArray(5), [' b', '  f', '', '', '']);
    });

    test('DCH: Delete Ps Character(s) (default = 1) - CSI Ps P', async () => {
      await ctx.proxy.write('abc\x1b[1;1H\x1b[P'); // Default
      await ctx.proxy.write('\n\rdef\x1b[2;1H\x1b[2P'); // Explicit
      deepStrictEqual(await getLinesAsArray(2), ['bc', 'f']);
    });

    test.describe('DSR: Device Status Report', () => {
      test('Status Report - CSI 5 n', async () => {
        const calls: string[] = [];
        ctx.proxy.onData(e => calls.push(e));
        await ctx.proxy.write('\x1b[5n');
        deepStrictEqual(calls, ['\x1b[0n']);
      });

      test('Report Cursor Position (CPR) - CSI 6 n', async () => {
        const calls: string[] = [];
        ctx.proxy.onData(e => calls.push(e));
        await ctx.proxy.write('\n\nfoo');
        strictEqual(await ctx.proxy.buffer.active.cursorX, 3);
        strictEqual(await ctx.proxy.buffer.active.cursorY, 2);
        await ctx.proxy.write('\x1b[6n');
        deepStrictEqual(calls, ['\x1b[3;4R']);
      });

      test('Report Cursor Position (DECXCPR) - CSI ? 6 n', async () => {
        const calls: string[] = [];
        ctx.proxy.onData(e => calls.push(e));
        await ctx.proxy.write('\n\nfoo');
        strictEqual(await ctx.proxy.buffer.active.cursorX, 3);
        strictEqual(await ctx.proxy.buffer.active.cursorY, 2);
        await ctx.proxy.write('\x1b[?6n');
        deepStrictEqual(calls, ['\x1b[?3;4R']);
      });
    });

    test.describe('SM: Set Mode', () => {
      test.describe('CSI ? Pm h', () => {
        test('Pm = 1003, Set Use All Motion (any event) Mouse Tracking', async () => {
          const coords = await ctx.proxy.evaluate(([term]) => {
            const rect = term.element!.getBoundingClientRect();
            return { left: rect.left, top: rect.top, bottom: rect.bottom, right: rect.right };
          });
          // Click and drag and ensure there is a selection
          await ctx.page.mouse.click((coords.left + coords.right) / 2, (coords.top + coords.bottom) / 2);
          await ctx.page.mouse.down();
          await ctx.page.mouse.move((coords.left + coords.right) / 2, (coords.top + coords.bottom) / 4);
          ok((await ctx.proxy.getSelection()).length > 0, 'mouse events are off so there should be a selection');
          await ctx.page.mouse.up();
          // Clear selection
          await ctx.page.mouse.click((coords.left + coords.right) / 2, (coords.top + coords.bottom) / 2);
          strictEqual((await ctx.proxy.getSelection()).length, 0);
          // Enable mouse events
          await ctx.proxy.write('\x1b[?1003h');
          // Click and drag and ensure there is no selection
          await ctx.page.mouse.click((coords.left + coords.right) / 2, (coords.top + coords.bottom) / 2);
          await ctx.page.mouse.down();
          await ctx.page.mouse.move((coords.left + coords.right) / 2, (coords.top + coords.bottom) / 4);
          // mouse events are on so there should be no selection
          strictEqual((await ctx.proxy.getSelection()).length, 0);
          await ctx.page.mouse.up();
        });

        // TODO: This only works in Chromium? (isChromium ? it : it.skip)
        test('Pm = 2004, Set bracketed paste mode', async () => {
          strictEqual(await simulatePaste('foo'), 'foo');
          await ctx.proxy.write('\x1b[?2004h');
          strictEqual(await simulatePaste('bar'), '\x1b[200~bar\x1b[201~');
          await ctx.proxy.write('\x1b[?2004l');
          strictEqual(await simulatePaste('baz'), 'baz');
        });
      });
    });

    test('REP: Repeat preceding character, ECMA48 - CSI Ps b', async () => {
      // default to 1
      await ctx.proxy.resize(10, 10);
      await ctx.proxy.write('#\x1b[b');
      await ctx.proxy.writeln('');
      await ctx.proxy.write('#\x1b[0b');
      await ctx.proxy.writeln('');
      await ctx.proxy.write('#\x1b[1b');
      await ctx.proxy.writeln('');
      await ctx.proxy.write('#\x1b[5b');
      deepStrictEqual(await getLinesAsArray(4), ['##', '##', '##', '######']);
      strictEqual(await ctx.proxy.buffer.active.cursorX, 6);
      strictEqual(await ctx.proxy.buffer.active.cursorY, 3);
      // should not repeat on fullwidth chars
      await ctx.proxy.reset();
      await ctx.proxy.write('￥\x1b[10b');
      deepStrictEqual(await getLinesAsArray(1), ['￥']);
      // should repeat only base char of combining
      await ctx.proxy.reset();
      await ctx.proxy.write('e\u0301\x1b[5b');
      deepStrictEqual(await getLinesAsArray(1), ['e\u0301eeeee']);
      // should wrap correctly
      await ctx.proxy.reset();
      await ctx.proxy.write('#\x1b[15b');
      deepStrictEqual(await getLinesAsArray(2), ['##########', '######']);
      await ctx.proxy.reset();
      await ctx.proxy.write('\x1b[?7l');  // disable wrap around
      await ctx.proxy.write('#\x1b[15b');
      deepStrictEqual(await getLinesAsArray(2), ['##########', '']);
      // any successful sequence should reset REP
      await ctx.proxy.reset();
      await ctx.proxy.write('\x1b[?7h');  // re-enable wrap around
      await ctx.proxy.write('#\n\x1b[3b');
      await ctx.proxy.write('#\r\x1b[3b');
      await ctx.proxy.writeln('');
      await ctx.proxy.write('abcdefg\x1b[3D\x1b[10b#\x1b[3b');
      deepStrictEqual(await getLinesAsArray(3), ['#', ' #', 'abcd####']);
    });

    test.describe('Window Options - CSI Ps ; Ps ; Ps t', () => {
      test('should be disabled by default', async () => {
        const calls: string[] = [];
        ctx.proxy.onData(e => calls.push(e));
        await ctx.proxy.write('\x1b[14t');
        await ctx.proxy.write('\x1b[16t');
        await ctx.proxy.write('\x1b[18t');
        await ctx.proxy.write('\x1b[20t');
        await ctx.proxy.write('\x1b[21t');
        deepStrictEqual(calls, []);
      });
      test('14 - GetWinSizePixels', async () => {
        const calls: string[] = [];
        ctx.proxy.onData(e => calls.push(e));
        await ctx.proxy.setOption('windowOptions', { getWinSizePixels: true });
        await ctx.proxy.write('\x1b[14t');
        const d = await getDimensions();
        deepStrictEqual(calls, [`\x1b[4;${d.height};${d.width}t`]);
      });
      test('16 - GetCellSizePixels', async () => {
        const calls: string[] = [];
        ctx.proxy.onData(e => calls.push(e));
        await ctx.proxy.setOption('windowOptions', { getCellSizePixels: true });
        await ctx.proxy.write('\x1b[16t');
        const d = await getDimensions();
        deepStrictEqual(calls, [`\x1b[6;${d.cellHeight};${d.cellWidth}t`]);
      });
    });
  });

  test.describe('ESC', () => {
    test.describe('DECRC: Save cursor, ESC 7', () => {
      test('should save the absolute cursor position so resizing restores to the correct position', async () => {
        await ctx.proxy.resize(10, 2);
        await ctx.proxy.write('1\n\r2\n\r3\n\r4\n\r5');
        await ctx.proxy.write('\x1b7\x1b[?47h');
        await ctx.proxy.resize(10, 4);
        await ctx.proxy.write('\x1b[?47l\x1b8');
        strictEqual(await ctx.proxy.buffer.active.cursorX, 1);
        strictEqual(await ctx.proxy.buffer.active.cursorY, 3);
      });
    });
  });
});

async function getLinesAsArray(count: number, start: number = 0): Promise<string[]> {
  let text = '';
  for (let i = start; i < start + count; i++) {
    text += `window.term.buffer.active.getLine(${i}).translateToString(true),`;
  }
  return await ctx.page.evaluate(`[${text}]`);
}

async function simulatePaste(text: string): Promise<string> {
  const id = Math.floor(Math.random() * 1000000);
  let result!: string;
  ctx.proxy.onData(e => result = e);
  await ctx.page.evaluate(([term, text]) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', `${text}`);
    term.textarea!.dispatchEvent(new ClipboardEvent('paste', { clipboardData }));
  }, [await ctx.proxy.getHandle(), text] as const);
  ok(result, 'The paste result should not be falsy');
  return result;
}

async function getDimensions(): Promise<{ cellWidth: number, cellHeight: number, width: number, height: number }> {
  const dim: IRenderDimensions = await ctx.proxy.core.renderDimensions;
  return {
    cellWidth: Math.round(dim.actualCellWidth),
    cellHeight: Math.round(dim.actualCellHeight),
    width: Math.round(dim.canvasWidth),
    height: Math.round(dim.canvasHeight)
  };
}
