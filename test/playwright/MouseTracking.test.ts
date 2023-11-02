/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { test } from '@playwright/test';
import { deepStrictEqual, ok, strictEqual } from 'assert';
import type { IDisposable } from '@xterm/xterm';
import { createTestContext, ITestContext, openTerminal, pollFor } from './TestUtils';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx);
});
test.afterAll(async () => await ctx.page.close());

// adjusted to work inside devcontainer
// see https://github.com/xtermjs/xterm.js/issues/2379
const width = 1280;
const height = 960;

// adjust terminal row/col size so we can test
// >80 up to 223 and >255
const fontSize = 6;
const cols = 260;
const rows = 50;

// for some reason shift gets not caught by selection manager on macos
const noShift = process.platform === 'darwin' ? false : true;

/**
 * Helper functions.
 */
async function resetMouseModes(): Promise<void> {
  await ctx.proxy.write('\x1b[?9l\x1b[?1000l\x1b[?1001l\x1b[?1002l\x1b[?1003l');
  await ctx.proxy.write('\x1b[?1005l\x1b[?1006l\x1b[?1015l');
}

async function getReports(encoding: string): Promise<any[]> {
  const reports: any = await ctx.page.evaluate(`window.calls`);
  await ctx.page.evaluate(`window.calls = [];`);
  return reports.map((report: number[]) => parseReport(encoding, report));
}

// translate cell positions into pixel offset
// always adds +2 in each direction so we dont end up in the wrong cell
// due to rounding issues
async function cellPos(col: number, row: number): Promise<number[]> {
  const coords: any = await ctx.page.evaluate(`
    (function() {
      const rect = window.term.element.getBoundingClientRect();
      const dim = term._core._renderService.dimensions;
      return {left: rect.left, top: rect.top, bottom: rect.bottom, right: rect.right, width: dim.css.cell.width, height: dim.css.cell.height};
    })();
  `);
  return [col * coords.width + coords.left + 2, row * coords.height + coords.top + 2];
}

/**
 * Patched playwright functions.
 * This is needed to:
 *  - translate cell positions into pixel positions
 *  - allow modifiers to be set
 *  - fake wheel events
 */
async function mouseMove(col: number, row: number): Promise<void> {
  const [xPixels, yPixels] = await cellPos(col, row);
  await ctx.page.mouse.move(xPixels, yPixels);
}
async function mouseDown(button: 'left' | 'right' | 'middle' | undefined): Promise<void> {
  await ctx.page.mouse.down({ button });
}
async function mouseUp(button: 'left' | 'right' | 'middle' | undefined): Promise<void> {
  await ctx.page.mouse.up({ button });
}

// button definitions
const buttons: { [key: string]: number } = {
  '<none>': -1,
  left: 0,
  middle: 1,
  right: 2,
  released: 3,
  wheelUp: 4,
  wheelDown: 5,
  wheelLeft: 6,
  wheelRight: 7,
  aux8: 8,
  aux9: 9,
  aux10: 10,
  aux11: 11,
  aux12: 12,
  aux13: 13,
  aux14: 14,
  aux15: 15
};
const reverseButtons: any = {};
for (const el in buttons) {
  reverseButtons[buttons[el]] = el;
}

// extract button data from buttonCode
function evalButtonCode(code: number): any {
  if (code > 255) {
    return { button: 'invalid', action: 'invalid', modifier: {} };
  }
  const modifier = { shift: !!(code & 4), meta: !!(code & 8), control: !!(code & 16) };
  const move = code & 32;
  let button = code & 3;
  if (code & 128) {
    button |= 8;
  }
  if (code & 64) {
    button |= 4;
  }
  let actionS = 'press';
  let buttonS = reverseButtons[button];
  if (button === 3) {
    buttonS = '<none>';
    actionS = 'release';
  }
  if (move) {
    actionS = 'move';
  } else if (4 <= button && button <= 7) {
    buttonS = 'wheel';
    actionS = button === 4 ? 'up' : button === 5 ? 'down' : button === 6 ? 'left' : 'right';
  }
  return { button: buttonS, action: actionS, modifier };
}

// parse a single mouse report
function parseReport(encoding: string, msg: number[]): { state: any, row: number, col: number } | string {
  let sReport: string;
  let buttonCode: number;
  let row: number;
  let col: number;
  // unpack msg
  const report = String.fromCharCode.apply(null, msg);
  // skip non mouse reports
  if (!report || report[0] !== '\x1b') {
    return report;
  }
  switch (encoding) {
    case 'DEFAULT':
      return {
        state: evalButtonCode(report.charCodeAt(3) - 32),
        col: report.charCodeAt(4) - 32,
        row: report.charCodeAt(5) - 32
      };
    case 'SGR':
      sReport = report.slice(3, -1);
      [buttonCode, col, row] = sReport.split(';').map(el => parseInt(el));
      const state = evalButtonCode(buttonCode);
      if (report[report.length - 1] === 'm') {
        state.action = 'release';
      }
      return { state, row, col };
    default:
      return {
        state: evalButtonCode(report.charCodeAt(3) - 32),
        col: report.charCodeAt(4) - 32,
        row: report.charCodeAt(5) - 32
      };
  }
}

test.describe('Mouse Tracking Tests', () => {
  test.beforeAll(async () => {
    await ctx.page.setViewportSize({ width, height });
    // patch terminal to get the onData calls
    // we encode the msg here to an array of codes to not lose bytes
    // (transmission strips non utf8 bytes)
    // also resize so we can properly test the edge cases
    await ctx.page.evaluate(`
      window.term.onData(e => window.calls.push( Array.from(e).map(el => el.charCodeAt(0)) ));
      window.term.onBinary(e => window.calls.push( Array.from(e).map(el => el.charCodeAt(0)) ));
    `);
  });

  test.beforeEach(async () => {
    await ctx.page.evaluate(`
      window.calls = [];
      window.term.options.fontSize = ${fontSize};
    `);
    await ctx.proxy.resize(cols, rows);
  });

  test.describe('DECSET 9 (X10)', async () => {
    /**
     * X10 protocol:
     *  - only press events
     *  - no wheel
     *  - no move
     *  - no modifiers
     */
    test('default encoding', async () => {
      if (ctx.browser.browserType().name() === 'webkit') {
        test.skip();
        return;
      }
      const encoding = 'DEFAULT';
      await resetMouseModes();
      await mouseMove(0, 0);
      await ctx.proxy.write('\x1b[?9h');

      // test at 0,0
      await mouseDown('left');
      await pollFor(ctx.page, () => getReports(encoding), [{ col: 1, row: 1, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);

      // mouseup should not report
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), []);

      // mousemove should not report
      await mouseMove(50, 10);
      await pollFor(ctx.page, () => getReports(encoding), []);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [{ col: 51, row: 11, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);

      // test at max rows/cols
      // capped at 223 (1-based)
      await mouseMove(223 - 1, rows - 1);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [{ col: 223, row: rows, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);

      // higher than 223 should not report at all
      await mouseMove(257, rows - 1);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), []);

      // button press/move/release tests
      // left button
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);
      // middle button
      // bug: default action not cancelled (adds data to getReports from clipboard under X11)
      // await mouseMove(43, 24);
      // await getReports(encoding); // clear reports
      // await mouseDown('middle');
      // await mouseMove(44, 24);
      // await mouseUp('middle');
      // await pollFor(ctx.page, () => getReports(encoding), [{col: 44, row: 25, state: {action: 'press', button: 'middle', modifier: {control: false, shift: false, meta: false}}}]);
      // right button
      // bug: default action not cancelled (popup shown)
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await mouseDown('right');
      await mouseMove(44, 24);
      await mouseUp('right');
      await pollFor(ctx.page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'press', button: 'right', modifier: { control: false, shift: false, meta: false } } }]);

      // wheel
      // await mouseMove(43, 24);
      // await getReports(encoding); // clear reports
      // await wheelUp();
      // await pollFor(ctx.page, () => getReports(encoding), []);
      // await wheelDown();
      // await pollFor(ctx.page, () => getReports(encoding), []);

      // modifiers
      // CTRL
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await ctx.page.keyboard.down('Control');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Control');
      await pollFor(ctx.page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);


      // ALT
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await ctx.page.keyboard.down('Alt');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Alt');
      await pollFor(ctx.page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);

      // SHIFT
      // note: caught by selection manager
      // bug? Why not caught by selection manger on macos?
      // bug: no modifier reported
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await ctx.page.keyboard.down('Shift');  // defaults to ShiftLeft
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Shift');
      if (noShift) {
        await pollFor(ctx.page, () => getReports(encoding), []);
      } else {
        await pollFor(ctx.page, () => getReports(encoding), [
          { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }
        ]);
      }

      // all modifiers
      // bug: Shift not working - reporting totally wrong coords and modifiers - selection manager again?
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await ctx.page.keyboard.down('Control');
      await ctx.page.keyboard.down('Alt');
      // await ctx.page.keyboard.down('Shift');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Control');
      await ctx.page.keyboard.up('Alt');
      // await ctx.page.keyboard.up('Shift');
      await pollFor(ctx.page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);
    });
    test('SGR encoding', async () => {
      if (ctx.browser.browserType().name() === 'webkit') {
        test.skip();
        return;
      }
      const encoding = 'SGR';
      await resetMouseModes();
      await mouseMove(0, 0);
      await ctx.proxy.write('\x1b[?9h\x1b[?1006h');

      // test at 0,0
      await mouseDown('left');
      await pollFor(ctx.page, () => getReports(encoding), [{ col: 1, row: 1, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);

      // mouseup should not report
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), []);

      // mousemove should not report
      await mouseMove(50, 10);
      await pollFor(ctx.page, () => getReports(encoding), []);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [{ col: 51, row: 11, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);

      // test at max rows/cols
      await mouseMove(cols - 1, rows - 1);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [{ col: cols, row: rows, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);

      // button press/move/release tests
      // left button
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);
      // middle button
      // bug: default action not cancelled (adds data to getReports from clipboard under X11)
      // await mouseMove(43, 24);
      // await getReports(encoding); // clear reports
      // await mouseDown('middle');
      // await mouseMove(44, 24);
      // await mouseUp('middle');
      // await pollFor(ctx.page, () => getReports(encoding), [{col: 44, row: 25, state: {action: 'press', button: 'middle', modifier: {control: false, shift: false, meta: false}}}]);
      // right button
      // bug: default action not cancelled (popup shown)
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await mouseDown('right');
      await mouseMove(44, 24);
      await mouseUp('right');
      await pollFor(ctx.page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'press', button: 'right', modifier: { control: false, shift: false, meta: false } } }]);

      // wheel
      // await mouseMove(43, 24);
      // await getReports(encoding); // clear reports
      // await wheelUp();
      // await pollFor(ctx.page, () => getReports(encoding), []);
      // await wheelDown();
      // await pollFor(ctx.page, () => getReports(encoding), []);

      // modifiers
      // CTRL
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await ctx.page.keyboard.down('Control');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Control');
      await pollFor(ctx.page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);


      // ALT
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await ctx.page.keyboard.down('Alt');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Alt');
      await pollFor(ctx.page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);

      // SHIFT
      // note: caught by selection manager
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await ctx.page.keyboard.down('Shift');  // defaults to ShiftLeft
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Shift');
      if (noShift) {
        await pollFor(ctx.page, () => getReports(encoding), []);
      } else {
        await pollFor(ctx.page, () => getReports(encoding), [
          { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }
        ]);
      }

      // all modifiers
      // bug: Shift not working - reporting totally wrong coords and modifiers - selection manager again?
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await ctx.page.keyboard.down('Control');
      await ctx.page.keyboard.down('Alt');
      // await ctx.page.keyboard.down('Shift');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Control');
      await ctx.page.keyboard.up('Alt');
      // await ctx.page.keyboard.up('Shift');
      await pollFor(ctx.page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);
    });
  });
  test.describe('DECSET 1000 (VT200 mouse)', () => {
    /**
     * VT200 protocol:
     *  - press and release events
     *  - wheel up/down
     *  - no move
     *  - all modifiers
     */
    test('default encoding', async () => {
      if (ctx.browser.browserType().name() === 'webkit') {
        test.skip();
        return;
      }
      const encoding = 'DEFAULT';
      await resetMouseModes();
      await mouseMove(0, 0);
      await ctx.proxy.write('\x1b[?1000h');

      // test at 0,0
      await mouseDown('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mouseup should report, encoding cannot report released button
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mousemove should not report
      await mouseMove(50, 10);
      await pollFor(ctx.page, () => getReports(encoding), []);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 51, row: 11, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 51, row: 11, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // test at max rows/cols
      // capped at 223 (1-based)
      await mouseMove(223 - 1, rows - 1);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 223, row: rows, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 223, row: rows, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // button press/move/release tests
      // left button
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);
      // middle button
      // bug: default action not cancelled (adds data to getReports from clipboard under X11)
      // await mouseMove(43, 24);
      // await getReports(encoding); // clear reports
      // await mouseDown('middle');
      // await mouseMove(44, 24);
      // await mouseUp('middle');
      // await pollFor(ctx.page, () => getReports(encoding), [{col: 44, row: 25, state: {action: 'press', button: 'middle', modifier: {control: false, shift: false, meta: false}}}]);
      // right button
      // bug: default action not cancelled (popup shown)
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await mouseDown('right');
      await mouseMove(44, 24);
      await mouseUp('right');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'right', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // wheel
      // await mouseMove(43, 24);
      // await getReports(encoding); // clear reports
      // await wheelUp();
      // await pollFor(ctx.page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'up', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);
      // await wheelDown();
      // await pollFor(ctx.page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);

      // modifiers
      // CTRL
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await ctx.page.keyboard.down('Control');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Control');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: true, shift: false, meta: false } } }
        // { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: false } } }
      ]);

      // ALT
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await ctx.page.keyboard.down('Alt');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Alt');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: true } } }
        // { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: true } } }
      ]);

      // SHIFT
      // note: press/release caught by selection manager
      // bug: modifier not reported for passed events
      // await mouseMove(43, 24);
      // await getReports(encoding); // clear reports
      // await ctx.page.keyboard.down('Shift');  // defaults to ShiftLeft
      // await mouseDown('left');
      // await mouseMove(44, 24);
      // await mouseUp('left');
      // // await wheelDown();
      // await ctx.page.keyboard.up('Shift');
      // // if (noShift) {
      // //  await pollFor(ctx.page, () => getReports(encoding), [
      // //    // { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
      // //  ]);
      // // } else {
      //   await pollFor(ctx.page, () => getReports(encoding), [
      //     { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: true, meta: false } } },
      //     { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: false, shift: true, meta: false } } },
      //     // { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
      //   ]);
      // // }

      // all modifiers
      // bug: Shift not working - selection manager?
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await ctx.page.keyboard.down('Control');
      await ctx.page.keyboard.down('Alt');
      // await ctx.page.keyboard.down('Shift');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Control');
      await ctx.page.keyboard.up('Alt');
      // await ctx.page.keyboard.up('Shift');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: true, shift: false, meta: true } } }
        // { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: true } } }
      ]);
    });
    test('SGR encoding', async () => {
      if (ctx.browser.browserType().name() === 'webkit') {
        test.skip();
        return;
      }
      const encoding = 'SGR';
      await resetMouseModes();
      await mouseMove(0, 0);
      await ctx.proxy.write('\x1b[?1000h\x1b[?1006h');

      // test at 0,0
      await mouseDown('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mouseup should report
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mousemove should not report
      await mouseMove(50, 10);
      await pollFor(ctx.page, () => getReports(encoding), []);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 51, row: 11, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 51, row: 11, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // test at max rows/cols
      await mouseMove(cols - 1, rows - 1);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: cols, row: rows, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: cols, row: rows, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // button press/move/release tests
      // left button
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);
      // middle button
      // bug: default action not cancelled (adds data to getReports from clipboard under X11)
      // await mouseMove(43, 24);
      // await getReports(encoding); // clear reports
      // await mouseDown('middle');
      // await mouseMove(44, 24);
      // await mouseUp('middle');
      // await pollFor(ctx.page, () => getReports(encoding), [{col: 44, row: 25, state: {action: 'press', button: 'middle', modifier: {control: false, shift: false, meta: false}}}]);
      // right button
      // bug: default action not cancelled (popup shown)
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await mouseDown('right');
      await mouseMove(44, 24);
      await mouseUp('right');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'right', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: 'right', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // wheel
      // await mouseMove(43, 24);
      // await getReports(encoding); // clear reports
      // await wheelUp();
      // await pollFor(ctx.page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'up', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);
      // await wheelDown();
      // await pollFor(ctx.page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);

      // modifiers
      // CTRL
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await ctx.page.keyboard.down('Control');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Control');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: true, shift: false, meta: false } } }
        // { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: false } } }
      ]);

      // ALT
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await ctx.page.keyboard.down('Alt');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Alt');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: true } } }
        // { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: true } } }
      ]);

      // SHIFT
      // note: press/release caught by selection manager
      // await mouseMove(43, 24);
      // await getReports(encoding); // clear reports
      // await ctx.page.keyboard.down('Shift');  // defaults to ShiftLeft
      // await mouseDown('left');
      // await mouseMove(44, 24);
      // await mouseUp('left');
      // await wheelDown();
      // await ctx.page.keyboard.up('Shift');
      // if (noShift) {
      //   await pollFor(ctx.page, () => getReports(encoding), [
      //     { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
      //   ]);
      // } else {
      //   await pollFor(ctx.page, () => getReports(encoding), [
      //     { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: true, meta: false } } },
      //     { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: false, shift: true, meta: false } } },
      //     { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
      //   ]);
      // }

      // all modifiers
      // bug: Shift not working - selection manager?
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await ctx.page.keyboard.down('Control');
      await ctx.page.keyboard.down('Alt');
      // await ctx.page.keyboard.down('Shift');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Control');
      await ctx.page.keyboard.up('Alt');
      // await ctx.page.keyboard.up('Shift');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: true, shift: false, meta: true } } }
        // { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: true } } }
      ]);
    });
  });
  test.describe('DECSET 1002 (xterm with drag)', () => {
    /**
     *  - press and release events
     *  - wheel up/down
     *  - move only on press (drag)
     *  - all modifiers
     * Note: tmux runs this with SGR encoding.
     */
    test('default encoding', async () => {
      if (ctx.browser.browserType().name() === 'webkit') {
        test.skip();
        return;
      }
      const encoding = 'DEFAULT';
      await resetMouseModes();
      await mouseMove(0, 0);
      await ctx.proxy.write('\x1b[?1002h');

      // test at 0,0
      await mouseDown('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mouseup should report, encoding cannot report released button
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mousemove should not report
      await mouseMove(50, 10);
      await pollFor(ctx.page, () => getReports(encoding), []);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 51, row: 11, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 51, row: 11, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // test at max rows/cols
      // capped at 223 (1-based)
      await mouseMove(223 - 1, rows - 1);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 223, row: rows, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 223, row: rows, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // button press/move/release tests
      // left button
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);
      // middle button
      // bug: default action not cancelled (adds data to getReports from clipboard under X11)
      // await mouseMove(43, 24);
      // await getReports(encoding); // clear reports
      // await mouseDown('middle');
      // await mouseMove(44, 24);
      // await mouseUp('middle');
      // await pollFor(ctx.page, () => getReports(encoding), [{col: 44, row: 25, state: {action: 'press', button: 'middle', modifier: {control: false, shift: false, meta: false}}}]);
      // right button
      // bug: default action not cancelled (popup shown)
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await mouseDown('right');
      await mouseMove(44, 24);
      await mouseUp('right');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'right', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'move', button: 'right', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // wheel
      // await mouseMove(43, 24);
      // await getReports(encoding); // clear reports
      // await wheelUp();
      // await pollFor(ctx.page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'up', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);
      // await wheelDown();
      // await pollFor(ctx.page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);

      // modifiers
      // CTRL
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await ctx.page.keyboard.down('Control');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Control');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: true, shift: false, meta: false } } }
        // { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: false } } }
      ]);

      // ALT
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await ctx.page.keyboard.down('Alt');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Alt');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: true } } }
        // { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: true } } }
      ]);

      // SHIFT
      // note: press/release/drag caught by selection manager
      // await mouseMove(43, 24);
      // await getReports(encoding); // clear reports
      // await ctx.page.keyboard.down('Shift');  // defaults to ShiftLeft
      // await mouseDown('left');
      // await mouseMove(44, 24);
      // await mouseUp('left');
      // await wheelDown();
      // await ctx.page.keyboard.up('Shift');
      // if (noShift) {
      //   await pollFor(ctx.page, () => getReports(encoding), [
      //     { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
      //   ]);
      // } else {
      //   await pollFor(ctx.page, () => getReports(encoding), [
      //     { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: true, meta: false } } },
      //     { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: false, shift: true, meta: false } } },
      //     { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: false, shift: true, meta: false } } },
      //     { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
      //   ]);
      // }

      // all modifiers
      // bug: Shift not working
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await ctx.page.keyboard.down('Control');
      await ctx.page.keyboard.down('Alt');
      // await ctx.page.keyboard.down('Shift');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Control');
      await ctx.page.keyboard.up('Alt');
      // await ctx.page.keyboard.up('Shift');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: true, shift: false, meta: true } } }
        // { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: true } } }
      ]);
    });
    test('SGR encoding', async () => {
      if (ctx.browser.browserType().name() === 'webkit') {
        test.skip();
        return;
      }
      const encoding = 'SGR';
      await resetMouseModes();
      await mouseMove(0, 0);
      await ctx.proxy.write('\x1b[?1002h\x1b[?1006h');

      // test at 0,0
      // bug: release is fired immediately
      await mouseDown('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mouseup should report, encoding cannot report released button
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mousemove should not report
      await mouseMove(50, 10);
      await pollFor(ctx.page, () => getReports(encoding), []);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 51, row: 11, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 51, row: 11, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // test at max rows/cols
      await mouseMove(cols - 1, rows - 1);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: cols, row: rows, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: cols, row: rows, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // button press/move/release tests
      // left button
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);
      // middle button
      // bug: default action not cancelled (adds data to getReports from clipboard under X11)
      // await mouseMove(43, 24);
      // await getReports(encoding); // clear reports
      // await mouseDown('middle');
      // await mouseMove(44, 24);
      // await mouseUp('middle');
      // await pollFor(ctx.page, () => getReports(encoding), [{col: 44, row: 25, state: {action: 'press', button: 'middle', modifier: {control: false, shift: false, meta: false}}}]);
      // right button
      // bug: default action not cancelled (popup shown)
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await mouseDown('right');
      await mouseMove(44, 24);
      await mouseUp('right');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'right', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'move', button: 'right', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: 'right', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // wheel
      // await mouseMove(43, 24);
      // await getReports(encoding); // clear reports
      // await wheelUp();
      // await pollFor(ctx.page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'up', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);
      // await wheelDown();
      // await pollFor(ctx.page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);

      // modifiers
      // CTRL
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await ctx.page.keyboard.down('Control');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Control');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: true, shift: false, meta: false } } }
        // { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: false } } }
      ]);

      // ALT
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await ctx.page.keyboard.down('Alt');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Alt');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: true } } }
        // { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: true } } }
      ]);

      // SHIFT
      // note: press/release/drag caught by selection manager
      // await mouseMove(43, 24);
      // await getReports(encoding); // clear reports
      // await ctx.page.keyboard.down('Shift');  // defaults to ShiftLeft
      // await mouseDown('left');
      // await mouseMove(44, 24);
      // await mouseUp('left');
      // await wheelDown();
      // await ctx.page.keyboard.up('Shift');
      // if (noShift) {
      //   await pollFor(ctx.page, () => getReports(encoding), [
      //     { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
      //   ]);
      // } else {
      //   await pollFor(ctx.page, () => getReports(encoding), [
      //     { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: true, meta: false } } },
      //     { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: false, shift: true, meta: false } } },
      //     { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: false, shift: true, meta: false } } },
      //     { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
      //   ]);
      // }

      // all modifiers
      // bug: this is totally broken with wrong coords and messed up modifiers
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await ctx.page.keyboard.down('Control');
      await ctx.page.keyboard.down('Alt');
      // await ctx.page.keyboard.down('Shift');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Control');
      await ctx.page.keyboard.up('Alt');
      // await ctx.page.keyboard.up('Shift');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: true, shift: false, meta: true } } }
        // { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: true } } }
      ]);
    });
  });
  test.describe('DECSET 1003 (xterm any event)', () => {
    /**
     *  - all events (press, release, wheel, move)
     *  - all modifiers
     */
    test('default encoding', async () => {
      if (ctx.browser.browserType().name() === 'webkit') {
        test.skip();
        return;
      }
      const encoding = 'DEFAULT';
      await resetMouseModes();
      await mouseMove(0, 0);
      await ctx.proxy.write('\x1b[?1003h');

      // test at 0,0
      await mouseDown('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mouseup should report, encoding cannot report released button
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mousemove should report
      await mouseMove(50, 10);
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 51, row: 11, state: { action: 'move', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 51, row: 11, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 51, row: 11, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // test at max rows/cols
      // capped at 223 (1-based)
      await mouseMove(223 - 1, rows - 1);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 223, row: rows, state: { action: 'move', button: '<none>', modifier: { control: false, shift: false, meta: false } } },
        { col: 223, row: rows, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 223, row: rows, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // button press/move/release tests
      // left button
      await mouseMove(43, 24);
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: false, shift: false, meta: false } } },
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);
      // middle button
      // bug: default action not cancelled (adds data to getReports from clipboard under X11)
      // await mouseMove(43, 24);
      // await getReports(encoding); // clear reports
      // await mouseDown('middle');
      // await mouseMove(44, 24);
      // await mouseUp('middle');
      // await pollFor(ctx.page, () => getReports(encoding), [{col: 44, row: 25, state: {action: 'press', button: 'middle', modifier: {control: false, shift: false, meta: false}}}]);
      // right button
      // bug: default action not cancelled (popup shown)
      await mouseMove(43, 24);
      await mouseDown('right');
      await mouseMove(44, 24);
      await mouseUp('right');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: false, shift: false, meta: false } } },
        { col: 44, row: 25, state: { action: 'press', button: 'right', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'move', button: 'right', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // wheel
      // await mouseMove(43, 24);
      // await getReports(encoding); // clear reports
      // await wheelUp();
      // await pollFor(ctx.page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'up', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);
      // await wheelDown();
      // await pollFor(ctx.page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);

      // modifiers
      // CTRL
      await ctx.page.keyboard.down('Control');
      await mouseMove(43, 24);
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Control');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: true, shift: false, meta: false } } },
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: true, shift: false, meta: false } } }
        // { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: false } } }
      ]);

      // ALT
      await ctx.page.keyboard.down('Alt');
      await mouseMove(43, 24);
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Alt');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: false, shift: false, meta: true } } },
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: true } } }
        // { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: true } } }
      ]);

      // SHIFT
      // note: press/release/drag caught by selection manager
      // await ctx.page.keyboard.down('Shift');
      // await mouseMove(43, 24);
      // await mouseDown('left');
      // await mouseMove(44, 24);
      // await mouseUp('left');
      // await wheelDown();
      // await ctx.page.keyboard.up('Shift');
      // if (noShift) {
      //   await pollFor(ctx.page, () => getReports(encoding), [
      //     { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: false, shift: true, meta: false } } },
      //     { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
      //   ]);
      // } else {
      //   await pollFor(ctx.page, () => getReports(encoding), [
      //     { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: false, shift: true, meta: false } } },
      //     { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: true, meta: false } } },
      //     { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: false, shift: true, meta: false } } },
      //     { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: false, shift: true, meta: false } } },
      //     { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
      //   ]);
      // }

      // all modifiers
      // bug: Shift not working
      await ctx.page.keyboard.down('Control');
      await ctx.page.keyboard.down('Alt');
      // await ctx.page.keyboard.down('Shift');
      await mouseMove(43, 24);
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Control');
      await ctx.page.keyboard.up('Alt');
      // await ctx.page.keyboard.up('Shift');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: true, shift: false, meta: true } } },
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: true, shift: false, meta: true } } }
        // { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: true } } }
      ]);
    });
    test('SGR encoding', async () => {
      if (ctx.browser.browserType().name() === 'webkit') {
        test.skip();
        return;
      }
      const encoding = 'SGR';
      await resetMouseModes();
      await mouseMove(0, 0);
      await ctx.proxy.write('\x1b[?1003h\x1b[?1006h');

      // test at 0,0
      await mouseDown('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mouseup should report, encoding cannot report released button
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mousemove should report
      await mouseMove(50, 10);
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 51, row: 11, state: { action: 'move', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 51, row: 11, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 51, row: 11, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // test at max rows/cols
      // bug: we are capped at col 95 currently
      // fix: allow values up to 223, any bigger should drop to 0
      await mouseMove(cols - 1, rows - 1);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: cols, row: rows, state: { action: 'move', button: '<none>', modifier: { control: false, shift: false, meta: false } } },
        { col: cols, row: rows, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: cols, row: rows, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // button press/move/release tests
      // left button
      await mouseMove(43, 24);
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: false, shift: false, meta: false } } },
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);
      // middle button
      // bug: default action not cancelled (adds data to getReports from clipboard under X11)
      // await mouseMove(43, 24);
      // await getReports(encoding); // clear reports
      // await mouseDown('middle');
      // await mouseMove(44, 24);
      // await mouseUp('middle');
      // await pollFor(ctx.page, () => getReports(encoding), [{col: 44, row: 25, state: {action: 'press', button: 'middle', modifier: {control: false, shift: false, meta: false}}}]);
      // right button
      // bug: default action not cancelled (popup shown)
      await mouseMove(43, 24);
      await mouseDown('right');
      await mouseMove(44, 24);
      await mouseUp('right');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: false, shift: false, meta: false } } },
        { col: 44, row: 25, state: { action: 'press', button: 'right', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'move', button: 'right', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: 'right', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // wheel
      // await mouseMove(43, 24);
      // await getReports(encoding); // clear reports
      // await wheelUp();
      // await pollFor(ctx.page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'up', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);
      // await wheelDown();
      // await pollFor(ctx.page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);

      // modifiers
      // CTRL
      await ctx.page.keyboard.down('Control');
      await mouseMove(43, 24);
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Control');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: true, shift: false, meta: false } } },
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: true, shift: false, meta: false } } }
        // { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: false } } }
      ]);

      // ALT
      await ctx.page.keyboard.down('Alt');
      await mouseMove(43, 24);
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Alt');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: false, shift: false, meta: true } } },
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: true } } }
        // { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: true } } }
      ]);

      // SHIFT
      // note: press/release/drag caught by selection manager
      // await ctx.page.keyboard.down('Shift');
      // await mouseMove(43, 24);
      // await mouseDown('left');
      // await mouseMove(44, 24);
      // await mouseUp('left');
      // await wheelDown();
      // await ctx.page.keyboard.up('Shift');
      // if (noShift) {
      //   await pollFor(ctx.page, () => getReports(encoding), [
      //     { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: false, shift: true, meta: false } } },
      //     { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
      //   ]);
      // } else {
      //   await pollFor(ctx.page, () => getReports(encoding), [
      //     { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: false, shift: true, meta: false } } },
      //     { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: true, meta: false } } },
      //     { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: false, shift: true, meta: false } } },
      //     { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: false, shift: true, meta: false } } },
      //     { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
      //   ]);
      // }

      // all modifiers
      // bug: Shift not working
      await ctx.page.keyboard.down('Control');
      await ctx.page.keyboard.down('Alt');
      // await ctx.page.keyboard.down('Shift');
      await mouseMove(43, 24);
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      // await wheelDown();
      await ctx.page.keyboard.up('Control');
      await ctx.page.keyboard.up('Alt');
      // await ctx.page.keyboard.up('Shift');
      await pollFor(ctx.page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: true, shift: false, meta: true } } },
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: true, shift: false, meta: true } } }
        // { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: true } } }
      ]);
    });
  });
  /**
   * move tests with multiple buttons pressed:
   * currently not possible due to a limitation of the playwright mouse interface
   * (saves only the last one pressed)
   */
});
