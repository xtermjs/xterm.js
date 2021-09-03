/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { test } from '@playwright/test';
import { deepStrictEqual, strictEqual } from 'assert';
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

    test('ICH: Insert Ps (Blank) Character(s) (default = 1) - CSI Ps @', async function(): Promise<any> {
      await ctx.proxy.write('foo\x1b[3D\x1b[@\n\r'); // Default
      await ctx.proxy.write('bar\x1b[3D\x1b[4@'); // Explicit
      deepStrictEqual(await getLinesAsArray(2), [' foo', '    bar']);
    });

    test('CUU: Cursor Up Ps Times (default = 1) - CSI Ps A', async function(): Promise<any> {
      await ctx.proxy.write('\n\n\n\n\x1b[Aa'); // Default
      await ctx.proxy.write('\x1b[2Ab'); // Explicit
      deepStrictEqual(await getLinesAsArray(4), ['', ' b', '', 'a']);
    });

    test('CUD: Cursor Down Ps Times (default = 1) - CSI Ps B', async function(): Promise<any> {
      await ctx.proxy.write('\x1b[Ba'); // Default
      await ctx.proxy.write('\x1b[2Bb'); // Explicit
      deepStrictEqual(await getLinesAsArray(4), ['', 'a', '', ' b']);
    });

    test('CUF: Cursor Forward Ps Times (default = 1) - CSI Ps C', async function(): Promise<any> {
      await ctx.proxy.write('\x1b[Ca'); // Default
      await ctx.proxy.write('\x1b[2Cb'); // Explicit
      deepStrictEqual(await getLinesAsArray(1), [' a  b']);
    });

    test('CUB: Cursor Backward Ps Times (default = 1) - CSI Ps D', async function(): Promise<any> {
      await ctx.proxy.write('foo\x1b[Da'); // Default
      await ctx.proxy.write('\x1b[2Db'); // Explicit
      deepStrictEqual(await getLinesAsArray(1), ['fba']);
    });

    test('CNL: Cursor Next Line Ps Times (default = 1) - CSI Ps E', async function(): Promise<any> {
      await ctx.proxy.write('\x1b[Ea'); // Default
      await ctx.proxy.write('\x1b[2Eb'); // Explicit
      deepStrictEqual(await getLinesAsArray(4), ['', 'a', '', 'b']);
    });

    test('CPL: Cursor Preceding Line Ps Times (default = 1) - CSI Ps F', async function(): Promise<any> {
      await ctx.proxy.write('\n\n\n\n\x1b[Fa'); // Default
      await ctx.proxy.write('\x1b[2Fb'); // Explicit
      deepStrictEqual(await getLinesAsArray(5), ['', 'b', '', 'a', '']);
    });

    test('CHA: Cursor Character Absolute [column] (default = [row,1]) - CSI Ps G', async function(): Promise<any> {
      await ctx.proxy.write('foo\x1b[Ga'); // Default
      await ctx.proxy.write('\x1b[10Gb'); // Explicit
      deepStrictEqual(await getLinesAsArray(1), ['aoo      b']);
    });

    test('CUP: Cursor Position [row;column] (default = [1,1]) - CSI Ps ; Ps H', async function(): Promise<any> {
      await ctx.proxy.write('foo\x1b[Ha'); // Default
      await ctx.proxy.write('\x1b[3;3Hb'); // Explicit
      deepStrictEqual(await getLinesAsArray(3), ['aoo', '', '  b']);
    });

    test('CHT: Cursor Forward Tabulation Ps tab stops (default = 1) - CSI Ps I', async function(): Promise<any> {
      await ctx.proxy.write('\x1b[Ia'); // Default
      await ctx.proxy.write('\n\r\x1b[2Ib'); // Explicit
      deepStrictEqual(await getLinesAsArray(2), ['        a', '                b']);
    });

    test('ED: Erase in Display, VT100 - CSI Ps J', async function(): Promise<any> {
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

    // test('DECSED: Erase in Display, VT220 - CSI ? Ps J', async function(): Promise<any> {
    //   const fixture = 'abc\\n\\rdef\\n\\rghi\x1b[2;2H';
    //   await page.evaluate(`
    //     // Default: Erase Below
    //     window.term.resize(5, 5);
    //     window.term.write('${fixture}\x1b[?J')
    //   `);
    //   await pollFor(page, () => getLinesAsArray(3), ['abc', 'd', '']);
    //   await page.evaluate(`
    //     // 0: Erase Below
    //     window.term.reset()
    //     window.term.write('${fixture}\x1b[?0J')
    //   `);
    //   await pollFor(page, () => getLinesAsArray(3), ['abc', 'd', '']);
    //   await page.evaluate(`
    //     // 1: Erase Above
    //     window.term.reset()
    //     window.term.write('${fixture}\x1b[?1J')
    //   `);
    //   await pollFor(page, () => getLinesAsArray(3), ['', '  f', 'ghi']);
    //   await page.evaluate(`
    //     // 2: Erase Saved Lines (scrollback)
    //     window.term.reset()
    //     window.term.write('1\\n2\\n3\\n4\\n5${fixture}\x1b[?3J')
    //   `);
    //   await pollFor(page, () => page.evaluate(`window.term.buffer.active.length`), 5);
    //   await pollFor(page, () => getLinesAsArray(5), ['   4', '    5', 'abc', 'def', 'ghi']);
    // });

    test('IL: Insert Ps Line(s) (default = 1) - CSI Ps L', async function(): Promise<any> {
      await ctx.proxy.write('foo\x1b[La'); // Default
      await ctx.proxy.write('\x1b[2Lb'); // Explicit
      deepStrictEqual(await getLinesAsArray(4), ['b', '', 'a', 'foo']);
    });

    test('DL: Delete Ps Line(s) (default = 1) - CSI Ps M', async function(): Promise<any> {
      await ctx.proxy.write('a\nb\x1b[1F\x1b[M'); // Default
      await ctx.proxy.write('\x1b[1Ed\ne\nf\x1b[2F\x1b[2M'); // Explicit
      deepStrictEqual(await getLinesAsArray(5), [' b', '  f', '', '', '']);
    });

    test('DCH: Delete Ps Character(s) (default = 1) - CSI Ps P', async function(): Promise<any> {
      await ctx.proxy.write('abc\x1b[1;1H\x1b[P'); // Default
      await ctx.proxy.write('\n\rdef\x1b[2;1H\x1b[2P'); // Explicit
      deepStrictEqual(await getLinesAsArray(2), ['bc', 'f']);
    });

    // test.describe('DSR: Device Status Report', () => {
    //   test('Status Report - CSI 5 n', async function(): Promise<any> {
    //     await page.evaluate(`
    //       window.term.onData(e => window.result = e);
    //       window.term.write('\\x1b[5n');
    //     `);
    //     await pollFor(page, () => page.evaluate(`window.result`), '\x1b[0n');
    //   });

    //   test('Report Cursor Position (CPR) - CSI 6 n', async function(): Promise<any> {
    //     await page.evaluate(`window.term.write('\\n\\nfoo')`);
    //     await pollFor(page, () => page.evaluate(`
    //       [window.term.buffer.active.cursorY, window.term.buffer.active.cursorX]
    //     `), [2, 3]);
    //     await page.evaluate(`
    //       window.term.onData(e => window.result = e);
    //       window.term.write('\\x1b[6n');
    //     `);
    //     await pollFor(page, () => page.evaluate(`window.result`), '\x1b[3;4R');
    //   });

    //   test('Report Cursor Position (DECXCPR) - CSI ? 6 n', async function(): Promise<any> {
    //     await page.evaluate(`window.term.write('\\n\\nfoo')`);
    //     await pollFor(page, () => page.evaluate(`
    //       [window.term.buffer.active.cursorY, window.term.buffer.active.cursorX]
    //     `), [2, 3]);
    //     await page.evaluate(`
    //       window.term.onData(e => window.result = e);
    //       window.term.write('\\x1b[?6n');
    //     `);
    //     await pollFor(page, () => page.evaluate(`window.result`), '\x1b[?3;4R');
    //   });
    // });

    // test.describe('SM: Set Mode', () => {
    //   test.describe('CSI ? Pm h', () => {
    //     test('Pm = 1003, Set Use All Motion (any event) Mouse Tracking', async () => {
    //       const coords: { left: number, top: number, bottom: number, right: number } = await page.evaluate(`
    //         (function() {
    //           const rect = window.term.element.getBoundingClientRect();
    //           return { left: rect.left, top: rect.top, bottom: rect.bottom, right: rect.right };
    //         })();
    //       `);
    //       // Click and drag and ensure there is a selection
    //       await page.mouse.click((coords.left + coords.right) / 2, (coords.top + coords.bottom) / 2);
    //       await page.mouse.down();
    //       await page.mouse.move((coords.left + coords.right) / 2, (coords.top + coords.bottom) / 4);
    //       assert.ok(await page.evaluate(`window.term.getSelection().length`) as number > 0, 'mouse events are off so there should be a selection');
    //       await page.mouse.up();
    //       // Clear selection
    //       await page.mouse.click((coords.left + coords.right) / 2, (coords.top + coords.bottom) / 2);
    //       await pollFor(page, () => page.evaluate(`window.term.getSelection().length`), 0);
    //       // Enable mouse events
    //       await page.evaluate(`window.term.write('\x1b[?1003h')`);
    //       // Click and drag and ensure there is no selection
    //       await page.mouse.click((coords.left + coords.right) / 2, (coords.top + coords.bottom) / 2);
    //       await page.mouse.down();
    //       await page.mouse.move((coords.left + coords.right) / 2, (coords.top + coords.bottom) / 4);
    //       // mouse events are on so there should be no selection
    //       await pollFor(page, () => page.evaluate(`window.term.getSelection().length`), 0);
    //       await page.mouse.up();
    //     });
    //     (isChromium ? it : it.skip)('Pm = 2004, Set bracketed paste mode', async function(): Promise<any> {
    //       await pollFor(page, () => simulatePaste('foo'), 'foo');
    //       await page.evaluate(`window.term.write('\x1b[?2004h')`);
    //       await pollFor(page, () => simulatePaste('bar'), '\x1b[200~bar\x1b[201~');
    //       await page.evaluate(`window.term.write('\x1b[?2004l')`);
    //       await pollFor(page, () => simulatePaste('baz'), 'baz');
    //     });
    //   });
    // });

    // test('REP: Repeat preceding character, ECMA48 - CSI Ps b', async function(): Promise<any> {
    //   // default to 1
    //   await page.evaluate(`
    //       window.term.resize(10, 10);
    //       window.term.write('#\x1b[b');
    //       window.term.writeln('');
    //       window.term.write('#\x1b[0b');
    //       window.term.writeln('');
    //       window.term.write('#\x1b[1b');
    //       window.term.writeln('');
    //       window.term.write('#\x1b[5b');
    //       `);
    //   await pollFor(page, () => getLinesAsArray(4), ['##', '##', '##', '######']);
    //   await pollFor(page, () => getCursor(), { col: 6, row: 3 });
    //   // should not repeat on fullwidth chars
    //   await page.evaluate(`
    //       window.term.reset();
    //       window.term.write('￥\x1b[10b');
    //       `);
    //   await pollFor(page, () => getLinesAsArray(1), ['￥']);
    //   // should repeat only base char of combining
    //   await page.evaluate(`
    //       window.term.reset();
    //       window.term.write('e\u0301\x1b[5b');
    //       `);
    //   await pollFor(page, () => getLinesAsArray(1), ['e\u0301eeeee']);
    //   // should wrap correctly
    //   await page.evaluate(`
    //       window.term.reset();
    //       window.term.write('#\x1b[15b');
    //       `);
    //   await pollFor(page, () => getLinesAsArray(2), ['##########', '######']);
    //   await page.evaluate(`
    //       window.term.reset();
    //       window.term.write('\x1b[?7l');  // disable wrap around
    //       window.term.write('#\x1b[15b');
    //       `);
    //   await pollFor(page, () => getLinesAsArray(2), ['##########', '']);
    //   // any successful sequence should reset REP
    //   await page.evaluate(`
    //       window.term.reset();
    //       window.term.write('\x1b[?7h');  // re-enable wrap around
    //       window.term.write('#\\n\x1b[3b');
    //       window.term.write('#\\r\x1b[3b');
    //       window.term.writeln('');
    //       window.term.write('abcdefg\x1b[3D\x1b[10b#\x1b[3b');
    //       `);
    //   await pollFor(page, () => getLinesAsArray(3), ['#', ' #', 'abcd####']);
    // });

    // test.describe('Window Options - CSI Ps ; Ps ; Ps t', () => {
    //   test('should be disabled by default', async function(): Promise<any> {
    //     await page.evaluate(`(() => {
    //         window._stack = [];
    //         const _h = window.term.onData(data => window._stack.push(data));
    //         window.term.write('\x1b[14t');
    //         window.term.write('\x1b[16t');
    //         window.term.write('\x1b[18t');
    //         window.term.write('\x1b[20t');
    //         window.term.write('\x1b[21t');
    //         return new Promise((r) => window.term.write('', () => { _h.dispose(); r(); }));
    //       })()`);
    //     await pollFor(page, async () => await page.evaluate(`(() => _stack)()`), []);
    //   });
    //   test('14 - GetWinSizePixels', async function(): Promise<any> {
    //     await page.evaluate(`window.term.setOption('windowOptions', { getWinSizePixels: true }); `);
    //     await page.evaluate(`(() => {
    //         window._stack = [];
    //         const _h = window.term.onData(data => window._stack.push(data));
    //         window.term.write('\x1b[14t');
    //         return new Promise((r) => window.term.write('', () => { _h.dispose(); r(); }));
    //       })()`);
    //     const d = await getDimensions();
    //     await pollFor(page, async () => await page.evaluate(`(() => _stack)()`), [`\x1b[4;${d.height};${d.width}t`]);
    //   });
    //   test('16 - GetCellSizePixels', async function(): Promise<any> {
    //     await page.evaluate(`window.term.setOption('windowOptions', { getCellSizePixels: true }); `);
    //     await page.evaluate(`(() => {
    //         window._stack = [];
    //         const _h = window.term.onData(data => window._stack.push(data));
    //         window.term.write('\x1b[16t');
    //         return new Promise((r) => window.term.write('', () => { _h.dispose(); r(); }));
    //       })()`);
    //     const d = await getDimensions();
    //     await pollFor(page, async () => await page.evaluate(`(() => _stack)()`), [`\x1b[6;${d.cellHeight};${d.cellWidth}t`]);
    //   });
    // });
  });

  // test.describe('ESC', () => {
  //   test.describe('DECRC: Save cursor, ESC 7', () => {
  //     test('should save the absolute cursor position so resizing restores to the correct position', async () => {
  //       await page.evaluate(`
  //         window.term.resize(10, 2);
  //         window.term.write('1\\n\\r2\\n\\r3\\n\\r4\\n\\r5');
  //         window.term.write('\\x1b7\\x1b[?47h');
  //         `);
  //       await page.evaluate(`
  //         window.term.resize(10, 4);
  //         window.term.write('\\x1b[?47l\\x1b8');
  //         `);
  //       await pollFor(page, () => getCursor(), { col: 1, row: 3 });
  //     });
  //   });
  // });
});

async function getLinesAsArray(count: number, start: number = 0): Promise<string[]> {
  let text = '';
  for (let i = start; i < start + count; i++) {
    text += `window.term.buffer.active.getLine(${i}).translateToString(true),`;
  }
  return await ctx.page.evaluate(`[${text}]`);
}

// async function simulatePaste(text: string): Promise<string> {
//   const id = Math.floor(Math.random() * 1000000);
//   await page.evaluate(`
//             (function() {
//               window.term.onData(e => window.result_${id} = e);
//               const clipboardData = new DataTransfer();
//               clipboardData.setData('text/plain', '${text}');
//               window.term.textarea.dispatchEvent(new ClipboardEvent('paste', { clipboardData }));
//             })();
//           `);
//   return await page.evaluate(`window.result_${id} `);
// }

// async function getCursor(): Promise<{ col: number, row: number }> {
//   return page.evaluate(`
//   (function() {
//     return {col: term.buffer.active.cursorX, row: term.buffer.active.cursorY};
//   })();
//   `);
// }

// async function getDimensions(): Promise<any> {
//   const dim: IRenderDimensions = await page.evaluate(`term._core._renderService.dimensions`);
//   return {
//     cellWidth: dim.actualCellWidth.toFixed(0),
//     cellHeight: dim.actualCellHeight.toFixed(0),
//     width: dim.canvasWidth.toFixed(0),
//     height: dim.canvasHeight.toFixed(0)
//   };
// }
