/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { pollFor, timeout, writeSync, openTerminal, launchBrowser } from './TestUtils';
import { Browser, Page } from 'playwright';
import { fail } from 'assert';

const APP = 'http://127.0.0.1:3001/test';

let browser: Browser;
let page: Page;
const width = 800;
const height = 600;

describe('API Integration Tests', function(): void {
  before(async () => {
    browser = await launchBrowser();
    page = await (await browser.newContext()).newPage();
    await page.setViewportSize({ width, height });
  });

  after(async () => browser.close());
  beforeEach(async () => page.goto(APP));

  it('Default options', async () => {
    await openTerminal(page);
    assert.equal(await page.evaluate(`window.term.cols`), 80);
    assert.equal(await page.evaluate(`window.term.rows`), 24);
  });

  it('Proposed API check', async () => {
    await openTerminal(page, { allowProposedApi: false });
    await page.evaluate(`
      try {
        window.term.buffer;
      } catch (e) {
        window.throwMessage = e.message;
      }
    `);
    await pollFor(page, 'window.throwMessage', 'You must set the allowProposedApi option to true to use proposed API');
  });

  it('write', async () => {
    await openTerminal(page);
    await page.evaluate(`
      window.term.write('foo');
      window.term.write('bar');
      window.term.write('文');
    `);
    await pollFor(page, `window.term.buffer.active.getLine(0).translateToString(true)`, 'foobar文');
  });

  it('write with callback', async () => {
    await openTerminal(page);
    await page.evaluate(`
      window.term.write('foo', () => { window.__x = 'a'; });
      window.term.write('bar', () => { window.__x += 'b'; });
      window.term.write('文', () => { window.__x += 'c'; });
    `);
    await pollFor(page, `window.term.buffer.active.getLine(0).translateToString(true)`, 'foobar文');
    await pollFor(page, `window.__x`, 'abc');
  });

  it('write - bytes (UTF8)', async () => {
    await openTerminal(page);
    await page.evaluate(`
      window.term.write(new Uint8Array([102, 111, 111])); // foo
      window.term.write(new Uint8Array([98, 97, 114])); // bar
      window.term.write(new Uint8Array([230, 150, 135])); // 文
    `);
    await pollFor(page, `window.term.buffer.active.getLine(0).translateToString(true)`, 'foobar文');
  });

  it('write - bytes (UTF8) with callback', async () => {
    await openTerminal(page);
    await page.evaluate(`
      window.term.write(new Uint8Array([102, 111, 111]), () => { window.__x = 'A'; }); // foo
      window.term.write(new Uint8Array([98, 97, 114]), () => { window.__x += 'B'; }); // bar
      window.term.write(new Uint8Array([230, 150, 135]), () => { window.__x += 'C'; }); // 文
    `);
    await pollFor(page, `window.term.buffer.active.getLine(0).translateToString(true)`, 'foobar文');
    await pollFor(page, `window.__x`, 'ABC');
  });

  it('writeln', async () => {
    await openTerminal(page);
    await page.evaluate(`
      window.term.writeln('foo');
      window.term.writeln('bar');
      window.term.writeln('文');
    `);
    await pollFor(page, `window.term.buffer.active.getLine(0).translateToString(true)`, 'foo');
    await pollFor(page, `window.term.buffer.active.getLine(1).translateToString(true)`, 'bar');
    await pollFor(page, `window.term.buffer.active.getLine(2).translateToString(true)`, '文');
  });

  it('writeln with callback', async () => {
    await openTerminal(page);
    await page.evaluate(`
      window.term.writeln('foo', () => { window.__x = '1'; });
      window.term.writeln('bar', () => { window.__x += '2'; });
      window.term.writeln('文', () => { window.__x += '3'; });
    `);
    await pollFor(page, `window.term.buffer.active.getLine(0).translateToString(true)`, 'foo');
    await pollFor(page, `window.term.buffer.active.getLine(1).translateToString(true)`, 'bar');
    await pollFor(page, `window.term.buffer.active.getLine(2).translateToString(true)`, '文');
    await pollFor(page, `window.__x`, '123');
  });

  it('writeln - bytes (UTF8)', async () => {
    await openTerminal(page);
    await page.evaluate(`
      window.term.writeln(new Uint8Array([102, 111, 111]));
      window.term.writeln(new Uint8Array([98, 97, 114]));
      window.term.writeln(new Uint8Array([230, 150, 135]));
    `);
    await pollFor(page, `window.term.buffer.active.getLine(0).translateToString(true)`, 'foo');
    await pollFor(page, `window.term.buffer.active.getLine(1).translateToString(true)`, 'bar');
    await pollFor(page, `window.term.buffer.active.getLine(2).translateToString(true)`, '文');
  });

  it('paste', async () => {
    await openTerminal(page);
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
    await openTerminal(page, { rows: 5 });
    await page.evaluate(`
      window.term.write('test0');
      window.parsed = 0;
      for (let i = 1; i < 10; i++) {
        window.term.write('\\n\\rtest' + i, () => window.parsed++);
      }
    `);
    await pollFor(page, `window.parsed`, 9);
    await page.evaluate(`window.term.clear()`);
    await pollFor(page, `window.term.buffer.active.length`, 5);
    await pollFor(page, `window.term.buffer.active.getLine(0).translateToString(true)`, 'test9');
    for (let i = 1; i < 5; i++) {
      await pollFor(page, `window.term.buffer.active.getLine(${i}).translateToString(true)`, '');
    }
  });

  it('getOption, setOption', async () => {
    await openTerminal(page);
    assert.equal(await page.evaluate(`window.term.getOption('rendererType')`), 'canvas');
    await page.evaluate(`window.term.setOption('rendererType', 'dom')`);
    assert.equal(await page.evaluate(`window.term.getOption('rendererType')`), 'dom');
  });

  describe('options', () => {
    it('getter', async () => {
      await openTerminal(page);
      assert.equal(await page.evaluate(`window.term.options.rendererType`), 'canvas');
      assert.equal(await page.evaluate(`window.term.options.cols`), 80);
      assert.equal(await page.evaluate(`window.term.options.rows`), 24);
    });
    it('setter', async () => {
      await openTerminal(page);
      try {
        await page.evaluate('window.term.options.cols = 40');
        fail();
      } catch {}
      try {
        await page.evaluate('window.term.options.rows = 20');
        fail();
      } catch {}
      await page.evaluate('window.term.options.scrollback = 1');
      assert.equal(await page.evaluate(`window.term.options.scrollback`), 1);
      await page.evaluate(`
        window.term.options = {
          fontSize: 30,
          fontFamily: 'Arial'
        };
      `);
      assert.equal(await page.evaluate(`window.term.options.fontSize`), 30);
      assert.equal(await page.evaluate(`window.term.options.fontFamily`), 'Arial');
    });
  });

  describe('renderer', () => {
    it('foreground', async () => {
      await openTerminal(page, { rendererType: 'dom' });
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
      await openTerminal(page, { rendererType: 'dom' });
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
    await openTerminal(page, { rows: 5, cols: 5 });
    await writeSync(page, `\\n\\nfoo\\n\\n\\rbar\\n\\n\\rbaz`);
    assert.equal(await page.evaluate(`window.term.hasSelection()`), false);
    assert.equal(await page.evaluate(`window.term.getSelection()`), '');
    assert.deepEqual(await page.evaluate(`window.term.getSelectionPosition()`), undefined);
    await page.evaluate(`window.term.selectAll()`);
    assert.equal(await page.evaluate(`window.term.hasSelection()`), true);
    if (process.platform === 'win32') {
      assert.equal(await page.evaluate(`window.term.getSelection()`), '\r\n\r\nfoo\r\n\r\nbar\r\n\r\nbaz');
    } else {
      assert.equal(await page.evaluate(`window.term.getSelection()`), '\n\nfoo\n\nbar\n\nbaz');
    }
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
    await openTerminal(page);
    assert.equal(await page.evaluate(`document.activeElement.className`), '');
    await page.evaluate(`window.term.focus()`);
    assert.equal(await page.evaluate(`document.activeElement.className`), 'xterm-helper-textarea');
    await page.evaluate(`window.term.blur()`);
    assert.equal(await page.evaluate(`document.activeElement.className`), '');
  });

  describe('loadAddon', () => {
    it('constructor', async () => {
      await openTerminal(page, { cols: 5 });
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
      await openTerminal(page);
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
      await openTerminal(page);
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
      await openTerminal(page);
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
      await openTerminal(page);
      await page.evaluate(`
        window.calls = [];
        window.term.onData(e => calls.push(e));
      `);
      await page.type('.xterm-helper-textarea', 'foo');
      assert.deepEqual(await page.evaluate(`window.calls`), ['f', 'o', 'o']);
    });

    it('onKey', async () => {
      await openTerminal(page);
      await page.evaluate(`
        window.calls = [];
        window.term.onKey(e => calls.push(e.key));
      `);
      await page.type('.xterm-helper-textarea', 'foo');
      assert.deepEqual(await page.evaluate(`window.calls`), ['f', 'o', 'o']);
    });

    it('onLineFeed', async () => {
      await openTerminal(page);
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
      await openTerminal(page, { rows: 5 });
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
      await openTerminal(page);
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

    it('onRender', async function(): Promise<void> {
      this.retries(3);
      await openTerminal(page);
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
      await openTerminal(page);
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
      await openTerminal(page);
      await page.evaluate(`
        window.calls = [];
        window.term.onTitleChange(e => window.calls.push(e));
      `);
      await pollFor(page, `window.calls`, []);
      await page.evaluate(`window.term.write('\\x1b]2;foo\\x9c')`);
      await pollFor(page, `window.calls`, ['foo']);
    });
    it('onBell', async () => {
      await openTerminal(page);
      await page.evaluate(`
        window.calls = [];
        window.term.onBell(() => window.calls.push(true));
      `);
      await pollFor(page, `window.calls`, []);
      await page.evaluate(`window.term.write('\\x07')`);
      await pollFor(page, `window.calls`, [true]);
    });
  });

  describe('buffer', () => {
    it('cursorX, cursorY', async () => {
      await openTerminal(page, { rows: 5, cols: 5 });
      assert.equal(await page.evaluate(`window.term.buffer.active.cursorX`), 0);
      assert.equal(await page.evaluate(`window.term.buffer.active.cursorY`), 0);
      await writeSync(page, 'foo');
      assert.equal(await page.evaluate(`window.term.buffer.active.cursorX`), 3);
      assert.equal(await page.evaluate(`window.term.buffer.active.cursorY`), 0);
      await writeSync(page, '\\n');
      assert.equal(await page.evaluate(`window.term.buffer.active.cursorX`), 3);
      assert.equal(await page.evaluate(`window.term.buffer.active.cursorY`), 1);
      await writeSync(page, '\\r');
      assert.equal(await page.evaluate(`window.term.buffer.active.cursorX`), 0);
      assert.equal(await page.evaluate(`window.term.buffer.active.cursorY`), 1);
      await writeSync(page, 'abcde');
      assert.equal(await page.evaluate(`window.term.buffer.active.cursorX`), 5);
      assert.equal(await page.evaluate(`window.term.buffer.active.cursorY`), 1);
      await writeSync(page, '\\n\\r\\n\\n\\n\\n\\n');
      assert.equal(await page.evaluate(`window.term.buffer.active.cursorX`), 0);
      assert.equal(await page.evaluate(`window.term.buffer.active.cursorY`), 4);
    });

    it('viewportY', async () => {
      await openTerminal(page, { rows: 5 });
      assert.equal(await page.evaluate(`window.term.buffer.active.viewportY`), 0);
      await writeSync(page, '\\n\\n\\n\\n');
      assert.equal(await page.evaluate(`window.term.buffer.active.viewportY`), 0);
      await writeSync(page, '\\n');
      assert.equal(await page.evaluate(`window.term.buffer.active.viewportY`), 1);
      await writeSync(page, '\\n\\n\\n\\n');
      assert.equal(await page.evaluate(`window.term.buffer.active.viewportY`), 5);
      await page.evaluate(`window.term.scrollLines(-1)`);
      assert.equal(await page.evaluate(`window.term.buffer.active.viewportY`), 4);
      await page.evaluate(`window.term.scrollToTop()`);
      assert.equal(await page.evaluate(`window.term.buffer.active.viewportY`), 0);
    });

    it('baseY', async () => {
      await openTerminal(page, { rows: 5 });
      assert.equal(await page.evaluate(`window.term.buffer.active.baseY`), 0);
      await writeSync(page, '\\n\\n\\n\\n');
      assert.equal(await page.evaluate(`window.term.buffer.active.baseY`), 0);
      await writeSync(page, '\\n');
      assert.equal(await page.evaluate(`window.term.buffer.active.baseY`), 1);
      await writeSync(page, '\\n\\n\\n\\n');
      assert.equal(await page.evaluate(`window.term.buffer.active.baseY`), 5);
      await page.evaluate(`window.term.scrollLines(-1)`);
      assert.equal(await page.evaluate(`window.term.buffer.active.baseY`), 5);
      await page.evaluate(`window.term.scrollToTop()`);
      assert.equal(await page.evaluate(`window.term.buffer.active.baseY`), 5);
    });

    it('length', async () => {
      await openTerminal(page, { rows: 5 });
      assert.equal(await page.evaluate(`window.term.buffer.active.length`), 5);
      await writeSync(page, '\\n\\n\\n\\n');
      assert.equal(await page.evaluate(`window.term.buffer.active.length`), 5);
      await writeSync(page, '\\n');
      assert.equal(await page.evaluate(`window.term.buffer.active.length`), 6);
      await writeSync(page, '\\n\\n\\n\\n');
      assert.equal(await page.evaluate(`window.term.buffer.active.length`), 10);
    });

    describe('getLine', () => {
      it('invalid index', async () => {
        await openTerminal(page, { rows: 5 });
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(-1)`), undefined);
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(5)`), undefined);
      });

      it('isWrapped', async () => {
        await openTerminal(page, { cols: 5 });
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).isWrapped`), false);
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(1).isWrapped`), false);
        await writeSync(page, 'abcde');
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).isWrapped`), false);
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(1).isWrapped`), false);
        await writeSync(page, 'f');
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).isWrapped`), false);
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(1).isWrapped`), true);
      });

      it('translateToString', async () => {
        await openTerminal(page, { cols: 5 });
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), '     ');
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString(true)`), '');
        await writeSync(page, 'foo');
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), 'foo  ');
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString(true)`), 'foo');
        await writeSync(page, 'bar');
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), 'fooba');
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString(true)`), 'fooba');
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(1).translateToString(true)`), 'r');
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString(false, 1)`), 'ooba');
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString(false, 1, 3)`), 'oo');
      });

      it('getCell', async () => {
        await openTerminal(page, { cols: 5 });
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(-1)`), undefined);
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(5)`), undefined);
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(0).getChars()`), '');
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(0).getWidth()`), 1);
        await writeSync(page, 'a文');
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(0).getChars()`), 'a');
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(0).getWidth()`), 1);
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(1).getChars()`), '文');
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(1).getWidth()`), 2);
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(2).getChars()`), '');
        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(2).getWidth()`), 0);
      });
    });

    it('active, normal, alternate', async () => {
      await openTerminal(page, { cols: 5 });
      assert.equal(await page.evaluate(`window.term.buffer.active.type`), 'normal');
      assert.equal(await page.evaluate(`window.term.buffer.normal.type`), 'normal');
      assert.equal(await page.evaluate(`window.term.buffer.alternate.type`), 'alternate');

      await writeSync(page, 'norm ');
      assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), 'norm ');
      assert.equal(await page.evaluate(`window.term.buffer.normal.getLine(0).translateToString()`), 'norm ');
      assert.equal(await page.evaluate(`window.term.buffer.alternate.getLine(0)`), undefined);

      await writeSync(page, '\\x1b[?47h\\r'); // use alternate screen buffer
      assert.equal(await page.evaluate(`window.term.buffer.active.type`), 'alternate');
      assert.equal(await page.evaluate(`window.term.buffer.normal.type`), 'normal');
      assert.equal(await page.evaluate(`window.term.buffer.alternate.type`), 'alternate');

      assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), '     ');
      await writeSync(page, 'alt  ');
      assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), 'alt  ');
      assert.equal(await page.evaluate(`window.term.buffer.normal.getLine(0).translateToString()`), 'norm ');
      assert.equal(await page.evaluate(`window.term.buffer.alternate.getLine(0).translateToString()`), 'alt  ');

      await writeSync(page, '\\x1b[?47l\\r'); // use normal screen buffer
      assert.equal(await page.evaluate(`window.term.buffer.active.type`), 'normal');
      assert.equal(await page.evaluate(`window.term.buffer.normal.type`), 'normal');
      assert.equal(await page.evaluate(`window.term.buffer.alternate.type`), 'alternate');

      assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), 'norm ');
      assert.equal(await page.evaluate(`window.term.buffer.normal.getLine(0).translateToString()`), 'norm ');
      assert.equal(await page.evaluate(`window.term.buffer.alternate.getLine(0)`), undefined);
    });
  });

  describe('modes', () => {
    it('defaults', async () => {
      await openTerminal(page);
      assert.deepStrictEqual(await page.evaluate(`window.term.modes`), {
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
    it('applicationCursorKeysMode', async () => {
      await openTerminal(page);
      await writeSync(page, '\\x1b[?1h');
      assert.strictEqual(await page.evaluate(`window.term.modes.applicationCursorKeysMode`), true);
      await writeSync(page, '\\x1b[?1l');
      assert.strictEqual(await page.evaluate(`window.term.modes.applicationCursorKeysMode`), false);
    });
    it('applicationKeypadMode', async () => {
      await openTerminal(page);
      await writeSync(page, '\\x1b[?66h');
      assert.strictEqual(await page.evaluate(`window.term.modes.applicationKeypadMode`), true);
      await writeSync(page, '\\x1b[?66l');
      assert.strictEqual(await page.evaluate(`window.term.modes.applicationKeypadMode`), false);
    });
    it('bracketedPasteMode', async () => {
      await openTerminal(page);
      await writeSync(page, '\\x1b[?2004h');
      assert.strictEqual(await page.evaluate(`window.term.modes.bracketedPasteMode`), true);
      await writeSync(page, '\\x1b[?2004l');
      assert.strictEqual(await page.evaluate(`window.term.modes.bracketedPasteMode`), false);
    });
    it('insertMode', async () => {
      await openTerminal(page);
      await writeSync(page, '\\x1b[4h');
      assert.strictEqual(await page.evaluate(`window.term.modes.insertMode`), true);
      await writeSync(page, '\\x1b[4l');
      assert.strictEqual(await page.evaluate(`window.term.modes.insertMode`), false);
    });
    it('mouseTrackingMode', async () => {
      await openTerminal(page);
      await writeSync(page, '\\x1b[?9h');
      assert.strictEqual(await page.evaluate(`window.term.modes.mouseTrackingMode`), 'x10');
      await writeSync(page, '\\x1b[?9l');
      assert.strictEqual(await page.evaluate(`window.term.modes.mouseTrackingMode`), 'none');
      await writeSync(page, '\\x1b[?1000h');
      assert.strictEqual(await page.evaluate(`window.term.modes.mouseTrackingMode`), 'vt200');
      await writeSync(page, '\\x1b[?1000l');
      assert.strictEqual(await page.evaluate(`window.term.modes.mouseTrackingMode`), 'none');
      await writeSync(page, '\\x1b[?1002h');
      assert.strictEqual(await page.evaluate(`window.term.modes.mouseTrackingMode`), 'drag');
      await writeSync(page, '\\x1b[?1002l');
      assert.strictEqual(await page.evaluate(`window.term.modes.mouseTrackingMode`), 'none');
      await writeSync(page, '\\x1b[?1003h');
      assert.strictEqual(await page.evaluate(`window.term.modes.mouseTrackingMode`), 'any');
      await writeSync(page, '\\x1b[?1003l');
      assert.strictEqual(await page.evaluate(`window.term.modes.mouseTrackingMode`), 'none');
    });
    it('originMode', async () => {
      await openTerminal(page);
      await writeSync(page, '\\x1b[?6h');
      assert.strictEqual(await page.evaluate(`window.term.modes.originMode`), true);
      await writeSync(page, '\\x1b[?6l');
      assert.strictEqual(await page.evaluate(`window.term.modes.originMode`), false);
    });
    it('reverseWraparoundMode', async () => {
      await openTerminal(page);
      await writeSync(page, '\\x1b[?45h');
      assert.strictEqual(await page.evaluate(`window.term.modes.reverseWraparoundMode`), true);
      await writeSync(page, '\\x1b[?45l');
      assert.strictEqual(await page.evaluate(`window.term.modes.reverseWraparoundMode`), false);
    });
    it('sendFocusMode', async () => {
      await openTerminal(page);
      await writeSync(page, '\\x1b[?1004h');
      assert.strictEqual(await page.evaluate(`window.term.modes.sendFocusMode`), true);
      await writeSync(page, '\\x1b[?1004l');
      assert.strictEqual(await page.evaluate(`window.term.modes.sendFocusMode`), false);
    });
    it('wraparoundMode', async () => {
      await openTerminal(page);
      await writeSync(page, '\\x1b[?7h');
      assert.strictEqual(await page.evaluate(`window.term.modes.wraparoundMode`), true);
      await writeSync(page, '\\x1b[?7l');
      assert.strictEqual(await page.evaluate(`window.term.modes.wraparoundMode`), false);
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
    await openTerminal(page);
    await page.evaluate(`window.term.dispose()`);
    assert.equal(await page.evaluate(`window.term._core._isDisposed`), true);
  });

  it('render when visible after hidden', async () => {
    await page.evaluate(`document.querySelector('#terminal-container').style.display='none'`);
    await page.evaluate(`window.term = new Terminal()`);
    await page.evaluate(`window.term.open(document.querySelector('#terminal-container'))`);
    await page.evaluate(`document.querySelector('#terminal-container').style.display=''`);
    await pollFor(page, `window.term._core._renderService.dimensions.actualCellWidth > 0`, true);
  });

  describe('registerLinkProvider', () => {
    it('should fire provideLinks when hovering cells', async () => {
      await openTerminal(page, { rendererType: 'dom' });
      await page.evaluate(`
        window.calls = [];
        window.disposable = window.term.registerLinkProvider({
          provideLinks: (position, cb) => {
            calls.push(position);
            cb(undefined);
          }
        });
      `);
      const dims = await getDimensions();
      await moveMouseCell(page, dims, 1, 1);
      await moveMouseCell(page, dims, 2, 2);
      await moveMouseCell(page, dims, 10, 4);
      await pollFor(page, `window.calls`, [1, 2, 4]);
      await page.evaluate(`window.disposable.dispose()`);
    });

    it('should fire hover and leave events on the link', async () => {
      await openTerminal(page, { rendererType: 'dom' });
      await writeSync(page, 'foo bar baz');
      // Wait for renderer to catch up as links are cleared on render
      await pollFor(page, `document.querySelector('.xterm-rows').textContent`, 'foo bar baz ');
      await page.evaluate(`
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
      await moveMouseCell(page, dims, 5, 1);
      await timeout(100);
      await moveMouseCell(page, dims, 4, 1);
      await pollFor(page, `window.calls`, ['provide 1', 'match', 'hover', 'leave' ]);
      await moveMouseCell(page, dims, 7, 1);
      await timeout(100);
      await moveMouseCell(page, dims, 8, 1);
      await pollFor(page, `window.calls`, ['provide 1', 'match', 'hover', 'leave', 'hover', 'leave']);
      await page.evaluate(`window.disposable.dispose()`);
    });

    it('should work fine when hover and leave callbacks are not provided', async () => {
      await openTerminal(page, { rendererType: 'dom' });
      await writeSync(page, 'foo bar baz');
      // Wait for renderer to catch up as links are cleared on render
      await pollFor(page, `document.querySelector('.xterm-rows').textContent`, 'foo bar baz ');
      await page.evaluate(`
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
      await moveMouseCell(page, dims, 5, 1);
      await pollFor(page, `window.calls`, ['provide 1', 'match 1']);
      await moveMouseCell(page, dims, 4, 2);
      await pollFor(page, `window.calls`, ['provide 1', 'match 1', 'provide 2', 'match 2']);
      await moveMouseCell(page, dims, 7, 1);
      await pollFor(page, `window.calls`, ['provide 1', 'match 1', 'provide 2', 'match 2', 'provide 1', 'match 1']);
      await moveMouseCell(page, dims, 6, 2);
      await pollFor(page, `window.calls`, ['provide 1', 'match 1', 'provide 2', 'match 2', 'provide 1', 'match 1', 'provide 2', 'match 2']);
      await page.evaluate(`window.disposable.dispose()`);
    });

    it('should fire activate events when clicking the link', async () => {
      await openTerminal(page, { rendererType: 'dom' });
      await writeSync(page, 'a b c');

      // Wait for renderer to catch up as links are cleared on render
      await pollFor(page, `document.querySelector('.xterm-rows').textContent`, 'a b c ');

      // Focus terminal to avoid a render event clearing the active link
      const dims = await getDimensions();
      await moveMouseCell(page, dims, 5, 5);
      await page.mouse.down();
      await page.mouse.up();
      await timeout(200); // Not sure how to avoid this timeout, checking for xterm-focus doesn't help

      await page.evaluate(`
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
      await moveMouseCell(page, dims, 3, 1);
      await pollFor(page, `window.calls`, ['provide 1', 'hover 1']);
      await page.mouse.down();
      await page.mouse.up();
      await pollFor(page, `window.calls`, ['provide 1', 'hover 1', 'activate 1']);
      await moveMouseCell(page, dims, 1, 2);
      await pollFor(page, `window.calls`, ['provide 1', 'hover 1', 'activate 1', 'leave 1', 'provide 2', 'hover 2']);
      await page.mouse.down();
      await page.mouse.up();
      await pollFor(page, `window.calls`, ['provide 1', 'hover 1', 'activate 1', 'leave 1', 'provide 2', 'hover 2', 'activate 2']);
      await moveMouseCell(page, dims, 5, 1);
      await pollFor(page, `window.calls`, ['provide 1', 'hover 1', 'activate 1', 'leave 1', 'provide 2', 'hover 2', 'activate 2', 'leave 2', 'provide 1', 'hover 1']);
      await page.mouse.down();
      await page.mouse.up();
      await pollFor(page, `window.calls`, ['provide 1', 'hover 1', 'activate 1', 'leave 1', 'provide 2', 'hover 2', 'activate 2', 'leave 2', 'provide 1', 'hover 1', 'activate 1']);
      await page.evaluate(`window.disposable.dispose()`);
    });

    it('should work when multiple links are provided on the same line', async () => {
      await openTerminal(page, { rendererType: 'dom' });
      await writeSync(page, 'foo bar baz');
      // Wait for renderer to catch up as links are cleared on render
      await pollFor(page, `document.querySelector('.xterm-rows').textContent`, 'foo bar baz ');
      await page.evaluate(`
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
      await moveMouseCell(page, dims, 2, 1);
      await pollFor(page, `window.calls`, ['provide 1', 'hover 1-3']);
      await moveMouseCell(page, dims, 6, 1);
      await pollFor(page, `window.calls`, ['provide 1', 'hover 1-3', 'leave 1-3', 'hover 5-7']);
      await moveMouseCell(page, dims, 6, 2);
      await pollFor(page, `window.calls`, ['provide 1', 'hover 1-3', 'leave 1-3', 'hover 5-7', 'leave 5-7', 'provide 2']);
      await moveMouseCell(page, dims, 10, 1);
      await pollFor(page, `window.calls`, ['provide 1', 'hover 1-3', 'leave 1-3', 'hover 5-7', 'leave 5-7', 'provide 2', 'provide 1', 'hover 9-11']);
      await page.evaluate(`window.disposable.dispose()`);
    });

    it('should dispose links when hovering away', async () => {
      await openTerminal(page, { rendererType: 'dom' });
      await writeSync(page, 'foo bar baz');
      // Wait for renderer to catch up as links are cleared on render
      await pollFor(page, `document.querySelector('.xterm-rows').textContent`, 'foo bar baz ');
      await page.evaluate(`
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
      await moveMouseCell(page, dims, 2, 1);
      await pollFor(page, `window.calls`, ['provide 1', 'hover 1-3']);
      await moveMouseCell(page, dims, 6, 1);
      await pollFor(page, `window.calls`, ['provide 1', 'hover 1-3', 'leave 1-3', 'hover 5-7']);
      await moveMouseCell(page, dims, 6, 2);
      await pollFor(page, `window.calls`, ['provide 1', 'hover 1-3', 'leave 1-3', 'hover 5-7', 'leave 5-7', 'dispose 1-3', 'dispose 5-7', 'dispose 9-11', 'provide 2']);
      await moveMouseCell(page, dims, 10, 1);
      await pollFor(page, `window.calls`, ['provide 1', 'hover 1-3', 'leave 1-3', 'hover 5-7', 'leave 5-7', 'dispose 1-3', 'dispose 5-7', 'dispose 9-11', 'provide 2', 'provide 1', 'hover 9-11']);
      await moveMouseCell(page, dims, 10, 2);
      await pollFor(page, `window.calls`, ['provide 1', 'hover 1-3', 'leave 1-3', 'hover 5-7', 'leave 5-7', 'dispose 1-3', 'dispose 5-7', 'dispose 9-11', 'provide 2', 'provide 1', 'hover 9-11', 'leave 9-11', 'dispose 1-3', 'dispose 5-7', 'dispose 9-11', 'provide 2']);
      await page.evaluate(`window.disposable.dispose()`);
    });
  });
});

interface IDimensions {
  top: number;
  left: number;
  renderDimensions: IRenderDimensions;
}

interface IRenderDimensions {
  scaledCharWidth: number;
  scaledCharHeight: number;
  scaledCellWidth: number;
  scaledCellHeight: number;
  scaledCharLeft: number;
  scaledCharTop: number;
  scaledCanvasWidth: number;
  scaledCanvasHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  actualCellWidth: number;
  actualCellHeight: number;
}

async function getDimensions(): Promise<IDimensions> {
  return await page.evaluate(`
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
    x: dimensions.left + dimensions.renderDimensions.scaledCellWidth * (col - 0.5),
    y: dimensions.top + dimensions.renderDimensions.scaledCellHeight * (row - 0.5)
  };
}

async function moveMouseCell(page: Page, dimensions: IDimensions, col: number, row: number): Promise<void> {
  const coords = await getCellCoordinates(dimensions, col, row);
  await page.mouse.move(coords.x, coords.y);
}
