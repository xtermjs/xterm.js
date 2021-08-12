/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { deepStrictEqual, strictEqual, throws } from 'assert';
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

  it('getOption, setOption', async () => {
    strictEqual(term.getOption('scrollback'), 1000);
    term.setOption('scrollback', 50);
    strictEqual(term.getOption('scrollback'), 50);
  });

  describe('loadAddon', () => {
    it('constructor', async () => {
      term = new Terminal({ cols: 5 });
      let cols = 0;
      term.loadAddon({
        activate: (t) => cols = t.cols,
        dispose: () => {}
      });
      strictEqual(cols, 5);
    });

    it('dispose (addon)', async () => {
      let disposeCalled = false;
      const addon = {
        activate: () => {},
        dispose: () => disposeCalled = true
      };
      term.loadAddon(addon);
      strictEqual(disposeCalled, false);
      addon.dispose();
      strictEqual(disposeCalled, true);
    });

    it('dispose (terminal)', async () => {
      let disposeCalled = false;
      term.loadAddon({
        activate: () => {},
        dispose: () => disposeCalled = true
      });
      strictEqual(disposeCalled, false);
      term.dispose();
      strictEqual(disposeCalled, true);
    });
  });

  describe('Events', () => {
    it('onCursorMove', async () => {
      let callCount = 0;
      term.onCursorMove(e => callCount++);
      await writeSync('foo');
      strictEqual(callCount, 1);
      await writeSync('bar');
      strictEqual(callCount, 2);
    });

    it('onData', async () => {
      const calls: string[] = [];
      term.onData(e => calls.push(e));
      await writeSync('\x1b[5n'); // DSR Status Report
      deepStrictEqual(calls, ['\x1b[0n']);
    });

    it('onLineFeed', async () => {
      let callCount = 0;
      term.onLineFeed(() => callCount++);
      await writelnSync('foo');
      strictEqual(callCount, 1);
      await writelnSync('bar');
      strictEqual(callCount, 2);
    });

    it('onScroll', async () => {
      term = new Terminal({ rows: 5 });
      const calls: number[] = [];
      term.onScroll(e => calls.push(e));
      for (let i = 0; i < 4; i++) {
        await writelnSync('foo');
      }
      deepStrictEqual(calls, []);
      await writelnSync('bar');
      deepStrictEqual(calls, [1]);
      await writelnSync('baz');
      deepStrictEqual(calls, [1, 2]);
    });

    it('onResize', async () => {
      const calls: [number, number][] = [];
      term.onResize(e => calls.push([e.cols, e.rows]));
      deepStrictEqual(calls, []);
      term.resize(10, 5);
      deepStrictEqual(calls, [[10, 5]]);
      term.resize(20, 15);
      deepStrictEqual(calls, [[10, 5], [20, 15]]);
    });

    it('onTitleChange', async () => {
      const calls: string[] = [];
      term.onTitleChange(e => calls.push(e));
      deepStrictEqual(calls, []);
      await writeSync('\x1b]2;foo\x9c');
      deepStrictEqual(calls, ['foo']);
    });

    it('onBell', async () => {
      const calls: boolean[] = [];
      term.onBell(() => calls.push(true));
      deepStrictEqual(calls, []);
      await writeSync('\x07');
      deepStrictEqual(calls, [true]);
    });
  });

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
