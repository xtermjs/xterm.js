/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { pollFor, openTerminal, getBrowserType, launchBrowser, writeSync } from './TestUtils';
import { Browser, Page } from 'playwright';
import { IRenderDimensions } from 'browser/renderer/shared/Types';

const APP = 'http://127.0.0.1:3001/test';

let browser: Browser;
let page: Page;
const width = 800;
const height = 600;

let isChromium = false;

describe('InputHandler Integration Tests', function(): void {
  before(async function(): Promise<any> {
    const browserType = getBrowserType();
    isChromium = browserType.name() === 'chromium';
    browser = await launchBrowser();
    page = await (await browser.newContext()).newPage();
    await page.setViewportSize({ width, height });
    await page.goto(APP);
    await openTerminal(page);
  });

  after(() => {
    browser.close();
  });

  describe('CSI', () => {
    beforeEach(async () => {
      await page.evaluate(`window.term.reset()`);
    });

    it('ICH: Insert Ps (Blank) Character(s) (default = 1) - CSI Ps @', async function(): Promise<any> {
      await page.evaluate(`
        // Default
        window.term.write('foo\\x1b[3D\\x1b[@\\n\\r')
        // Explicit
        window.term.write('bar\\x1b[3D\\x1b[4@')
      `);
      await pollFor(page, () => getLinesAsArray(2), [' foo', '    bar']);
    });

    it('CUU: Cursor Up Ps Times (default = 1) - CSI Ps A', async function(): Promise<any> {
      await page.evaluate(`
        // Default
        window.term.write('\\n\\n\\n\\n\x1b[Aa')
        // Explicit
        window.term.write('\x1b[2Ab')
      `);
      await pollFor(page, () => getLinesAsArray(4), ['', ' b', '', 'a']);
    });

    it('CUD: Cursor Down Ps Times (default = 1) - CSI Ps B', async function(): Promise<any> {
      await page.evaluate(`
        // Default
        window.term.write('\x1b[Ba')
        // Explicit
        window.term.write('\x1b[2Bb')
      `);
      await pollFor(page, () => getLinesAsArray(4), ['', 'a', '', ' b']);
    });

    it('CUF: Cursor Forward Ps Times (default = 1) - CSI Ps C', async function(): Promise<any> {
      await page.evaluate(`
        // Default
        window.term.write('\x1b[Ca')
        // Explicit
        window.term.write('\x1b[2Cb')
      `);
      await pollFor(page, () => getLinesAsArray(1), [' a  b']);
    });

    it('CUB: Cursor Backward Ps Times (default = 1) - CSI Ps D', async function(): Promise<any> {
      await page.evaluate(`
        // Default
        window.term.write('foo\x1b[Da')
        // Explicit
        window.term.write('\x1b[2Db')
      `);
      await pollFor(page, () => getLinesAsArray(1), ['fba']);
    });

    it('CNL: Cursor Next Line Ps Times (default = 1) - CSI Ps E', async function(): Promise<any> {
      await page.evaluate(`
        // Default
        window.term.write('\x1b[Ea')
        // Explicit
        window.term.write('\x1b[2Eb')
      `);
      await pollFor(page, () => getLinesAsArray(4), ['', 'a', '', 'b']);
    });

    it('CPL: Cursor Preceding Line Ps Times (default = 1) - CSI Ps F', async function(): Promise<any> {
      await page.evaluate(`
        // Default
        window.term.write('\\n\\n\\n\\n\x1b[Fa')
        // Explicit
        window.term.write('\x1b[2Fb')
      `);
      await pollFor(page, () => getLinesAsArray(5), ['', 'b', '', 'a', '']);
    });

    it('CHA: Cursor Character Absolute [column] (default = [row,1]) - CSI Ps G', async function(): Promise<any> {
      await page.evaluate(`
        // Default
        window.term.write('foo\x1b[Ga')
        // Explicit
        window.term.write('\x1b[10Gb')
      `);
      await pollFor(page, () => getLinesAsArray(1), ['aoo      b']);
    });

    it('CUP: Cursor Position [row;column] (default = [1,1]) - CSI Ps ; Ps H', async function(): Promise<any> {
      await page.evaluate(`
        // Default
        window.term.write('foo\x1b[Ha')
        // Explicit
        window.term.write('\x1b[3;3Hb')
      `);
      await pollFor(page, () => getLinesAsArray(3), ['aoo', '', '  b']);
    });

    it('CHT: Cursor Forward Tabulation Ps tab stops (default = 1) - CSI Ps I', async function(): Promise<any> {
      await page.evaluate(`
        // Default
        window.term.write('\x1b[Ia')
        // Explicit
        window.term.write('\\n\\r\x1b[2Ib')
      `);
      await pollFor(page, () => getLinesAsArray(2), ['        a', '                b']);
    });

    it('ED: Erase in Display, VT100 - CSI Ps J', async function(): Promise<any> {
      const fixture = 'abc\\n\\rdef\\n\\rghi\x1b[2;2H';
      await page.evaluate(`
        // Default: Erase Below
        window.term.resize(5, 5);
        window.term.write('${fixture}\x1b[J')
      `);
      await pollFor(page, () => getLinesAsArray(3), ['abc', 'd', '']);
      await page.evaluate(`
        // 0: Erase Below
        window.term.reset()
        window.term.write('${fixture}\x1b[0J')
      `);
      await pollFor(page, () => getLinesAsArray(3), ['abc', 'd', '']);
      await page.evaluate(`
        // 1: Erase Above
        window.term.reset()
        window.term.write('${fixture}\x1b[1J')
      `);
      await pollFor(page, () => getLinesAsArray(3), ['', '  f', 'ghi']);
      await page.evaluate(`
        // 2: Erase Saved Lines (scrollback)
        window.term.reset()
        window.term.write('1\\n2\\n3\\n4\\n5${fixture}\x1b[3J')
      `);
      await pollFor(page, () => page.evaluate(`window.term.buffer.active.length`), 5);
      await pollFor(page, () => getLinesAsArray(5), ['   4', '    5', 'abc', 'def', 'ghi']);
    });

    it('DECSED: Erase in Display, VT220 - CSI ? Ps J', async function(): Promise<any> {
      const fixture = 'abc\\n\\rdef\\n\\rghi\x1b[2;2H';
      await page.evaluate(`
        // Default: Erase Below
        window.term.resize(5, 5);
        window.term.write('${fixture}\x1b[?J')
      `);
      await pollFor(page, () => getLinesAsArray(3), ['abc', 'd', '']);
      await page.evaluate(`
        // 0: Erase Below
        window.term.reset()
        window.term.write('${fixture}\x1b[?0J')
      `);
      await pollFor(page, () => getLinesAsArray(3), ['abc', 'd', '']);
      await page.evaluate(`
        // 1: Erase Above
        window.term.reset()
        window.term.write('${fixture}\x1b[?1J')
      `);
      await pollFor(page, () => getLinesAsArray(3), ['', '  f', 'ghi']);
      await page.evaluate(`
        // 2: Erase Saved Lines (scrollback)
        window.term.reset()
        window.term.write('1\\n2\\n3\\n4\\n5${fixture}\x1b[?3J')
      `);
      await pollFor(page, () => page.evaluate(`window.term.buffer.active.length`), 5);
      await pollFor(page, () => getLinesAsArray(5), ['   4', '    5', 'abc', 'def', 'ghi']);
    });

    it('IL: Insert Ps Line(s) (default = 1) - CSI Ps L', async function(): Promise<any> {
      await page.evaluate(`
        // Default
        window.term.write('foo\x1b[La')
        // Explicit
        window.term.write('\x1b[2Lb')
      `);
      await pollFor(page, () => getLinesAsArray(4), ['b', '', 'a', 'foo']);
    });

    it('DL: Delete Ps Line(s) (default = 1) - CSI Ps M', async function(): Promise<any> {
      await page.evaluate(`
        // Default
        window.term.write('a\\nb\x1b[1F\x1b[M')
        // Explicit
        window.term.write('\x1b[1Ed\\ne\\nf\x1b[2F\x1b[2M')
      `);
      await pollFor(page, () => getLinesAsArray(5), [' b', '  f', '', '', '']);
    });

    it('DCH: Delete Ps Character(s) (default = 1) - CSI Ps P', async function(): Promise<any> {
      await page.evaluate(`
        // Default
        window.term.write('abc\x1b[1;1H\x1b[P')
        // Explicit
        window.term.write('\\n\\rdef\x1b[2;1H\x1b[2P')
      `);
      await pollFor(page, () => getLinesAsArray(2), ['bc', 'f']);
    });

    describe('DSR: Device Status Report', () => {
      it('Status Report - CSI 5 n', async function(): Promise<any> {
        await page.evaluate(`
          window.term.onData(e => window.result = e);
          window.term.write('\\x1b[5n');
        `);
        await pollFor(page, () => page.evaluate(`window.result`), '\x1b[0n');
      });

      it('Report Cursor Position (CPR) - CSI 6 n', async function(): Promise<any> {
        await page.evaluate(`window.term.write('\\n\\nfoo')`);
        await pollFor(page, () => page.evaluate(`
          [window.term.buffer.active.cursorY, window.term.buffer.active.cursorX]
        `), [2, 3]);
        await page.evaluate(`
          window.term.onData(e => window.result = e);
          window.term.write('\\x1b[6n');
        `);
        await pollFor(page, () => page.evaluate(`window.result`), '\x1b[3;4R');
      });

      it('Report Cursor Position (DECXCPR) - CSI ? 6 n', async function(): Promise<any> {
        await page.evaluate(`window.term.write('\\n\\nfoo')`);
        await pollFor(page, () => page.evaluate(`
          [window.term.buffer.active.cursorY, window.term.buffer.active.cursorX]
        `), [2, 3]);
        await page.evaluate(`
          window.term.onData(e => window.result = e);
          window.term.write('\\x1b[?6n');
        `);
        await pollFor(page, () => page.evaluate(`window.result`), '\x1b[?3;4R');
      });
    });

    describe('SM: Set Mode', () => {
      describe('CSI ? Pm h', () => {
        it('Pm = 1003, Set Use All Motion (any event) Mouse Tracking', async () => {
          const coords: { left: number, top: number, bottom: number, right: number } = await page.evaluate(`
            (function() {
              const rect = window.term.element.getBoundingClientRect();
              return { left: rect.left, top: rect.top, bottom: rect.bottom, right: rect.right };
            })();
          `);
          // Click and drag and ensure there is a selection
          await page.mouse.click((coords.left + coords.right) / 2, (coords.top + coords.bottom) / 2);
          await page.mouse.down();
          await page.mouse.move((coords.left + coords.right) / 2, (coords.top + coords.bottom) / 4);
          assert.ok(await page.evaluate(`window.term.getSelection().length`) as number > 0, 'mouse events are off so there should be a selection');
          await page.mouse.up();
          // Clear selection
          await page.mouse.click((coords.left + coords.right) / 2, (coords.top + coords.bottom) / 2);
          await pollFor(page, () => page.evaluate(`window.term.getSelection().length`), 0);
          // Enable mouse events
          await page.evaluate(`window.term.write('\x1b[?1003h')`);
          // Click and drag and ensure there is no selection
          await page.mouse.click((coords.left + coords.right) / 2, (coords.top + coords.bottom) / 2);
          await page.mouse.down();
          await page.mouse.move((coords.left + coords.right) / 2, (coords.top + coords.bottom) / 4);
          // mouse events are on so there should be no selection
          await pollFor(page, () => page.evaluate(`window.term.getSelection().length`), 0);
          await page.mouse.up();
        });
        (isChromium ? it : it.skip)('Pm = 2004, Set bracketed paste mode', async function(): Promise<any> {
          await pollFor(page, () => simulatePaste('foo'), 'foo');
          await page.evaluate(`window.term.write('\x1b[?2004h')`);
          await pollFor(page, () => simulatePaste('bar'), '\x1b[200~bar\x1b[201~');
          await page.evaluate(`window.term.write('\x1b[?2004l')`);
          await pollFor(page, () => simulatePaste('baz'), 'baz');
        });
      });
    });

    it('REP: Repeat preceding character, ECMA48 - CSI Ps b', async function(): Promise<any> {
      // default to 1
      await page.evaluate(`
          window.term.resize(10, 10);
          window.term.write('#\x1b[b');
          window.term.writeln('');
          window.term.write('#\x1b[0b');
          window.term.writeln('');
          window.term.write('#\x1b[1b');
          window.term.writeln('');
          window.term.write('#\x1b[5b');
          `);
      await pollFor(page, () => getLinesAsArray(4), ['##', '##', '##', '######']);
      await pollFor(page, () => getCursor(), { col: 6, row: 3 });
      // should not repeat on fullwidth chars
      await page.evaluate(`
          window.term.reset();
          window.term.write('￥\x1b[10b');
          `);
      await pollFor(page, () => getLinesAsArray(1), ['￥']);
      // should repeat only base char of combining
      await page.evaluate(`
          window.term.reset();
          window.term.write('e\u0301\x1b[5b');
          `);
      await pollFor(page, () => getLinesAsArray(1), ['e\u0301eeeee']);
      // should wrap correctly
      await page.evaluate(`
          window.term.reset();
          window.term.write('#\x1b[15b');
          `);
      await pollFor(page, () => getLinesAsArray(2), ['##########', '######']);
      await page.evaluate(`
          window.term.reset();
          window.term.write('\x1b[?7l');  // disable wrap around
          window.term.write('#\x1b[15b');
          `);
      await pollFor(page, () => getLinesAsArray(2), ['##########', '']);
      // any successful sequence should reset REP
      await page.evaluate(`
          window.term.reset();
          window.term.write('\x1b[?7h');  // re-enable wrap around
          window.term.write('#\\n\x1b[3b');
          window.term.write('#\\r\x1b[3b');
          window.term.writeln('');
          window.term.write('abcdefg\x1b[3D\x1b[10b#\x1b[3b');
          `);
      await pollFor(page, () => getLinesAsArray(3), ['#', ' #', 'abcd####']);
    });

    describe('Window Options - CSI Ps ; Ps ; Ps t', () => {
      it('should be disabled by default', async function(): Promise<any> {
        await page.evaluate(`(() => {
            window._stack = [];
            const _h = window.term.onData(data => window._stack.push(data));
            window.term.write('\x1b[14t');
            window.term.write('\x1b[16t');
            window.term.write('\x1b[18t');
            window.term.write('\x1b[20t');
            window.term.write('\x1b[21t');
            return new Promise((r) => window.term.write('', () => { _h.dispose(); r(); }));
          })()`);
        await pollFor(page, async () => await page.evaluate(`(() => _stack)()`), []);
      });
      it('14 - GetWinSizePixels', async function(): Promise<any> {
        await page.evaluate(`window.term.options.windowOptions = { getWinSizePixels: true }; `);
        await page.evaluate(`(() => {
            window._stack = [];
            const _h = window.term.onData(data => window._stack.push(data));
            window.term.write('\x1b[14t');
            return new Promise((r) => window.term.write('', () => { _h.dispose(); r(); }));
          })()`);
        const d = await getDimensions();
        await pollFor(page, async () => await page.evaluate(`(() => _stack)()`), [`\x1b[4;${d.height};${d.width}t`]);
      });
      it('16 - GetCellSizePixels', async function(): Promise<any> {
        await page.evaluate(`window.term.options.windowOptions = { getCellSizePixels: true }; `);
        await page.evaluate(`(() => {
            window._stack = [];
            const _h = window.term.onData(data => window._stack.push(data));
            window.term.write('\x1b[16t');
            return new Promise((r) => window.term.write('', () => { _h.dispose(); r(); }));
          })()`);
        const d = await getDimensions();
        await pollFor(page, async () => await page.evaluate(`(() => _stack)()`), [`\x1b[6;${d.cellHeight};${d.cellWidth}t`]);
      });
    });
  });

  describe('OSC', () => {
    describe('OSC 4', () => {
      before(async () => {
        await page.evaluate('(() => {window._recordedData = []; window._h = term.onData(d => window._recordedData.push(d));})()');
      });
      after(async () => {
        await page.evaluate('window._h.dispose()');
      });
      beforeEach(async () => {
        await page.evaluate('window._recordedData.length = 0;');
      });
      it('query single color', async () => {
        await writeSync(page, '\x1b]4;0;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), ['\x1b]4;0;rgb:2e2e/3434/3636\x1b\\']);
        await writeSync(page, '\x1b]4;77;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), ['\x1b]4;0;rgb:2e2e/3434/3636\x1b\\', '\x1b]4;77;rgb:5f5f/d7d7/5f5f\x1b\\']);
      });
      it('query multiple colors', async () => {
        await writeSync(page, '\x1b]4;0;?;77;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), ['\x1b]4;0;rgb:2e2e/3434/3636\x1b\\', '\x1b]4;77;rgb:5f5f/d7d7/5f5f\x1b\\']);
      });
      it('set & query single color', async () => {
        await writeSync(page, '\x1b]4;0;?\x07');
        const restore: string[] = await page.evaluate('window._recordedData');
        assert.deepEqual(await page.evaluate('window._recordedData'), restore);
        // set new color & query
        await writeSync(page, '\x1b]4;0;rgb:01/02/03\x07\x1b]4;0;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), [restore[0], '\x1b]4;0;rgb:0101/0202/0303\x1b\\']);
        // restore should set old color
        await writeSync(page, restore[0] + '\x1b]4;0;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), [restore[0], '\x1b]4;0;rgb:0101/0202/0303\x1b\\', restore[0]]);
      });
      it('query & set colors mixed', async () => {
        await writeSync(page, '\x1b]4;0;?;77;?\x07');
        const restore: string[] = await page.evaluate('window._recordedData');
        await page.evaluate('window._recordedData.length = 0;');
        // mixed call - change 0, query 43, change 77
        await writeSync(page, '\x1b]4;0;rgb:01/02/03;43;?;77;#aabbcc\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), ['\x1b]4;43;rgb:0000/d7d7/afaf\x1b\\']);
        await page.evaluate('window._recordedData.length = 0;');
        // query new values for 0 + 77
        await writeSync(page, '\x1b]4;0;?;77;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), ['\x1b]4;0;rgb:0101/0202/0303\x1b\\', '\x1b]4;77;rgb:aaaa/bbbb/cccc\x1b\\']);
        await page.evaluate('window._recordedData.length = 0;');
        // restore old values for 0 + 77
        await writeSync(page, restore[0] + restore[1] + '\x1b]4;0;?;77;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), restore);
      });
    });
    describe('OSC 4 & 104', () => {
      before(async () => {
        await page.evaluate('(() => {window._recordedData = []; window._h = term.onData(d => window._recordedData.push(d));})()');
      });
      after(async () => {
        await page.evaluate('window._h.dispose()');
      });
      beforeEach(async () => {
        await page.evaluate('window._recordedData.length = 0;');
      });
      it('change & restore single color', async () => {
        // test for some random color slots
        for (const i of [0, 43, 77, 255]) {
          await writeSync(page, `\x1b]4;${i};?\x07`);
          const restore: string[] = await page.evaluate('window._recordedData');
          await writeSync(page, `\x1b]4;${i};rgb:01/02/03\x07\x1b]4;${i};?\x07`);
          assert.deepEqual(await page.evaluate('window._recordedData'), [restore[0], `\x1b]4;${i};rgb:0101/0202/0303\x1b\\`]);
          // restore slot color
          await writeSync(page, `\x1b]104;${i}\x07\x1b]4;${i};?\x07`);
          assert.deepEqual(await page.evaluate('window._recordedData'), [restore[0], `\x1b]4;${i};rgb:0101/0202/0303\x1b\\`, restore[0]]);
          await page.evaluate('window._recordedData.length = 0;');
        }
      });
      it('restore multiple at once', async () => {
        // change 3 random slots
        await writeSync(page, `\x1b]4;0;?;43;?;77;?\x07`);
        const restore: string[] = await page.evaluate('window._recordedData');
        await page.evaluate('window._recordedData.length = 0;');
        await writeSync(page, `\x1b]4;0;rgb:01/02/03;43;#aabbcc;77;#123456\x07`);
        // restore specific slots
        await writeSync(page, `\x1b]104;0;43;77\x07` + `\x1b]4;0;?;43;?;77;?\x07`);
        assert.deepEqual(await page.evaluate('window._recordedData'), restore);
      });
      it('restore full table', async () => {
        // change 3 random slots
        await writeSync(page, `\x1b]4;0;?;43;?;77;?\x07`);
        const restore: string[] = await page.evaluate('window._recordedData');
        await page.evaluate('window._recordedData.length = 0;');
        await writeSync(page, `\x1b]4;0;rgb:01/02/03;43;#aabbcc;77;#123456\x07`);
        // restore all
        await writeSync(page, `\x1b]104\x07` + `\x1b]4;0;?;43;?;77;?\x07`);
        assert.deepEqual(await page.evaluate('window._recordedData'), restore);
      });
    });
    describe('OSC 10 & 11 + 110 | 111 | 112', () => {
      before(async () => {
        await page.evaluate('(() => {window._recordedData = []; window._h = term.onData(d => window._recordedData.push(d));})()');
      });
      after(async () => {
        await page.evaluate('window._h.dispose()');
      });
      beforeEach(async () => {
        await page.evaluate('window._recordedData.length = 0;');
      });
      it('query FG color', async () => {
        await writeSync(page, '\x1b]10;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), ['\x1b]10;rgb:ffff/ffff/ffff\x1b\\']);
      });
      it('query BG color', async () => {
        await writeSync(page, '\x1b]11;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), ['\x1b]11;rgb:0000/0000/0000\x1b\\']);
      });
      it('query FG & BG color in one call', async () => {
        await writeSync(page, '\x1b]10;?;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), ['\x1b]10;rgb:ffff/ffff/ffff\x1b\\', '\x1b]11;rgb:0000/0000/0000\x1b\\']);
      });
      it('set & query FG', async () => {
        await writeSync(page, '\x1b]10;rgb:1/2/3\x07\x1b]10;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), ['\x1b]10;rgb:1111/2222/3333\x1b\\']);
        await writeSync(page, '\x1b]10;#ffffff\x07\x1b]10;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), ['\x1b]10;rgb:1111/2222/3333\x1b\\', '\x1b]10;rgb:ffff/ffff/ffff\x1b\\']);
      });
      it('set & query BG', async () => {
        await writeSync(page, '\x1b]11;rgb:1/2/3\x07\x1b]11;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), ['\x1b]11;rgb:1111/2222/3333\x1b\\']);
        await writeSync(page, '\x1b]11;#000000\x07\x1b]11;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), ['\x1b]11;rgb:1111/2222/3333\x1b\\', '\x1b]11;rgb:0000/0000/0000\x1b\\']);
      });
      it('set & query cursor color', async () => {
        await writeSync(page, '\x1b]12;rgb:1/2/3\x07\x1b]12;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), ['\x1b]12;rgb:1111/2222/3333\x1b\\']);
        await writeSync(page, '\x1b]12;#ffffff\x07\x1b]12;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), ['\x1b]12;rgb:1111/2222/3333\x1b\\', '\x1b]12;rgb:ffff/ffff/ffff\x1b\\']);
      });
      it('set & query FG & BG color in one call', async () => {
        await writeSync(page, '\x1b]10;#123456;rgb:aa/bb/cc\x07\x1b]10;?;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), ['\x1b]10;rgb:1212/3434/5656\x1b\\', '\x1b]11;rgb:aaaa/bbbb/cccc\x1b\\']);
        await writeSync(page, '\x1b]10;#ffffff;#000000\x07');
      });
      it('OSC 110: restore FG color', async () => {
        await writeSync(page, '\x1b]10;rgb:1/2/3\x07\x1b]10;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), ['\x1b]10;rgb:1111/2222/3333\x1b\\']);
        await page.evaluate('window._recordedData.length = 0;');
        // restore
        await writeSync(page, '\x1b]110\x07\x1b]10;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), ['\x1b]10;rgb:ffff/ffff/ffff\x1b\\']);
      });
      it('OSC 111: restore BG color', async () => {
        await writeSync(page, '\x1b]11;rgb:1/2/3\x07\x1b]11;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), ['\x1b]11;rgb:1111/2222/3333\x1b\\']);
        await page.evaluate('window._recordedData.length = 0;');
        // restore
        await writeSync(page, '\x1b]111\x07\x1b]11;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), ['\x1b]11;rgb:0000/0000/0000\x1b\\']);
      });
      it('OSC 112: restore cursor color', async () => {
        await writeSync(page, '\x1b]12;rgb:1/2/3\x07\x1b]12;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), ['\x1b]12;rgb:1111/2222/3333\x1b\\']);
        await page.evaluate('window._recordedData.length = 0;');
        // restore
        await writeSync(page, '\x1b]112\x07\x1b]12;?\x07');
        assert.deepEqual(await page.evaluate('window._recordedData'), ['\x1b]12;rgb:ffff/ffff/ffff\x1b\\']);
      });
    });
  });

  describe('ESC', () => {
    describe('DECRC: Save cursor, ESC 7', () => {
      it('should save the absolute cursor position so resizing restores to the correct position', async () => {
        await page.evaluate(`
          window.term.resize(10, 2);
          window.term.write('1\\n\\r2\\n\\r3\\n\\r4\\n\\r5');
          window.term.write('\\x1b7\\x1b[?47h');
          `);
        await page.evaluate(`
          window.term.resize(10, 4);
          window.term.write('\\x1b[?47l\\x1b8');
          `);
        await pollFor(page, () => getCursor(), { col: 1, row: 3 });
      });
    });
  });
});

async function getLinesAsArray(count: number, start: number = 0): Promise<string[]> {
  let text = '';
  for (let i = start; i < start + count; i++) {
    text += `window.term.buffer.active.getLine(${i}).translateToString(true),`;
  }
  return await page.evaluate(`[${text}]`);
}

async function simulatePaste(text: string): Promise<string> {
  const id = Math.floor(Math.random() * 1000000);
  await page.evaluate(`
            (function() {
              window.term.onData(e => window.result_${id} = e);
              const clipboardData = new DataTransfer();
              clipboardData.setData('text/plain', '${text}');
              window.term.textarea.dispatchEvent(new ClipboardEvent('paste', { clipboardData }));
            })();
          `);
  return await page.evaluate(`window.result_${id} `);
}

async function getCursor(): Promise<{ col: number, row: number }> {
  return page.evaluate(`
  (function() {
    return {col: term.buffer.active.cursorX, row: term.buffer.active.cursorY};
  })();
  `);
}

async function getDimensions(): Promise<any> {
  const dim: IRenderDimensions = await page.evaluate(`term._core._renderService.dimensions`);
  return {
    cellWidth: dim.css.cell.width.toFixed(0),
    cellHeight: dim.css.cell.height.toFixed(0),
    width: dim.css.canvas.width.toFixed(0),
    height: dim.css.canvas.height.toFixed(0)
  };
}
