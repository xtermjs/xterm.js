/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as puppeteer from 'puppeteer';
import { assert } from 'chai';
import { ITerminalOptions } from 'xterm';
import { pollFor, timeout, writeSync } from './TestUtils';

const APP = 'http://127.0.0.1:3000/test';

let browser: puppeteer.Browser;
let page: puppeteer.Page;
const width = 800;
const height = 600;

describe('API Integration Tests', function(): void {
  before(async () => {
    browser = await puppeteer.launch({
      headless: process.argv.indexOf('--headless') !== -1,
      args: [`--window-size=${width},${height}`, `--no-sandbox`]
    });
    page = (await browser.pages())[0];
    await page.setViewport({ width, height });
  });

  after(async () => browser.close());
  beforeEach(async () => page.goto(APP));

  it('Default options', async () => {
    await openTerminal();
    assert.equal(await page.evaluate(`window.term.cols`), 80);
    assert.equal(await page.evaluate(`window.term.rows`), 24);
  });

  it('write', async () => {
    await openTerminal();
    await page.evaluate(`
      window.term.write('foo');
      window.term.write('bar');
      window.term.write('文');
    `);
    await pollFor(page, `window.term.buffer.getLine(0).translateToString(true)`, 'foobar文');
  });

  it('write with callback', async () => {
    await openTerminal();
    await page.evaluate(`
      window.term.write('foo', () => { window.__x = 'a'; });
      window.term.write('bar', () => { window.__x += 'b'; });
      window.term.write('文', () => { window.__x += 'c'; });
    `);
    await pollFor(page, `window.term.buffer.getLine(0).translateToString(true)`, 'foobar文');
    await pollFor(page, `window.__x`, 'abc');
  });

  it('write - bytes (UTF8)', async () => {
    await openTerminal();
    await page.evaluate(`
      // foo
      window.term.write(new Uint8Array([102, 111, 111]));
      // bar
      window.term.write(new Uint8Array([98, 97, 114]));
      // 文
      window.term.write(new Uint8Array([230, 150, 135]));
    `);
    await pollFor(page, `window.term.buffer.getLine(0).translateToString(true)`, 'foobar文');
  });

  it('write - bytes (UTF8) with callback', async () => {
    await openTerminal();
    await page.evaluate(`
      // foo
      window.term.write(new Uint8Array([102, 111, 111]), () => { window.__x = 'A'; });
      // bar
      window.term.write(new Uint8Array([98, 97, 114]), () => { window.__x += 'B'; });
      // 文
      window.term.write(new Uint8Array([230, 150, 135]), () => { window.__x += 'C'; });
    `);
    await pollFor(page, `window.term.buffer.getLine(0).translateToString(true)`, 'foobar文');
    await pollFor(page, `window.__x`, 'ABC');
  });

  it('writeln', async () => {
    await openTerminal();
    await page.evaluate(`
      window.term.writeln('foo');
      window.term.writeln('bar');
      window.term.writeln('文');
    `);
    await pollFor(page, `window.term.buffer.getLine(0).translateToString(true)`, 'foo');
    await pollFor(page, `window.term.buffer.getLine(1).translateToString(true)`, 'bar');
    await pollFor(page, `window.term.buffer.getLine(2).translateToString(true)`, '文');
  });

  it('writeln with callback', async () => {
    await openTerminal();
    await page.evaluate(`
      window.term.writeln('foo', () => { window.__x = '1'; });
      window.term.writeln('bar', () => { window.__x += '2'; });
      window.term.writeln('文', () => { window.__x += '3'; });
    `);
    await pollFor(page, `window.term.buffer.getLine(0).translateToString(true)`, 'foo');
    await pollFor(page, `window.term.buffer.getLine(1).translateToString(true)`, 'bar');
    await pollFor(page, `window.term.buffer.getLine(2).translateToString(true)`, '文');
    await pollFor(page, `window.__x`, '123');
  });

  it('writeln - bytes (UTF8)', async () => {
    await openTerminal();
    await page.evaluate(`
      window.term.writeln(new Uint8Array([102, 111, 111]));
      window.term.writeln(new Uint8Array([98, 97, 114]));
      window.term.writeln(new Uint8Array([230, 150, 135]));
    `);
    await pollFor(page, `window.term.buffer.getLine(0).translateToString(true)`, 'foo');
    await pollFor(page, `window.term.buffer.getLine(1).translateToString(true)`, 'bar');
    await pollFor(page, `window.term.buffer.getLine(2).translateToString(true)`, '文');
  });

  it('paste', async () => {
    await openTerminal();
    await page.evaluate(`
      window.calls = [];
      window.term.onData(e => calls.push(e));
      window.term.paste('foo');
      window.term.paste('\\r\\nfoo\\nbar\\r');
      window.term.write('\\x1b[?2004h', () => {
        window.term.paste('foo');
      });
    `);
    await pollFor(page, `window.calls`, ['foo', '\rfoo\rbar\r', '\x1b[200~foo\x1b[201~']);
  });

  it('clear', async () => {
    await openTerminal({ rows: 5 });
    await page.evaluate(`
      window.term.write('test0');
      window.parsed = 0;
      for (let i = 1; i < 10; i++) {
        window.term.write('\\n\\rtest' + i, () => window.parsed++);
      }
    `);
    await pollFor(page, `window.parsed`, 9);
    await page.evaluate(`window.term.clear()`);
    await pollFor(page, `window.term.buffer.length`, 5);
    await pollFor(page, `window.term.buffer.getLine(0).translateToString(true)`, 'test9');
    for (let i = 1; i < 5; i++) {
      await pollFor(page, `window.term.buffer.getLine(${i}).translateToString(true)`, '');
    }
  });

  it('getOption, setOption', async () => {
    await openTerminal();
    assert.equal(await page.evaluate(`window.term.getOption('rendererType')`), 'canvas');
    await page.evaluate(`window.term.setOption('rendererType', 'dom')`);
    assert.equal(await page.evaluate(`window.term.getOption('rendererType')`), 'dom');
  });

  describe('renderer', () => {
    it('foreground', async () => {
      await openTerminal({ rendererType: 'dom' });
      await writeSync(page, '\\x1b[30m0\\x1b[31m1\\x1b[32m2\\x1b[33m3\\x1b[34m4\\x1b[35m5\\x1b[36m6\\x1b[37m7');
      await pollFor(page, `document.querySelectorAll('.xterm-rows > :nth-child(1) > *').length`, 9);
      assert.deepEqual(await page.evaluate(`
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

    it('background', async () => {
      await openTerminal({ rendererType: 'dom' });
      await writeSync(page, '\\x1b[40m0\\x1b[41m1\\x1b[42m2\\x1b[43m3\\x1b[44m4\\x1b[45m5\\x1b[46m6\\x1b[47m7');
      await pollFor(page, `document.querySelectorAll('.xterm-rows > :nth-child(1) > *').length`, 9);
      assert.deepEqual(await page.evaluate(`
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

  it('selection', async () => {
    await openTerminal({ rows: 5, cols: 5 });
    await page.evaluate(`window.term.write('\\n\\nfoo\\n\\n\\rbar\\n\\n\\rbaz')`);
    assert.equal(await page.evaluate(`window.term.hasSelection()`), false);
    assert.equal(await page.evaluate(`window.term.getSelection()`), '');
    assert.deepEqual(await page.evaluate(`window.term.getSelectionPosition()`), undefined);
    await page.evaluate(`window.term.selectAll()`);
    assert.equal(await page.evaluate(`window.term.hasSelection()`), true);
    assert.equal(await page.evaluate(`window.term.getSelection()`), '\n\nfoo\n\nbar\n\nbaz');
    assert.deepEqual(await page.evaluate(`window.term.getSelectionPosition()`), { startColumn: 0, startRow: 0, endColumn: 5, endRow: 6 });
    await page.evaluate(`window.term.clearSelection()`);
    assert.equal(await page.evaluate(`window.term.hasSelection()`), false);
    assert.equal(await page.evaluate(`window.term.getSelection()`), '');
    assert.deepEqual(await page.evaluate(`window.term.getSelectionPosition()`), undefined);
    await page.evaluate(`window.term.select(1, 2, 2)`);
    assert.equal(await page.evaluate(`window.term.hasSelection()`), true);
    assert.equal(await page.evaluate(`window.term.getSelection()`), 'oo');
    assert.deepEqual(await page.evaluate(`window.term.getSelectionPosition()`), { startColumn: 1, startRow: 2, endColumn: 3, endRow: 2 });
  });

  it('focus, blur', async () => {
    await openTerminal();
    assert.equal(await page.evaluate(`document.activeElement.className`), '');
    await page.evaluate(`window.term.focus()`);
    assert.equal(await page.evaluate(`document.activeElement.className`), 'xterm-helper-textarea');
    await page.evaluate(`window.term.blur()`);
    assert.equal(await page.evaluate(`document.activeElement.className`), '');
  });

  describe('loadAddon', () => {
    it('constructor', async () => {
      await openTerminal({ cols: 5 });
      await page.evaluate(`
        window.cols = 0;
        window.term.loadAddon({
          activate: (t) => window.cols = t.cols,
          dispose: () => {}
        });
      `);
      assert.equal(await page.evaluate(`window.cols`), 5);
    });

    it('dispose (addon)', async () => {
      await openTerminal();
      await page.evaluate(`
        window.disposeCalled = false
        window.addon = {
          activate: () => {},
          dispose: () => window.disposeCalled = true
        };
        window.term.loadAddon(window.addon);
      `);
      assert.equal(await page.evaluate(`window.disposeCalled`), false);
      await page.evaluate(`window.addon.dispose()`);
      assert.equal(await page.evaluate(`window.disposeCalled`), true);
    });

    it('dispose (terminal)', async () => {
      await openTerminal();
      await page.evaluate(`
        window.disposeCalled = false
        window.term.loadAddon({
          activate: () => {},
          dispose: () => window.disposeCalled = true
        });
      `);
      assert.equal(await page.evaluate(`window.disposeCalled`), false);
      await page.evaluate(`window.term.dispose()`);
      assert.equal(await page.evaluate(`window.disposeCalled`), true);
    });
  });

  describe('Events', () => {
    it('onCursorMove', async () => {
      await openTerminal();
      await page.evaluate(`
        window.callCount = 0;
        window.term.onCursorMove(e => window.callCount++);
        window.term.write('foo');
      `);
      await pollFor(page, `window.callCount`, 1);
      await page.evaluate(`window.term.write('bar')`);
      await pollFor(page, `window.callCount`, 2);
    });

    it('onData', async () => {
      await openTerminal();
      await page.evaluate(`
        window.calls = [];
        window.term.onData(e => calls.push(e));
      `);
      await page.type('.xterm-helper-textarea', 'foo');
      assert.deepEqual(await page.evaluate(`window.calls`), ['f', 'o', 'o']);
    });

    it('onKey', async () => {
      await openTerminal();
      await page.evaluate(`
        window.calls = [];
        window.term.onKey(e => calls.push(e.key));
      `);
      await page.type('.xterm-helper-textarea', 'foo');
      assert.deepEqual(await page.evaluate(`window.calls`), ['f', 'o', 'o']);
    });

    it('onLineFeed', async () => {
      await openTerminal();
      await page.evaluate(`
        window.callCount = 0;
        window.term.onLineFeed(() => callCount++);
        window.term.writeln('foo');
      `);
      await pollFor(page, `window.callCount`, 1);
      await page.evaluate(`window.term.writeln('bar')`);
      await pollFor(page, `window.callCount`, 2);
    });

    it('onScroll', async () => {
      await openTerminal({ rows: 5 });
      await page.evaluate(`
        window.calls = [];
        window.term.onScroll(e => window.calls.push(e));
        for (let i = 0; i < 4; i++) {
          window.term.writeln('foo');
        }
      `);
      await pollFor(page, `window.calls`, []);
      await page.evaluate(`window.term.writeln('bar')`);
      await pollFor(page, `window.calls`, [1]);
      await page.evaluate(`window.term.writeln('baz')`);
      await pollFor(page, `window.calls`, [1, 2]);
    });

    it('onSelectionChange', async () => {
      await openTerminal();
      await page.evaluate(`
        window.callCount = 0;
        window.term.onSelectionChange(() => window.callCount++);
      `);
      await pollFor(page, `window.callCount`, 0);
      await page.evaluate(`window.term.selectAll()`);
      await pollFor(page, `window.callCount`, 1);
      await page.evaluate(`window.term.clearSelection()`);
      await pollFor(page, `window.callCount`, 2);
    });

    it('onRender', async function (): Promise<void> {
      this.retries(3);
      await openTerminal();
      await timeout(20); // Ensure all init events are fired
      await page.evaluate(`
        window.calls = [];
        window.term.onRender(e => window.calls.push([e.start, e.end]));
      `);
      await pollFor(page, `window.calls`, []);
      await page.evaluate(`window.term.write('foo')`);
      await pollFor(page, `window.calls`, [[0, 0]]);
      await page.evaluate(`window.term.write('bar\\n\\nbaz')`);
      await pollFor(page, `window.calls`, [[0, 0], [0, 2]]);
    });

    it('onResize', async () => {
      await openTerminal();
      await timeout(20); // Ensure all init events are fired
      await page.evaluate(`
        window.calls = [];
        window.term.onResize(e => window.calls.push([e.cols, e.rows]));
      `);
      await pollFor(page, `window.calls`, []);
      await page.evaluate(`window.term.resize(10, 5)`);
      await pollFor(page, `window.calls`, [[10, 5]]);
      await page.evaluate(`window.term.resize(20, 15)`);
      await pollFor(page, `window.calls`, [[10, 5], [20, 15]]);
    });

    it('onTitleChange', async () => {
      await openTerminal();
      await page.evaluate(`
        window.calls = [];
        window.term.onTitleChange(e => window.calls.push(e));
      `);
      await pollFor(page, `window.calls`, []);
      await page.evaluate(`window.term.write('\\x1b]2;foo\\x9c')`);
      await pollFor(page, `window.calls`, ['foo']);
    });
  });

  describe('buffer', () => {
    it('cursorX, cursorY', async () => {
      await openTerminal({ rows: 5, cols: 5 });
      assert.equal(await page.evaluate(`window.term.buffer.cursorX`), 0);
      assert.equal(await page.evaluate(`window.term.buffer.cursorY`), 0);
      await writeSync(page, 'foo');
      assert.equal(await page.evaluate(`window.term.buffer.cursorX`), 3);
      assert.equal(await page.evaluate(`window.term.buffer.cursorY`), 0);
      await writeSync(page, '\\n');
      assert.equal(await page.evaluate(`window.term.buffer.cursorX`), 3);
      assert.equal(await page.evaluate(`window.term.buffer.cursorY`), 1);
      await writeSync(page, '\\r');
      assert.equal(await page.evaluate(`window.term.buffer.cursorX`), 0);
      assert.equal(await page.evaluate(`window.term.buffer.cursorY`), 1);
      await writeSync(page, 'abcde');
      assert.equal(await page.evaluate(`window.term.buffer.cursorX`), 5);
      assert.equal(await page.evaluate(`window.term.buffer.cursorY`), 1);
      await writeSync(page, '\\n\\r\\n\\n\\n\\n\\n');
      assert.equal(await page.evaluate(`window.term.buffer.cursorX`), 0);
      assert.equal(await page.evaluate(`window.term.buffer.cursorY`), 4);
    });

    it('viewportY', async () => {
      await openTerminal({ rows: 5 });
      assert.equal(await page.evaluate(`window.term.buffer.viewportY`), 0);
      await writeSync(page, '\\n\\n\\n\\n');
      assert.equal(await page.evaluate(`window.term.buffer.viewportY`), 0);
      await writeSync(page, '\\n');
      assert.equal(await page.evaluate(`window.term.buffer.viewportY`), 1);
      await writeSync(page, '\\n\\n\\n\\n');
      assert.equal(await page.evaluate(`window.term.buffer.viewportY`), 5);
      await page.evaluate(`window.term.scrollLines(-1)`);
      assert.equal(await page.evaluate(`window.term.buffer.viewportY`), 4);
      await page.evaluate(`window.term.scrollToTop()`);
      assert.equal(await page.evaluate(`window.term.buffer.viewportY`), 0);
    });

    it('baseY', async () => {
      await openTerminal({ rows: 5 });
      assert.equal(await page.evaluate(`window.term.buffer.baseY`), 0);
      await writeSync(page, '\\n\\n\\n\\n');
      assert.equal(await page.evaluate(`window.term.buffer.baseY`), 0);
      await writeSync(page, '\\n');
      assert.equal(await page.evaluate(`window.term.buffer.baseY`), 1);
      await writeSync(page, '\\n\\n\\n\\n');
      assert.equal(await page.evaluate(`window.term.buffer.baseY`), 5);
      await page.evaluate(`window.term.scrollLines(-1)`);
      assert.equal(await page.evaluate(`window.term.buffer.baseY`), 5);
      await page.evaluate(`window.term.scrollToTop()`);
      assert.equal(await page.evaluate(`window.term.buffer.baseY`), 5);
    });

    it('length', async () => {
      await openTerminal({ rows: 5 });
      assert.equal(await page.evaluate(`window.term.buffer.length`), 5);
      await writeSync(page, '\\n\\n\\n\\n');
      assert.equal(await page.evaluate(`window.term.buffer.length`), 5);
      await writeSync(page, '\\n');
      assert.equal(await page.evaluate(`window.term.buffer.length`), 6);
      await writeSync(page, '\\n\\n\\n\\n');
      assert.equal(await page.evaluate(`window.term.buffer.length`), 10);
    });

    describe('getLine', () => {
      it('invalid index', async () => {
        await openTerminal({ rows: 5 });
        assert.equal(await page.evaluate(`window.term.buffer.getLine(-1)`), undefined);
        assert.equal(await page.evaluate(`window.term.buffer.getLine(5)`), undefined);
      });

      it('isWrapped', async () => {
        await openTerminal({ cols: 5 });
        assert.equal(await page.evaluate(`window.term.buffer.getLine(0).isWrapped`), false);
        assert.equal(await page.evaluate(`window.term.buffer.getLine(1).isWrapped`), false);
        await writeSync(page, 'abcde');
        assert.equal(await page.evaluate(`window.term.buffer.getLine(0).isWrapped`), false);
        assert.equal(await page.evaluate(`window.term.buffer.getLine(1).isWrapped`), false);
        await writeSync(page, 'f');
        assert.equal(await page.evaluate(`window.term.buffer.getLine(0).isWrapped`), false);
        assert.equal(await page.evaluate(`window.term.buffer.getLine(1).isWrapped`), true);
      });

      it('translateToString', async () => {
        await openTerminal({ cols: 5 });
        assert.equal(await page.evaluate(`window.term.buffer.getLine(0).translateToString()`), '     ');
        assert.equal(await page.evaluate(`window.term.buffer.getLine(0).translateToString(true)`), '');
        await writeSync(page, 'foo');
        assert.equal(await page.evaluate(`window.term.buffer.getLine(0).translateToString()`), 'foo  ');
        assert.equal(await page.evaluate(`window.term.buffer.getLine(0).translateToString(true)`), 'foo');
        await writeSync(page, 'bar');
        assert.equal(await page.evaluate(`window.term.buffer.getLine(0).translateToString()`), 'fooba');
        assert.equal(await page.evaluate(`window.term.buffer.getLine(0).translateToString(true)`), 'fooba');
        assert.equal(await page.evaluate(`window.term.buffer.getLine(1).translateToString(true)`), 'r');
        assert.equal(await page.evaluate(`window.term.buffer.getLine(0).translateToString(false, 1)`), 'ooba');
        assert.equal(await page.evaluate(`window.term.buffer.getLine(0).translateToString(false, 1, 3)`), 'oo');
      });

      it('getCell', async () => {
        await openTerminal({ cols: 5 });
        assert.equal(await page.evaluate(`window.term.buffer.getLine(0).getCell(-1)`), undefined);
        assert.equal(await page.evaluate(`window.term.buffer.getLine(0).getCell(5)`), undefined);
        assert.equal(await page.evaluate(`window.term.buffer.getLine(0).getCell(0).char`), '');
        assert.equal(await page.evaluate(`window.term.buffer.getLine(0).getCell(0).width`), 1);
        await writeSync(page, 'a文');
        assert.equal(await page.evaluate(`window.term.buffer.getLine(0).getCell(0).char`), 'a');
        assert.equal(await page.evaluate(`window.term.buffer.getLine(0).getCell(0).width`), 1);
        assert.equal(await page.evaluate(`window.term.buffer.getLine(0).getCell(1).char`), '文');
        assert.equal(await page.evaluate(`window.term.buffer.getLine(0).getCell(1).width`), 2);
        assert.equal(await page.evaluate(`window.term.buffer.getLine(0).getCell(2).char`), '');
        assert.equal(await page.evaluate(`window.term.buffer.getLine(0).getCell(2).width`), 0);
      });
    });
  });

  it('dispose', async () => {
    await page.evaluate(`
      window.term = new Terminal();
      window.term.dispose();
    `);
    assert.equal(await page.evaluate(`window.term._core._isDisposed`), true);
  });

  it('dispose (opened)', async () => {
    await openTerminal();
    await page.evaluate(`window.term.dispose()`);
    assert.equal(await page.evaluate(`window.term._core._isDisposed`), true);
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
