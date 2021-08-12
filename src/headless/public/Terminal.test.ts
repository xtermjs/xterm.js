/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { strictEqual, throws } from 'assert';
import { Terminal } from 'headless/public/Terminal';

let term: Terminal;

describe.only('Headless API Tests', function(): void {
  beforeEach(() => {
    // Create default terminal to be used by most tests
    term = new Terminal();
  });

  it('Default options', async () => {
    strictEqual(term.cols, 80);
    strictEqual(term.rows, 24);
  });

  it('Proposed API check', async () => {
    term = new Terminal({ allowProposedApi: false });
    throws(() => term.buffer, (error) => error.message === 'You must set the allowProposedApi option to true to use proposed API');
  });

  it('write', async () => {
    await writeSync('foo');
    await writeSync('bar');
    await writeSync('文');
    lineEquals(0, 'foobar文');
  });

  it('write with callback', async () => {
    let result: string | undefined;
    await new Promise<void>(r => {
      term.write('foo', () => { result = 'a'; });
      term.write('bar', () => { result += 'b'; });
      term.write('文', () => {
        result += 'c';
        r();
      });
    });
    lineEquals(0, 'foobar文');
    strictEqual(result, 'abc');
  });

  it('write - bytes (UTF8)', async () => {
    await writeSync(new Uint8Array([102, 111, 111])); // foo
    await writeSync(new Uint8Array([98, 97, 114])); // bar
    await writeSync(new Uint8Array([230, 150, 135])); // 文
    lineEquals(0, 'foobar文');
  });

  it('write - bytes (UTF8) with callback', async () => {
    let result: string | undefined;
    await new Promise<void>(r => {
      term.write(new Uint8Array([102, 111, 111]), () => { result = 'A'; }); // foo
      term.write(new Uint8Array([98, 97, 114]), () => { result += 'B'; }); // bar
      term.write(new Uint8Array([230, 150, 135]), () => { // 文
        result += 'C';
        r();
      });
    });
    lineEquals(0, 'foobar文');
    strictEqual(result, 'ABC');
  });

  it('writeln', async () => {
    await writelnSync('foo');
    await writelnSync('bar');
    await writelnSync('文');
    lineEquals(0, 'foo');
    lineEquals(1, 'bar');
    lineEquals(2, '文');
  });

  it('writeln with callback', async () => {
    let result: string | undefined;
    await new Promise<void>(r => {
      term.writeln('foo', () => { result = '1'; });
      term.writeln('bar', () => { result += '2'; });
      term.writeln('文', () => {
        result += '3';
        r();
      });
    });
    lineEquals(0, 'foo');
    lineEquals(1, 'bar');
    lineEquals(2, '文');
    strictEqual(result, '123');
  });

  it('writeln - bytes (UTF8)', async () => {
    await writelnSync(new Uint8Array([102, 111, 111]));
    await writelnSync(new Uint8Array([98, 97, 114]));
    await writelnSync(new Uint8Array([230, 150, 135]));
    lineEquals(0, 'foo');
    lineEquals(1, 'bar');
    lineEquals(2, '文');
  });

  it('clear', async () => {
    term = new Terminal({ rows: 5 });
    for (let i = 0; i < 10; i++) {
      await writeSync('\n\rtest' + i);
    }
    term.clear();
    strictEqual(term.buffer.active.length, 5);
    lineEquals(0, 'test9');
    for (let i = 1; i < 5; i++) {
      lineEquals(i, '');
    }
  });

  //  it('getOption, setOption', async () => {
  //    await openTerminal(page);
  //    assert.equal(await page.evaluate(`window.term.getOption('rendererType')`), 'canvas');
  //    await page.evaluate(`window.term.setOption('rendererType', 'dom')`);
  //    assert.equal(await page.evaluate(`window.term.getOption('rendererType')`), 'dom');
  //  });

  //  describe('renderer', () => {
  //    it('foreground', async () => {
  //      await openTerminal(page, { rendererType: 'dom' });
  //      await writeSync(page, '\\x1b[30m0\\x1b[31m1\\x1b[32m2\\x1b[33m3\\x1b[34m4\\x1b[35m5\\x1b[36m6\\x1b[37m7');
  //      await pollFor(page, `document.querySelectorAll('.xterm-rows > :nth-child(1) > *').length`, 9);
  //      assert.deepEqual(await page.evaluate(`
  //        [
  //          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(1)').className,
  //          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(2)').className,
  //          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(3)').className,
  //          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(4)').className,
  //          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(5)').className,
  //          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(6)').className,
  //          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(7)').className
  //        ]
  //      `), [
  //        'xterm-fg-0',
  //        'xterm-fg-1',
  //        'xterm-fg-2',
  //        'xterm-fg-3',
  //        'xterm-fg-4',
  //        'xterm-fg-5',
  //        'xterm-fg-6'
  //      ]);
  //    });

  //    it('background', async () => {
  //      await openTerminal(page, { rendererType: 'dom' });
  //      await writeSync(page, '\\x1b[40m0\\x1b[41m1\\x1b[42m2\\x1b[43m3\\x1b[44m4\\x1b[45m5\\x1b[46m6\\x1b[47m7');
  //      await pollFor(page, `document.querySelectorAll('.xterm-rows > :nth-child(1) > *').length`, 9);
  //      assert.deepEqual(await page.evaluate(`
  //        [
  //          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(1)').className,
  //          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(2)').className,
  //          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(3)').className,
  //          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(4)').className,
  //          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(5)').className,
  //          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(6)').className,
  //          document.querySelector('.xterm-rows > :nth-child(1) > :nth-child(7)').className
  //        ]
  //      `), [
  //        'xterm-bg-0',
  //        'xterm-bg-1',
  //        'xterm-bg-2',
  //        'xterm-bg-3',
  //        'xterm-bg-4',
  //        'xterm-bg-5',
  //        'xterm-bg-6'
  //      ]);
  //    });
  //  });

  //  it('selection', async () => {
  //    await openTerminal(page, { rows: 5, cols: 5 });
  //    await writeSync(page, `\\n\\nfoo\\n\\n\\rbar\\n\\n\\rbaz`);
  //    assert.equal(await page.evaluate(`window.term.hasSelection()`), false);
  //    assert.equal(await page.evaluate(`window.term.getSelection()`), '');
  //    assert.deepEqual(await page.evaluate(`window.term.getSelectionPosition()`), undefined);
  //    await page.evaluate(`window.term.selectAll()`);
  //    assert.equal(await page.evaluate(`window.term.hasSelection()`), true);
  //    if (process.platform === 'win32') {
  //      assert.equal(await page.evaluate(`window.term.getSelection()`), '\r\n\r\nfoo\r\n\r\nbar\r\n\r\nbaz');
  //    } else {
  //      assert.equal(await page.evaluate(`window.term.getSelection()`), '\n\nfoo\n\nbar\n\nbaz');
  //    }
  //    assert.deepEqual(await page.evaluate(`window.term.getSelectionPosition()`), { startColumn: 0, startRow: 0, endColumn: 5, endRow: 6 });
  //    await page.evaluate(`window.term.clearSelection()`);
  //    assert.equal(await page.evaluate(`window.term.hasSelection()`), false);
  //    assert.equal(await page.evaluate(`window.term.getSelection()`), '');
  //    assert.deepEqual(await page.evaluate(`window.term.getSelectionPosition()`), undefined);
  //    await page.evaluate(`window.term.select(1, 2, 2)`);
  //    assert.equal(await page.evaluate(`window.term.hasSelection()`), true);
  //    assert.equal(await page.evaluate(`window.term.getSelection()`), 'oo');
  //    assert.deepEqual(await page.evaluate(`window.term.getSelectionPosition()`), { startColumn: 1, startRow: 2, endColumn: 3, endRow: 2 });
  //  });

  //  it('focus, blur', async () => {
  //    await openTerminal(page);
  //    assert.equal(await page.evaluate(`document.activeElement.className`), '');
  //    await page.evaluate(`window.term.focus()`);
  //    assert.equal(await page.evaluate(`document.activeElement.className`), 'xterm-helper-textarea');
  //    await page.evaluate(`window.term.blur()`);
  //    assert.equal(await page.evaluate(`document.activeElement.className`), '');
  //  });

  //  describe('loadAddon', () => {
  //    it('constructor', async () => {
  //      await openTerminal(page, { cols: 5 });
  //      await page.evaluate(`
  //        window.cols = 0;
  //        window.term.loadAddon({
  //          activate: (t) => window.cols = t.cols,
  //          dispose: () => {}
  //        });
  //      `);
  //      assert.equal(await page.evaluate(`window.cols`), 5);
  //    });

  //    it('dispose (addon)', async () => {
  //      await openTerminal(page);
  //      await page.evaluate(`
  //        window.disposeCalled = false
  //        window.addon = {
  //          activate: () => {},
  //          dispose: () => window.disposeCalled = true
  //        };
  //        window.term.loadAddon(window.addon);
  //      `);
  //      assert.equal(await page.evaluate(`window.disposeCalled`), false);
  //      await page.evaluate(`window.addon.dispose()`);
  //      assert.equal(await page.evaluate(`window.disposeCalled`), true);
  //    });

  //    it('dispose (terminal)', async () => {
  //      await openTerminal(page);
  //      await page.evaluate(`
  //        window.disposeCalled = false
  //        window.term.loadAddon({
  //          activate: () => {},
  //          dispose: () => window.disposeCalled = true
  //        });
  //      `);
  //      assert.equal(await page.evaluate(`window.disposeCalled`), false);
  //      await page.evaluate(`window.term.dispose()`);
  //      assert.equal(await page.evaluate(`window.disposeCalled`), true);
  //    });
  //  });

  //  describe('Events', () => {
  //    it('onCursorMove', async () => {
  //      await openTerminal(page);
  //      await page.evaluate(`
  //        window.callCount = 0;
  //        window.term.onCursorMove(e => window.callCount++);
  //        window.term.write('foo');
  //      `);
  //      await pollFor(page, `window.callCount`, 1);
  //      await page.evaluate(`window.term.write('bar')`);
  //      await pollFor(page, `window.callCount`, 2);
  //    });

  //    it('onData', async () => {
  //      await openTerminal(page);
  //      await page.evaluate(`
  //        window.calls = [];
  //        window.term.onData(e => calls.push(e));
  //      `);
  //      await page.type('.xterm-helper-textarea', 'foo');
  //      assert.deepEqual(await page.evaluate(`window.calls`), ['f', 'o', 'o']);
  //    });

  //    it('onKey', async () => {
  //      await openTerminal(page);
  //      await page.evaluate(`
  //        window.calls = [];
  //        window.term.onKey(e => calls.push(e.key));
  //      `);
  //      await page.type('.xterm-helper-textarea', 'foo');
  //      assert.deepEqual(await page.evaluate(`window.calls`), ['f', 'o', 'o']);
  //    });

  //    it('onLineFeed', async () => {
  //      await openTerminal(page);
  //      await page.evaluate(`
  //        window.callCount = 0;
  //        window.term.onLineFeed(() => callCount++);
  //        window.term.writeln('foo');
  //      `);
  //      await pollFor(page, `window.callCount`, 1);
  //      await page.evaluate(`window.term.writeln('bar')`);
  //      await pollFor(page, `window.callCount`, 2);
  //    });

  //    it('onScroll', async () => {
  //      await openTerminal(page, { rows: 5 });
  //      await page.evaluate(`
  //        window.calls = [];
  //        window.term.onScroll(e => window.calls.push(e));
  //        for (let i = 0; i < 4; i++) {
  //          window.term.writeln('foo');
  //        }
  //      `);
  //      await pollFor(page, `window.calls`, []);
  //      await page.evaluate(`window.term.writeln('bar')`);
  //      await pollFor(page, `window.calls`, [1]);
  //      await page.evaluate(`window.term.writeln('baz')`);
  //      await pollFor(page, `window.calls`, [1, 2]);
  //    });

  //    it('onSelectionChange', async () => {
  //      await openTerminal(page);
  //      await page.evaluate(`
  //        window.callCount = 0;
  //        window.term.onSelectionChange(() => window.callCount++);
  //      `);
  //      await pollFor(page, `window.callCount`, 0);
  //      await page.evaluate(`window.term.selectAll()`);
  //      await pollFor(page, `window.callCount`, 1);
  //      await page.evaluate(`window.term.clearSelection()`);
  //      await pollFor(page, `window.callCount`, 2);
  //    });

  //    it('onRender', async function(): Promise<void> {
  //      this.retries(3);
  //      await openTerminal(page);
  //      await timeout(20); // Ensure all init events are fired
  //      await page.evaluate(`
  //        window.calls = [];
  //        window.term.onRender(e => window.calls.push([e.start, e.end]));
  //      `);
  //      await pollFor(page, `window.calls`, []);
  //      await page.evaluate(`window.term.write('foo')`);
  //      await pollFor(page, `window.calls`, [[0, 0]]);
  //      await page.evaluate(`window.term.write('bar\\n\\nbaz')`);
  //      await pollFor(page, `window.calls`, [[0, 0], [0, 2]]);
  //    });

  //    it('onResize', async () => {
  //      await openTerminal(page);
  //      await timeout(20); // Ensure all init events are fired
  //      await page.evaluate(`
  //        window.calls = [];
  //        window.term.onResize(e => window.calls.push([e.cols, e.rows]));
  //      `);
  //      await pollFor(page, `window.calls`, []);
  //      await page.evaluate(`window.term.resize(10, 5)`);
  //      await pollFor(page, `window.calls`, [[10, 5]]);
  //      await page.evaluate(`window.term.resize(20, 15)`);
  //      await pollFor(page, `window.calls`, [[10, 5], [20, 15]]);
  //    });

  //    it('onTitleChange', async () => {
  //      await openTerminal(page);
  //      await page.evaluate(`
  //        window.calls = [];
  //        window.term.onTitleChange(e => window.calls.push(e));
  //      `);
  //      await pollFor(page, `window.calls`, []);
  //      await page.evaluate(`window.term.write('\\x1b]2;foo\\x9c')`);
  //      await pollFor(page, `window.calls`, ['foo']);
  //    });
  //    it('onBell', async () => {
  //      await openTerminal(page);
  //      await page.evaluate(`
  //        window.calls = [];
  //        window.term.onBell(() => window.calls.push(true));
  //      `);
  //      await pollFor(page, `window.calls`, []);
  //      await page.evaluate(`window.term.write('\\x07')`);
  //      await pollFor(page, `window.calls`, [true]);
  //    });
  //  });

  //  describe('buffer', () => {
  //    it('cursorX, cursorY', async () => {
  //      await openTerminal(page, { rows: 5, cols: 5 });
  //      assert.equal(await page.evaluate(`window.term.buffer.active.cursorX`), 0);
  //      assert.equal(await page.evaluate(`window.term.buffer.active.cursorY`), 0);
  //      await writeSync(page, 'foo');
  //      assert.equal(await page.evaluate(`window.term.buffer.active.cursorX`), 3);
  //      assert.equal(await page.evaluate(`window.term.buffer.active.cursorY`), 0);
  //      await writeSync(page, '\\n');
  //      assert.equal(await page.evaluate(`window.term.buffer.active.cursorX`), 3);
  //      assert.equal(await page.evaluate(`window.term.buffer.active.cursorY`), 1);
  //      await writeSync(page, '\\r');
  //      assert.equal(await page.evaluate(`window.term.buffer.active.cursorX`), 0);
  //      assert.equal(await page.evaluate(`window.term.buffer.active.cursorY`), 1);
  //      await writeSync(page, 'abcde');
  //      assert.equal(await page.evaluate(`window.term.buffer.active.cursorX`), 5);
  //      assert.equal(await page.evaluate(`window.term.buffer.active.cursorY`), 1);
  //      await writeSync(page, '\\n\\r\\n\\n\\n\\n\\n');
  //      assert.equal(await page.evaluate(`window.term.buffer.active.cursorX`), 0);
  //      assert.equal(await page.evaluate(`window.term.buffer.active.cursorY`), 4);
  //    });

  //    it('viewportY', async () => {
  //      await openTerminal(page, { rows: 5 });
  //      assert.equal(await page.evaluate(`window.term.buffer.active.viewportY`), 0);
  //      await writeSync(page, '\\n\\n\\n\\n');
  //      assert.equal(await page.evaluate(`window.term.buffer.active.viewportY`), 0);
  //      await writeSync(page, '\\n');
  //      assert.equal(await page.evaluate(`window.term.buffer.active.viewportY`), 1);
  //      await writeSync(page, '\\n\\n\\n\\n');
  //      assert.equal(await page.evaluate(`window.term.buffer.active.viewportY`), 5);
  //      await page.evaluate(`window.term.scrollLines(-1)`);
  //      assert.equal(await page.evaluate(`window.term.buffer.active.viewportY`), 4);
  //      await page.evaluate(`window.term.scrollToTop()`);
  //      assert.equal(await page.evaluate(`window.term.buffer.active.viewportY`), 0);
  //    });

  //    it('baseY', async () => {
  //      await openTerminal(page, { rows: 5 });
  //      assert.equal(await page.evaluate(`window.term.buffer.active.baseY`), 0);
  //      await writeSync(page, '\\n\\n\\n\\n');
  //      assert.equal(await page.evaluate(`window.term.buffer.active.baseY`), 0);
  //      await writeSync(page, '\\n');
  //      assert.equal(await page.evaluate(`window.term.buffer.active.baseY`), 1);
  //      await writeSync(page, '\\n\\n\\n\\n');
  //      assert.equal(await page.evaluate(`window.term.buffer.active.baseY`), 5);
  //      await page.evaluate(`window.term.scrollLines(-1)`);
  //      assert.equal(await page.evaluate(`window.term.buffer.active.baseY`), 5);
  //      await page.evaluate(`window.term.scrollToTop()`);
  //      assert.equal(await page.evaluate(`window.term.buffer.active.baseY`), 5);
  //    });

  //    it('length', async () => {
  //      await openTerminal(page, { rows: 5 });
  //      assert.equal(await page.evaluate(`window.term.buffer.active.length`), 5);
  //      await writeSync(page, '\\n\\n\\n\\n');
  //      assert.equal(await page.evaluate(`window.term.buffer.active.length`), 5);
  //      await writeSync(page, '\\n');
  //      assert.equal(await page.evaluate(`window.term.buffer.active.length`), 6);
  //      await writeSync(page, '\\n\\n\\n\\n');
  //      assert.equal(await page.evaluate(`window.term.buffer.active.length`), 10);
  //    });

  //    describe('getLine', () => {
  //      it('invalid index', async () => {
  //        await openTerminal(page, { rows: 5 });
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(-1)`), undefined);
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(5)`), undefined);
  //      });

  //      it('isWrapped', async () => {
  //        await openTerminal(page, { cols: 5 });
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).isWrapped`), false);
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(1).isWrapped`), false);
  //        await writeSync(page, 'abcde');
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).isWrapped`), false);
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(1).isWrapped`), false);
  //        await writeSync(page, 'f');
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).isWrapped`), false);
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(1).isWrapped`), true);
  //      });

  //      it('translateToString', async () => {
  //        await openTerminal(page, { cols: 5 });
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), '     ');
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString(true)`), '');
  //        await writeSync(page, 'foo');
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), 'foo  ');
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString(true)`), 'foo');
  //        await writeSync(page, 'bar');
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), 'fooba');
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString(true)`), 'fooba');
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(1).translateToString(true)`), 'r');
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString(false, 1)`), 'ooba');
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString(false, 1, 3)`), 'oo');
  //      });

  //      it('getCell', async () => {
  //        await openTerminal(page, { cols: 5 });
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(-1)`), undefined);
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(5)`), undefined);
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(0).getChars()`), '');
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(0).getWidth()`), 1);
  //        await writeSync(page, 'a文');
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(0).getChars()`), 'a');
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(0).getWidth()`), 1);
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(1).getChars()`), '文');
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(1).getWidth()`), 2);
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(2).getChars()`), '');
  //        assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).getCell(2).getWidth()`), 0);
  //      });
  //    });

  //    it('active, normal, alternate', async () => {
  //      await openTerminal(page, { cols: 5 });
  //      assert.equal(await page.evaluate(`window.term.buffer.active.type`), 'normal');
  //      assert.equal(await page.evaluate(`window.term.buffer.normal.type`), 'normal');
  //      assert.equal(await page.evaluate(`window.term.buffer.alternate.type`), 'alternate');

  //      await writeSync(page, 'norm ');
  //      assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), 'norm ');
  //      assert.equal(await page.evaluate(`window.term.buffer.normal.getLine(0).translateToString()`), 'norm ');
  //      assert.equal(await page.evaluate(`window.term.buffer.alternate.getLine(0)`), undefined);

  //      await writeSync(page, '\\x1b[?47h\\r'); // use alternate screen buffer
  //      assert.equal(await page.evaluate(`window.term.buffer.active.type`), 'alternate');
  //      assert.equal(await page.evaluate(`window.term.buffer.normal.type`), 'normal');
  //      assert.equal(await page.evaluate(`window.term.buffer.alternate.type`), 'alternate');

  //      assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), '     ');
  //      await writeSync(page, 'alt  ');
  //      assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), 'alt  ');
  //      assert.equal(await page.evaluate(`window.term.buffer.normal.getLine(0).translateToString()`), 'norm ');
  //      assert.equal(await page.evaluate(`window.term.buffer.alternate.getLine(0).translateToString()`), 'alt  ');

  //      await writeSync(page, '\\x1b[?47l\\r'); // use normal screen buffer
  //      assert.equal(await page.evaluate(`window.term.buffer.active.type`), 'normal');
  //      assert.equal(await page.evaluate(`window.term.buffer.normal.type`), 'normal');
  //      assert.equal(await page.evaluate(`window.term.buffer.alternate.type`), 'alternate');

  //      assert.equal(await page.evaluate(`window.term.buffer.active.getLine(0).translateToString()`), 'norm ');
  //      assert.equal(await page.evaluate(`window.term.buffer.normal.getLine(0).translateToString()`), 'norm ');
  //      assert.equal(await page.evaluate(`window.term.buffer.alternate.getLine(0)`), undefined);
  //    });
  //  });

  //  it('dispose', async () => {
  //    await page.evaluate(`
  //      window.term = new Terminal();
  //      window.term.dispose();
  //    `);
  //    assert.equal(await page.evaluate(`window.term._core._isDisposed`), true);
  //  });

  //  it('dispose (opened)', async () => {
  //    await openTerminal(page);
  //    await page.evaluate(`window.term.dispose()`);
  //    assert.equal(await page.evaluate(`window.term._core._isDisposed`), true);
  //  });
});

function writeSync(text: string | Uint8Array): Promise<void> {
  return new Promise<void>(r => term.write(text, r));
}

function writelnSync(text: string | Uint8Array): Promise<void> {
  return new Promise<void>(r => term.writeln(text, r));
}

function lineEquals(index: number, text: string): void {
  strictEqual(term.buffer.active.getLine(index)!.translateToString(true), text);
}
