/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { pollFor, writeSync, openTerminal, getBrowserType, launchBrowser } from './TestUtils';
import { Browser, Page } from 'playwright';

const APP = 'http://127.0.0.1:3001/test';

let browser: Browser;
let page: Page;
// adjusted to work inside devcontainer
// see https://github.com/xtermjs/xterm.js/issues/2379
const width = 1280;
const height = 960;

// adjust terminal row/col size so we can test
// >80 up to 223 and >255
const fontSize = 6;
const cols = 260;
const rows = 50;

// Wheel events are hacked using private API that is only available in Chromium
const isChromium = false;

// for some reason shift gets not caught by selection manager on macos
const noShift = process.platform === 'darwin' ? false : true;

/**
 * Helper functions.
 */
async function resetMouseModes(): Promise<void> {
  return await page.evaluate(`
    window.term.write('\x1b[?9l\x1b[?1000l\x1b[?1001l\x1b[?1002l\x1b[?1003l');
    window.term.write('\x1b[?1005l\x1b[?1006l\x1b[?1015l');
  `);
}

async function getReports(encoding: string): Promise<any[]> {
  const reports: any = await page.evaluate(`window.calls`);
  await page.evaluate(`window.calls = [];`);
  return reports.map((report: number[]) => parseReport(encoding, report));
}

// translate cell positions into pixel offset
// always adds +2 in each direction so we dont end up in the wrong cell
// due to rounding issues
async function cellPos(col: number, row: number): Promise<number[]> {
  const coords: any = await page.evaluate(`
    (function() {
      const rect = window.term.element.getBoundingClientRect();
      const dim = term._core._renderService.dimensions;
      return {left: rect.left, top: rect.top, bottom: rect.bottom, right: rect.right, width: dim.actualCellWidth, height: dim.actualCellHeight};
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
  return await page.mouse.move(xPixels, yPixels);
}
async function mouseDown(button: 'left' | 'right' | 'middle' | undefined): Promise<void> {
  return await page.mouse.down({ button });
}
async function mouseUp(button: 'left' | 'right' | 'middle' | undefined): Promise<void> {
  return await page.mouse.up({ button });
}
async function wheelUp(): Promise<void> {
  const self = (page.mouse as any);
  return await self._raw._client.send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: self._x,
    y: self._y,
    deltaX: 0,
    deltaY: -10
  });
}
async function wheelDown(): Promise<void> {
  const self = (page.mouse as any);
  return await self._raw._client.send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: self._x,
    y: self._y,
    deltaX: 0,
    deltaY: 10
  });
}

function toModifiersMask(modifiers: Set<String>): number {
  let mask = 0;
  if (modifiers.has('Alt')) {
    mask |= 1;
  }
  if (modifiers.has('Control')) {
    mask |= 2;
  }
  if (modifiers.has('Meta')) {
    mask |= 4;
  }
  if (modifiers.has('Shift')) {
    mask |= 8;
  }
  return mask;
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

/**
 * Mouse tracking tests.
 */
describe('Mouse Tracking Tests', async () => {
  const browserType = getBrowserType();
  browserType.name() === 'chromium';
  const itMouse = isChromium ? it : it.skip;

  before(async function(): Promise<void> {
    browser = await launchBrowser();
    page = await (await browser.newContext()).newPage();
    await page.setViewportSize({ width, height });
  });

  after(async () => browser.close());

  beforeEach(async () => {
    await page.goto(APP);
    await openTerminal(page);
    // patch terminal to get the onData calls
    // we encode the msg here to an array of codes to not lose bytes
    // (transmission strips non utf8 bytes)
    // also resize so we can properly test the edge cases
    await page.evaluate(`
      window.calls = [];
      window.term.onData(e => calls.push( Array.from(e).map(el => el.charCodeAt(0)) ));
      window.term.onBinary(e => calls.push( Array.from(e).map(el => el.charCodeAt(0)) ));
      window.term.setOption('fontSize', ${fontSize});
      window.term.resize(${cols}, ${rows});
    `);
  });

  describe('DECSET 9 (X10)', async () => {
    /**
     * X10 protocol:
     *  - only press events
     *  - no wheel
     *  - no move
     *  - no modifiers
     */
    itMouse('default encoding', async () => {
      const encoding = 'DEFAULT';
      await resetMouseModes();
      await mouseMove(0, 0);
      await writeSync(page, '\x1b[?9h');

      // test at 0,0
      await mouseDown('left');
      await pollFor(page, () => getReports(encoding), [{ col: 1, row: 1, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);

      // mouseup should not report
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), []);

      // mousemove should not report
      await mouseMove(50, 10);
      await pollFor(page, () => getReports(encoding), []);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [{ col: 51, row: 11, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);

      // test at max rows/cols
      // capped at 223 (1-based)
      await mouseMove(223 - 1, rows - 1);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [{ col: 223, row: rows, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);

      // higher than 223 should not report at all
      await mouseMove(257, rows - 1);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), []);

      // button press/move/release tests
      // left button
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);
      // middle button
      // bug: default action not cancelled (adds data to getReports from clipboard under X11)
      // await mouseMove(43, 24);
      // await getReports(encoding); // clear reports
      // await mouseDown('middle');
      // await mouseMove(44, 24);
      // await mouseUp('middle');
      // await pollFor(page, () => getReports(encoding), [{col: 44, row: 25, state: {action: 'press', button: 'middle', modifier: {control: false, shift: false, meta: false}}}]);
      // right button
      // bug: default action not cancelled (popup shown)
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await mouseDown('right');
      await mouseMove(44, 24);
      await mouseUp('right');
      await pollFor(page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'press', button: 'right', modifier: { control: false, shift: false, meta: false } } }]);

      // wheel
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await wheelUp();
      await pollFor(page, () => getReports(encoding), []);
      await wheelDown();
      await pollFor(page, () => getReports(encoding), []);

      // modifiers
      // CTRL
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Control');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Control');
      await pollFor(page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);


      // ALT
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Alt');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Alt');
      await pollFor(page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);

      // SHIFT
      // note: caught by selection manager
      // bug? Why not caught by selection manger on macos?
      // bug: no modifier reported
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Shift');  // defaults to ShiftLeft
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Shift');
      if (noShift) {
        await pollFor(page, () => getReports(encoding), []);
      } else {
        await pollFor(page, () => getReports(encoding), [
          { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }
        ]);
      }

      // all modifiers
      // bug: Shift not working - reporting totally wrong coords and modifiers - selection manager again?
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Control');
      await page.keyboard.down('Alt');
      // await page.keyboard.down('Shift');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Control');
      await page.keyboard.up('Alt');
      // await page.keyboard.up('Shift');
      await pollFor(page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);
    });
    itMouse('SGR encoding', async () => {
      const encoding = 'SGR';
      await resetMouseModes();
      await mouseMove(0, 0);
      await writeSync(page, '\x1b[?9h\x1b[?1006h');

      // test at 0,0
      await mouseDown('left');
      await pollFor(page, () => getReports(encoding), [{ col: 1, row: 1, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);

      // mouseup should not report
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), []);

      // mousemove should not report
      await mouseMove(50, 10);
      await pollFor(page, () => getReports(encoding), []);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [{ col: 51, row: 11, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);

      // test at max rows/cols
      await mouseMove(cols - 1, rows - 1);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [{ col: cols, row: rows, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);

      // button press/move/release tests
      // left button
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);
      // middle button
      // bug: default action not cancelled (adds data to getReports from clipboard under X11)
      // await mouseMove(43, 24);
      // await getReports(encoding); // clear reports
      // await mouseDown('middle');
      // await mouseMove(44, 24);
      // await mouseUp('middle');
      // await pollFor(page, () => getReports(encoding), [{col: 44, row: 25, state: {action: 'press', button: 'middle', modifier: {control: false, shift: false, meta: false}}}]);
      // right button
      // bug: default action not cancelled (popup shown)
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await mouseDown('right');
      await mouseMove(44, 24);
      await mouseUp('right');
      await pollFor(page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'press', button: 'right', modifier: { control: false, shift: false, meta: false } } }]);

      // wheel
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await wheelUp();
      await pollFor(page, () => getReports(encoding), []);
      await wheelDown();
      await pollFor(page, () => getReports(encoding), []);

      // modifiers
      // CTRL
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Control');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Control');
      await pollFor(page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);


      // ALT
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Alt');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Alt');
      await pollFor(page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);

      // SHIFT
      // note: caught by selection manager
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Shift');  // defaults to ShiftLeft
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Shift');
      if (noShift) {
        await pollFor(page, () => getReports(encoding), []);
      } else {
        await pollFor(page, () => getReports(encoding), [
          { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }
        ]);
      }

      // all modifiers
      // bug: Shift not working - reporting totally wrong coords and modifiers - selection manager again?
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Control');
      await page.keyboard.down('Alt');
      // await page.keyboard.down('Shift');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Control');
      await page.keyboard.up('Alt');
      // await page.keyboard.up('Shift');
      await pollFor(page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }]);
    });
  });
  describe('DECSET 1000 (VT200 mouse)', () => {
    /**
     * VT200 protocol:
     *  - press and release events
     *  - wheel up/down
     *  - no move
     *  - all modifiers
     */
    itMouse('default encoding', async () => {
      const encoding = 'DEFAULT';
      await resetMouseModes();
      await mouseMove(0, 0);
      await writeSync(page, '\x1b[?1000h');

      // test at 0,0
      await mouseDown('left');
      await pollFor(page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mouseup should report, encoding cannot report released button
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mousemove should not report
      await mouseMove(50, 10);
      await pollFor(page, () => getReports(encoding), []);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [
        { col: 51, row: 11, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 51, row: 11, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // test at max rows/cols
      // capped at 223 (1-based)
      await mouseMove(223 - 1, rows - 1);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [
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
      await pollFor(page, () => getReports(encoding), [
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
      // await pollFor(page, () => getReports(encoding), [{col: 44, row: 25, state: {action: 'press', button: 'middle', modifier: {control: false, shift: false, meta: false}}}]);
      // right button
      // bug: default action not cancelled (popup shown)
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await mouseDown('right');
      await mouseMove(44, 24);
      await mouseUp('right');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'right', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // wheel
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await wheelUp();
      await pollFor(page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'up', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);
      await wheelDown();
      await pollFor(page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);

      // modifiers
      // CTRL
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Control');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Control');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: false } } }
      ]);

      // ALT
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Alt');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Alt');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: true } } }
      ]);

      // SHIFT
      // note: press/release caught by selection manager
      // bug: modifier not reported for passed events
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Shift');  // defaults to ShiftLeft
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Shift');
      if (noShift) {
        await pollFor(page, () => getReports(encoding), [
          { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
        ]);
      } else {
        await pollFor(page, () => getReports(encoding), [
          { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: true, meta: false } } },
          { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: false, shift: true, meta: false } } },
          { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
        ]);
      }

      // all modifiers
      // bug: Shift not working - selection manager?
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Control');
      await page.keyboard.down('Alt');
      // await page.keyboard.down('Shift');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Control');
      await page.keyboard.up('Alt');
      // await page.keyboard.up('Shift');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: true } } }
      ]);
    });
    itMouse('SGR encoding', async () => {
      const encoding = 'SGR';
      await resetMouseModes();
      await mouseMove(0, 0);
      await writeSync(page, '\x1b[?1000h\x1b[?1006h');

      // test at 0,0
      await mouseDown('left');
      await pollFor(page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mouseup should report
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mousemove should not report
      await mouseMove(50, 10);
      await pollFor(page, () => getReports(encoding), []);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [
        { col: 51, row: 11, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 51, row: 11, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // test at max rows/cols
      await mouseMove(cols - 1, rows - 1);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [
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
      await pollFor(page, () => getReports(encoding), [
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
      // await pollFor(page, () => getReports(encoding), [{col: 44, row: 25, state: {action: 'press', button: 'middle', modifier: {control: false, shift: false, meta: false}}}]);
      // right button
      // bug: default action not cancelled (popup shown)
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await mouseDown('right');
      await mouseMove(44, 24);
      await mouseUp('right');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'right', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: 'right', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // wheel
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await wheelUp();
      await pollFor(page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'up', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);
      await wheelDown();
      await pollFor(page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);

      // modifiers
      // CTRL
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Control');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Control');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: false } } }
      ]);

      // ALT
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Alt');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Alt');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: true } } }
      ]);

      // SHIFT
      // note: press/release caught by selection manager
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Shift');  // defaults to ShiftLeft
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Shift');
      if (noShift) {
        await pollFor(page, () => getReports(encoding), [
          { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
        ]);
      } else {
        await pollFor(page, () => getReports(encoding), [
          { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: true, meta: false } } },
          { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: false, shift: true, meta: false } } },
          { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
        ]);
      }

      // all modifiers
      // bug: Shift not working - selection manager?
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Control');
      await page.keyboard.down('Alt');
      // await page.keyboard.down('Shift');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Control');
      await page.keyboard.up('Alt');
      // await page.keyboard.up('Shift');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: true } } }
      ]);
    });
  });
  describe('DECSET 1002 (xterm with drag)', () => {
    /**
     *  - press and release events
     *  - wheel up/down
     *  - move only on press (drag)
     *  - all modifiers
     * Note: tmux runs this with SGR encoding.
     */
    itMouse('default encoding', async () => {
      const encoding = 'DEFAULT';
      await resetMouseModes();
      await mouseMove(0, 0);
      await writeSync(page, '\x1b[?1002h');

      // test at 0,0
      await mouseDown('left');
      await pollFor(page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mouseup should report, encoding cannot report released button
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mousemove should not report
      await mouseMove(50, 10);
      await pollFor(page, () => getReports(encoding), []);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [
        { col: 51, row: 11, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 51, row: 11, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // test at max rows/cols
      // capped at 223 (1-based)
      await mouseMove(223 - 1, rows - 1);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [
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
      await pollFor(page, () => getReports(encoding), [
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
      // await pollFor(page, () => getReports(encoding), [{col: 44, row: 25, state: {action: 'press', button: 'middle', modifier: {control: false, shift: false, meta: false}}}]);
      // right button
      // bug: default action not cancelled (popup shown)
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await mouseDown('right');
      await mouseMove(44, 24);
      await mouseUp('right');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'right', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'move', button: 'right', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // wheel
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await wheelUp();
      await pollFor(page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'up', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);
      await wheelDown();
      await pollFor(page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);

      // modifiers
      // CTRL
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Control');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Control');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: false } } }
      ]);

      // ALT
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Alt');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Alt');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: true } } }
      ]);

      // SHIFT
      // note: press/release/drag caught by selection manager
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Shift');  // defaults to ShiftLeft
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Shift');
      if (noShift) {
        await pollFor(page, () => getReports(encoding), [
          { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
        ]);
      } else {
        await pollFor(page, () => getReports(encoding), [
          { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: true, meta: false } } },
          { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: false, shift: true, meta: false } } },
          { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: false, shift: true, meta: false } } },
          { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
        ]);
      }

      // all modifiers
      // bug: Shift not working
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Control');
      await page.keyboard.down('Alt');
      // await page.keyboard.down('Shift');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Control');
      await page.keyboard.up('Alt');
      // await page.keyboard.up('Shift');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: true } } }
      ]);
    });
    itMouse('SGR encoding', async () => {
      const encoding = 'SGR';
      await resetMouseModes();
      await mouseMove(0, 0);
      await writeSync(page, '\x1b[?1002h\x1b[?1006h');

      // test at 0,0
      // bug: release is fired immediately
      await mouseDown('left');
      await pollFor(page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mouseup should report, encoding cannot report released button
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mousemove should not report
      await mouseMove(50, 10);
      await pollFor(page, () => getReports(encoding), []);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [
        { col: 51, row: 11, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 51, row: 11, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // test at max rows/cols
      await mouseMove(cols - 1, rows - 1);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [
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
      await pollFor(page, () => getReports(encoding), [
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
      // await pollFor(page, () => getReports(encoding), [{col: 44, row: 25, state: {action: 'press', button: 'middle', modifier: {control: false, shift: false, meta: false}}}]);
      // right button
      // bug: default action not cancelled (popup shown)
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await mouseDown('right');
      await mouseMove(44, 24);
      await mouseUp('right');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'right', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'move', button: 'right', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: 'right', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // wheel
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await wheelUp();
      await pollFor(page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'up', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);
      await wheelDown();
      await pollFor(page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);

      // modifiers
      // CTRL
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Control');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Control');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: false } } }
      ]);

      // ALT
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Alt');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Alt');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: true } } }
      ]);

      // SHIFT
      // note: press/release/drag caught by selection manager
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Shift');  // defaults to ShiftLeft
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Shift');
      if (noShift) {
        await pollFor(page, () => getReports(encoding), [
          { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
        ]);
      } else {
        await pollFor(page, () => getReports(encoding), [
          { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: true, meta: false } } },
          { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: false, shift: true, meta: false } } },
          { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: false, shift: true, meta: false } } },
          { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
        ]);
      }

      // all modifiers
      // bug: this is totally broken with wrong coords and messed up modifiers
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await page.keyboard.down('Control');
      await page.keyboard.down('Alt');
      // await page.keyboard.down('Shift');
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Control');
      await page.keyboard.up('Alt');
      // await page.keyboard.up('Shift');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: true } } }
      ]);
    });
  });
  describe('DECSET 1003 (xterm any event)', () => {
    /**
     *  - all events (press, release, wheel, move)
     *  - all modifiers
     */
    itMouse('default encoding', async () => {
      const encoding = 'DEFAULT';
      await resetMouseModes();
      await mouseMove(0, 0);
      await writeSync(page, '\x1b[?1003h');

      // test at 0,0
      await mouseDown('left');
      await pollFor(page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mouseup should report, encoding cannot report released button
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mousemove should report
      await mouseMove(50, 10);
      await pollFor(page, () => getReports(encoding), [
        { col: 51, row: 11, state: { action: 'move', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [
        { col: 51, row: 11, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 51, row: 11, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // test at max rows/cols
      // capped at 223 (1-based)
      await mouseMove(223 - 1, rows - 1);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [
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
      await pollFor(page, () => getReports(encoding), [
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
      // await pollFor(page, () => getReports(encoding), [{col: 44, row: 25, state: {action: 'press', button: 'middle', modifier: {control: false, shift: false, meta: false}}}]);
      // right button
      // bug: default action not cancelled (popup shown)
      await mouseMove(43, 24);
      await mouseDown('right');
      await mouseMove(44, 24);
      await mouseUp('right');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: false, shift: false, meta: false } } },
        { col: 44, row: 25, state: { action: 'press', button: 'right', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'move', button: 'right', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // wheel
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await wheelUp();
      await pollFor(page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'up', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);
      await wheelDown();
      await pollFor(page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);

      // modifiers
      // CTRL
      await page.keyboard.down('Control');
      await mouseMove(43, 24);
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Control');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: true, shift: false, meta: false } } },
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: false } } }
      ]);

      // ALT
      await page.keyboard.down('Alt');
      await mouseMove(43, 24);
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Alt');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: false, shift: false, meta: true } } },
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: true } } }
      ]);

      // SHIFT
      // note: press/release/drag caught by selection manager
      await page.keyboard.down('Shift');
      await mouseMove(43, 24);
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Shift');
      if (noShift) {
        await pollFor(page, () => getReports(encoding), [
          { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: false, shift: true, meta: false } } },
          { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
        ]);
      } else {
        await pollFor(page, () => getReports(encoding), [
          { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: false, shift: true, meta: false } } },
          { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: true, meta: false } } },
          { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: false, shift: true, meta: false } } },
          { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: false, shift: true, meta: false } } },
          { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
        ]);
      }

      // all modifiers
      // bug: Shift not working
      await page.keyboard.down('Control');
      await page.keyboard.down('Alt');
      // await page.keyboard.down('Shift');
      await mouseMove(43, 24);
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Control');
      await page.keyboard.up('Alt');
      // await page.keyboard.up('Shift');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: true, shift: false, meta: true } } },
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: '<none>', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: true } } }
      ]);
    });
    itMouse('SGR encoding', async () => {
      const encoding = 'SGR';
      await resetMouseModes();
      await mouseMove(0, 0);
      await writeSync(page, '\x1b[?1003h\x1b[?1006h');

      // test at 0,0
      await mouseDown('left');
      await pollFor(page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mouseup should report, encoding cannot report released button
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [
        { col: 1, row: 1, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // mousemove should report
      await mouseMove(50, 10);
      await pollFor(page, () => getReports(encoding), [
        { col: 51, row: 11, state: { action: 'move', button: '<none>', modifier: { control: false, shift: false, meta: false } } }
      ]);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [
        { col: 51, row: 11, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: false } } },
        { col: 51, row: 11, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // test at max rows/cols
      // bug: we are capped at col 95 currently
      // fix: allow values up to 223, any bigger should drop to 0
      await mouseMove(cols - 1, rows - 1);
      await mouseDown('left');
      await mouseUp('left');
      await pollFor(page, () => getReports(encoding), [
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
      await pollFor(page, () => getReports(encoding), [
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
      // await pollFor(page, () => getReports(encoding), [{col: 44, row: 25, state: {action: 'press', button: 'middle', modifier: {control: false, shift: false, meta: false}}}]);
      // right button
      // bug: default action not cancelled (popup shown)
      await mouseMove(43, 24);
      await mouseDown('right');
      await mouseMove(44, 24);
      await mouseUp('right');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: false, shift: false, meta: false } } },
        { col: 44, row: 25, state: { action: 'press', button: 'right', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'move', button: 'right', modifier: { control: false, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: 'right', modifier: { control: false, shift: false, meta: false } } }
      ]);

      // wheel
      await mouseMove(43, 24);
      await getReports(encoding); // clear reports
      await wheelUp();
      await pollFor(page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'up', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);
      await wheelDown();
      await pollFor(page, () => getReports(encoding), [{ col: 44, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: false } } }]);

      // modifiers
      // CTRL
      await page.keyboard.down('Control');
      await mouseMove(43, 24);
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Control');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: true, shift: false, meta: false } } },
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: true, shift: false, meta: false } } },
        { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: false } } }
      ]);

      // ALT
      await page.keyboard.down('Alt');
      await mouseMove(43, 24);
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Alt');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: false, shift: false, meta: true } } },
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: false, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: false, meta: true } } }
      ]);

      // SHIFT
      // note: press/release/drag caught by selection manager
      await page.keyboard.down('Shift');
      await mouseMove(43, 24);
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Shift');
      if (noShift) {
        await pollFor(page, () => getReports(encoding), [
          { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: false, shift: true, meta: false } } },
          { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
        ]);
      } else {
        await pollFor(page, () => getReports(encoding), [
          { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: false, shift: true, meta: false } } },
          { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: false, shift: true, meta: false } } },
          { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: false, shift: true, meta: false } } },
          { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: false, shift: true, meta: false } } },
          { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: false, shift: true, meta: false } } }
        ]);
      }

      // all modifiers
      // bug: Shift not working
      await page.keyboard.down('Control');
      await page.keyboard.down('Alt');
      // await page.keyboard.down('Shift');
      await mouseMove(43, 24);
      await mouseDown('left');
      await mouseMove(44, 24);
      await mouseUp('left');
      await wheelDown();
      await page.keyboard.up('Control');
      await page.keyboard.up('Alt');
      // await page.keyboard.up('Shift');
      await pollFor(page, () => getReports(encoding), [
        { col: 44, row: 25, state: { action: 'move', button: '<none>', modifier: { control: true, shift: false, meta: true } } },
        { col: 44, row: 25, state: { action: 'press', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'move', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'release', button: 'left', modifier: { control: true, shift: false, meta: true } } },
        { col: 45, row: 25, state: { action: 'down', button: 'wheel', modifier: { control: true, shift: false, meta: true } } }
      ]);
    });
  });
  /**
   * move tests with multiple buttons pressed:
   * currently not possible due to a limitation of the playwright mouse interface
   * (saves only the last one pressed)
   */
});
