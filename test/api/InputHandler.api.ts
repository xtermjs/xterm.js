/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as puppeteer from 'puppeteer';
import { assert } from 'chai';
import { ITerminalOptions } from 'xterm';

const APP = 'http://127.0.0.1:3000/test';

let browser: puppeteer.Browser;
let page: puppeteer.Page;
const width = 800;
const height = 600;

describe('InputHandler Integration Tests', function(): void {
  this.timeout(20000);

  before(async function(): Promise<any> {
    browser = await puppeteer.launch({
      headless: process.argv.indexOf('--headless') !== -1,
      slowMo: 80,
      args: [`--window-size=${width},${height}`]
    });
    page = (await browser.pages())[0];
    await page.setViewport({ width, height });
    await page.goto(APP);
    await openTerminal();
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
      assert.deepEqual(await getLinesAsArray(2), [' foo', '    bar']);
    });

    it('CUU: Cursor Up Ps Times (default = 1) - CSI Ps A', async function(): Promise<any> {
      await page.evaluate(`
        // Default
        window.term.write('\\n\\n\\n\\n\x1b[Aa')
        // Explicit
        window.term.write('\x1b[2Ab')
      `);
      assert.deepEqual(await getLinesAsArray(4), ['', ' b', '', 'a']);
    });

    it('CUD: Cursor Down Ps Times (default = 1) - CSI Ps B', async function(): Promise<any> {
      await page.evaluate(`
        // Default
        window.term.write('\x1b[Ba')
        // Explicit
        window.term.write('\x1b[2Bb')
      `);
      assert.deepEqual(await getLinesAsArray(4), ['', 'a', '', ' b']);
    });

    it('CUF: Cursor Forward Ps Times (default = 1) - CSI Ps C', async function(): Promise<any> {
      await page.evaluate(`
        // Default
        window.term.write('\x1b[Ca')
        // Explicit
        window.term.write('\x1b[2Cb')
      `);
      assert.deepEqual(await getLinesAsArray(1), [' a  b']);
    });

    it('CUB: Cursor Backward Ps Times (default = 1) - CSI Ps D', async function(): Promise<any> {
      await page.evaluate(`
        // Default
        window.term.write('foo\x1b[Da')
        // Explicit
        window.term.write('\x1b[2Db')
      `);
      assert.deepEqual(await getLinesAsArray(1), ['fba']);
    });

    it('CNL: Cursor Next Line Ps Times (default = 1) - CSI Ps E', async function(): Promise<any> {
      await page.evaluate(`
        // Default
        window.term.write('\x1b[Ea')
        // Explicit
        window.term.write('\x1b[2Eb')
      `);
      assert.deepEqual(await getLinesAsArray(4), ['', 'a', '', 'b']);
    });

    it('CPL: Cursor Preceding Line Ps Times (default = 1) - CSI Ps F', async function(): Promise<any> {
      await page.evaluate(`
        // Default
        window.term.write('\\n\\n\\n\\n\x1b[Fa')
        // Explicit
        window.term.write('\x1b[2Fb')
      `);
      assert.deepEqual(await getLinesAsArray(5), ['', 'b', '', 'a', '']);
    });

    it('CHA: Cursor Character Absolute [column] (default = [row,1]) - CSI Ps G', async function(): Promise<any> {
      await page.evaluate(`
        // Default
        window.term.write('foo\x1b[Ga')
        // Explicit
        window.term.write('\x1b[10Gb')
      `);
      assert.deepEqual(await getLinesAsArray(1), ['aoo      b']);
    });

    it('CUP: Cursor Position [row;column] (default = [1,1]) - CSI Ps ; Ps H', async function(): Promise<any> {
      await page.evaluate(`
        // Default
        window.term.write('foo\x1b[Ha')
        // Explicit
        window.term.write('\x1b[3;3Hb')
      `);
      assert.deepEqual(await getLinesAsArray(3), ['aoo', '', '  b']);
    });

    it('CHT: Cursor Forward Tabulation Ps tab stops (default = 1) - CSI Ps I', async function(): Promise<any> {
      await page.evaluate(`
        // Default
        window.term.write('\x1b[Ia')
        // Explicit
        window.term.write('\\n\\r\x1b[2Ib')
      `);
      assert.deepEqual(await getLinesAsArray(2), ['        a', '                b']);
    });

    it('ED: Erase in Display, VT100 - CSI Ps J', async function(): Promise<any> {
      const fixture = 'abc\\n\\rdef\\n\\rghi\x1b[2;2H';
      await page.evaluate(`
        // Default: Erase Below
        window.term.resize(5, 5);
        window.term.write('${fixture}\x1b[J')
      `);
      assert.deepEqual(await getLinesAsArray(3), ['abc', 'd', '']);
      await page.evaluate(`
        // 0: Erase Below
        window.term.reset()
        window.term.write('${fixture}\x1b[0J')
      `);
      assert.deepEqual(await getLinesAsArray(3), ['abc', 'd', '']);
      await page.evaluate(`
        // 1: Erase Above
        window.term.reset()
        window.term.write('${fixture}\x1b[1J')
      `);
      assert.deepEqual(await getLinesAsArray(3), ['', '  f', 'ghi']);
      await page.evaluate(`
        // 2: Erase Saved Lines (scrollback)
        window.term.reset()
        window.term.write('1\\n2\\n3\\n4\\n5${fixture}\x1b[3J')
      `);
      assert.equal(await page.evaluate(`window.term.buffer.length`), 5);
      assert.deepEqual(await getLinesAsArray(5), ['   4', '    5', 'abc', 'def', 'ghi']);
    });

    it('DECSED: Erase in Display, VT220 - CSI ? Ps J', async function(): Promise<any> {
      const fixture = 'abc\\n\\rdef\\n\\rghi\x1b[2;2H';
      await page.evaluate(`
        // Default: Erase Below
        window.term.resize(5, 5);
        window.term.write('${fixture}\x1b[?J')
      `);
      assert.deepEqual(await getLinesAsArray(3), ['abc', 'd', '']);
      await page.evaluate(`
        // 0: Erase Below
        window.term.reset()
        window.term.write('${fixture}\x1b[?0J')
      `);
      assert.deepEqual(await getLinesAsArray(3), ['abc', 'd', '']);
      await page.evaluate(`
        // 1: Erase Above
        window.term.reset()
        window.term.write('${fixture}\x1b[?1J')
      `);
      assert.deepEqual(await getLinesAsArray(3), ['', '  f', 'ghi']);
      await page.evaluate(`
        // 2: Erase Saved Lines (scrollback)
        window.term.reset()
        window.term.write('1\\n2\\n3\\n4\\n5${fixture}\x1b[?3J')
      `);
      assert.equal(await page.evaluate(`window.term.buffer.length`), 5);
      assert.deepEqual(await getLinesAsArray(5), ['   4', '    5', 'abc', 'def', 'ghi']);
    });

    describe('DSR: Device Status Report', () => {
      it('Status Report - CSI 5 n', async function(): Promise<any> {
        await page.evaluate(`
          window.term.onData(e => window.result = e);
          window.term.write('\\x1b[5n');
        `);
        assert.equal(await page.evaluate(`window.result`), '\x1b[0n');
      });

      it('Report Cursor Position (CPR) - CSI 6 n', async function(): Promise<any> {
        await page.evaluate(`window.term.write('\\n\\nfoo')`);
        assert.deepEqual(await page.evaluate(`
          [window.term.buffer.cursorY, window.term.buffer.cursorX]
        `), [2, 3]);
        await page.evaluate(`
          window.term.onData(e => window.result = e);
          window.term.write('\\x1b[6n');
        `);
        assert.equal(await page.evaluate(`window.result`), '\x1b[3;4R');
      });

      it('Report Cursor Position (DECXCPR) - CSI ? 6 n', async function(): Promise<any> {
        await page.evaluate(`window.term.write('\\n\\nfoo')`);
        assert.deepEqual(await page.evaluate(`
          [window.term.buffer.cursorY, window.term.buffer.cursorX]
        `), [2, 3]);
        await page.evaluate(`
          window.term.onData(e => window.result = e);
          window.term.write('\\x1b[?6n');
        `);
        assert.equal(await page.evaluate(`window.result`), '\x1b[?3;4R');
      });
    });

    describe('SM: Set Mode', () => {
      describe('CSI ? Pm h', () => {
        it('Pm = 2004, Set bracketed paste mode', async function(): Promise<any> {
          assert.equal(await simulatePaste('foo'), 'foo');
          await page.evaluate(`window.term.write('\x1b[?2004h')`);
          assert.equal(await simulatePaste('bar'), '\x1b[200~bar\x1b[201~');
          await page.evaluate(`window.term.write('\x1b[?2004l')`);
          assert.equal(await simulatePaste('baz'), 'baz');
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
      assert.deepEqual(await getLinesAsArray(4), ['##', '##', '##', '######']);
      assert.deepEqual(await getCursor(), {col: 6, row: 3});
      // should not repeat on fullwidth chars
      await page.evaluate(`
        window.term.reset();
        window.term.write('￥\x1b[10b');
      `);
      assert.deepEqual(await getLinesAsArray(1), ['￥']);
      // should repeat only base char of combining
      await page.evaluate(`
        window.term.reset();
        window.term.write('e\u0301\x1b[5b');
      `);
      assert.deepEqual(await getLinesAsArray(1), ['e\u0301eeeee']);
      // should wrap correctly
      await page.evaluate(`
        window.term.reset();
        window.term.write('#\x1b[15b');
      `);
      assert.deepEqual(await getLinesAsArray(2), ['##########', '######']);
      await page.evaluate(`
        window.term.reset();
        window.term.write('\x1b[?7l');  // disable wrap around
        window.term.write('#\x1b[15b');
      `);
      assert.deepEqual(await getLinesAsArray(2), ['##########', '']);
      // any successful sequence should reset REP
      await page.evaluate(`
        window.term.reset();
        window.term.write('\x1b[?7h');  // re-enable wrap around
        window.term.write('#\\n\x1b[3b');
        window.term.write('#\\r\x1b[3b');
        window.term.writeln('');
        window.term.write('abcdefg\x1b[3D\x1b[10b#\x1b[3b');
      `);
      assert.deepEqual(await getLinesAsArray(3), ['#', ' #', 'abcd####']);
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
        assert.deepEqual(await getCursor(), {col: 1, row: 3});
      });
    });
  });
});

async function openTerminal(options: ITerminalOptions = {}): Promise<void> {
  await page.evaluate(`window.term = new Terminal(${JSON.stringify(options)})`);
  await page.evaluate(`window.term.open(document.querySelector('#terminal-container'))`);
  if (options.rendererType === 'dom') {
    await page.waitForSelector('.xterm-rows');
  } else {
    await page.waitForSelector('.xterm-text-layer');
  }
}

async function getLinesAsArray(count: number, start: number = 0): Promise<string[]> {
  let text = '';
  for (let i = start; i < start + count; i++) {
    text += `window.term.buffer.getLine(${i}).translateToString(true),`;
  }
  return await page.evaluate(`[${text}]`);
}

async function simulatePaste(text: string): Promise<string> {
  const id = Math.floor(Math.random() * 1000000);
  await page.evaluate(`
    (function () {
      window.term.onData(e => window.result_${id} = e);
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', '${text}');
      window.term.textarea.dispatchEvent(new ClipboardEvent('paste', { clipboardData }));
    })();
  `);
  return await page.evaluate(`window.result_${id}`);
}

async function getCursor(): Promise<{col: number, row: number}> {
  return page.evaluate(`
  (function() {
    return {col: term.buffer.cursorX, row: term.buffer.cursorY};
  })();
  `);
}
