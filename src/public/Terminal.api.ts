/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as puppeteer from 'puppeteer';
import { assert } from 'chai';
import { ITerminalOptions } from '../Types';

const APP = 'http://127.0.0.1:3000/test';

let browser: puppeteer.Browser;
let page: puppeteer.Page;
const width = 800;
const height = 600;

describe('API Integration Tests', () => {
  before(async function(): Promise<any> {
    this.timeout(10000);
    browser = await puppeteer.launch({
      headless: process.argv.indexOf('--headless') !== -1,
      slowMo: 80,
      args: [`--window-size=${width},${height}`]
    });
    page = (await browser.pages())[0];
    await page.setViewport({ width, height });
  });

  after(() => {
    browser.close();
  });

  beforeEach(async () => {
    await page.goto(APP);
  });

  it('Default options', async function(): Promise<any> {
    this.timeout(10000);
    await openTerminal();
    assert.equal(await page.evaluate(`window.term.cols`), 80);
    assert.equal(await page.evaluate(`window.term.rows`), 24);
  });

  it('write', async function(): Promise<any> {
    this.timeout(10000);
    await openTerminal();
    await page.evaluate(`
      window.term.write('foo');
      window.term.write('bar');
    `);
    assert.equal(await page.evaluate(`window.term._core.buffer.translateBufferLineToString(0, true)`), 'foobar');
  });

  it('writeln', async function(): Promise<any> {
    this.timeout(10000);
    await openTerminal();
    await page.evaluate(`
      window.term.writeln('foo');
      window.term.writeln('bar');
    `);
    assert.equal(await page.evaluate(`window.term._core.buffer.translateBufferLineToString(0, true)`), 'foo');
    assert.equal(await page.evaluate(`window.term._core.buffer.translateBufferLineToString(1, true)`), 'bar');
  });

  it('clear', async function(): Promise<any> {
    this.timeout(10000);
    await openTerminal({ rows: 5 });
    await page.evaluate(`
      window.term.write('test0');
      for (let i = 1; i < 10; i++) {
        window.term.write('\\n\\rtest' + i);
      }
    `);
    await page.evaluate(`window.term.clear()`);
    assert.equal(await page.evaluate(`window.term._core.buffer.lines.length`), '5');
    assert.equal(await page.evaluate(`window.term._core.buffer.translateBufferLineToString(0, true)`), 'test9');
    for (let i = 1; i < 5; i++) {
      assert.equal(await page.evaluate(`window.term._core.buffer.translateBufferLineToString(${i}, true)`), '');
    }
  });

  it('getOption, setOption', async function(): Promise<any> {
    this.timeout(10000);
    await openTerminal();
    assert.equal(await page.evaluate(`window.term.getOption('rendererType')`), 'canvas');
    await page.evaluate(`window.term.setOption('rendererType', 'dom')`);
    assert.equal(await page.evaluate(`window.term.getOption('rendererType')`), 'dom');
  });

  it('selection', async function(): Promise<any> {
    this.timeout(10000);
    await openTerminal({ rows: 5 });
    await page.evaluate(`window.term.write('\\n\\nfoo\\n\\n\\rbar\\n\\n\\rbaz')`);
    assert.equal(await page.evaluate(`window.term.hasSelection()`), false);
    assert.equal(await page.evaluate(`window.term.getSelection()`), '');
    await page.evaluate(`window.term.selectAll()`);
    assert.equal(await page.evaluate(`window.term.hasSelection()`), true);
    assert.equal(await page.evaluate(`window.term.getSelection()`), '\n\nfoo\n\nbar\n\nbaz');
    await page.evaluate(`window.term.clearSelection()`);
    assert.equal(await page.evaluate(`window.term.hasSelection()`), false);
    assert.equal(await page.evaluate(`window.term.getSelection()`), '');
  });

  describe('Events', () => {
    it('onCursorMove', async function(): Promise<any> {
      this.timeout(10000);
      await openTerminal();
      await page.evaluate(`
        window.callCount = 0;
        window.term.onCursorMove(e => window.callCount++);
        window.term.write('foo');
      `);
      assert.equal(await page.evaluate(`window.callCount`), 1);
      await page.evaluate(`window.term.write('bar')`);
      assert.equal(await page.evaluate(`window.callCount`), 2);
    });

    it('onData', async function(): Promise<any> {
      this.timeout(10000);
      await openTerminal();
      await page.evaluate(`
        window.calls = [];
        window.term.onData(e => calls.push(e));
      `);
      await page.type('.xterm-helper-textarea', 'foo');
      assert.deepEqual(await page.evaluate(`window.calls`), ['f', 'o', 'o']);
    });

    it('onKey', async function(): Promise<any> {
      this.timeout(10000);
      await openTerminal();
      await page.evaluate(`
        window.calls = [];
        window.term.onKey(e => calls.push(e.key));
      `);
      await page.type('.xterm-helper-textarea', 'foo');
      assert.deepEqual(await page.evaluate(`window.calls`), ['f', 'o', 'o']);
    });

    it('onLineFeed', async function(): Promise<any> {
      this.timeout(10000);
      await openTerminal();
      await page.evaluate(`
        window.callCount = 0;
        window.term.onLineFeed(() => callCount++);
        window.term.writeln('foo');
      `);
      assert.equal(await page.evaluate(`window.callCount`), 1);
      await page.evaluate(`window.term.writeln('bar')`);
      assert.equal(await page.evaluate(`window.callCount`), 2);
    });

    it('onScroll', async function(): Promise<any> {
      this.timeout(10000);
      await openTerminal({ rows: 5 });
      await page.evaluate(`
        window.calls = [];
        window.term.onScroll(e => window.calls.push(e));
        for (let i = 0; i < 4; i++) {
          window.term.writeln('foo');
        }
      `);
      assert.deepEqual(await page.evaluate(`window.calls`), []);
      await page.evaluate(`window.term.writeln('bar')`);
      assert.deepEqual(await page.evaluate(`window.calls`), [1]);
      await page.evaluate(`window.term.writeln('baz')`);
      assert.deepEqual(await page.evaluate(`window.calls`), [1, 2]);
    });

    it('onSelectionChange', async function(): Promise<any> {
      this.timeout(10000);
      await openTerminal();
      await page.evaluate(`
        window.callCount = 0;
        window.term.onSelectionChange(() => window.callCount++);
      `);
      assert.equal(await page.evaluate(`window.callCount`), 0);
      await page.evaluate(`window.term.selectAll()`);
      assert.equal(await page.evaluate(`window.callCount`), 1);
      await page.evaluate(`window.term.clearSelection()`);
      assert.equal(await page.evaluate(`window.callCount`), 2);
    });

    it('onRender', async function(): Promise<any> {
      this.timeout(10000);
      await openTerminal();
      await page.evaluate(`
        window.calls = [];
        window.term.onRender(e => window.calls.push([e.start, e.end]));
      `);
      assert.deepEqual(await page.evaluate(`window.calls`), []);
      await page.evaluate(`window.term.write('foo')`);
      assert.deepEqual(await page.evaluate(`window.calls`), [[0, 0]]);
      await page.evaluate(`window.term.write('bar\\n\\nbaz')`);
      assert.deepEqual(await page.evaluate(`window.calls`), [[0, 0], [0, 2]]);
    });

    it('onResize', async function(): Promise<any> {
      this.timeout(10000);
      await openTerminal();
      await page.evaluate(`
        window.calls = [];
        window.term.onResize(e => window.calls.push([e.cols, e.rows]));
      `);
      assert.deepEqual(await page.evaluate(`window.calls`), []);
      await page.evaluate(`window.term.resize(10, 5)`);
      assert.deepEqual(await page.evaluate(`window.calls`), [[10, 5]]);
      await page.evaluate(`window.term.resize(20, 15)`);
      assert.deepEqual(await page.evaluate(`window.calls`), [[10, 5], [20, 15]]);
    });

    it('onTitleChange', async function(): Promise<any> {
      this.timeout(10000);
      await openTerminal();
      await page.evaluate(`
        window.calls = [];
        window.term.onTitleChange(e => window.calls.push(e));
      `);
      assert.deepEqual(await page.evaluate(`window.calls`), []);
      await page.evaluate(`window.term.write('\\x1b]2;foo\\x9c')`);
      assert.deepEqual(await page.evaluate(`window.calls`), ['foo']);
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
