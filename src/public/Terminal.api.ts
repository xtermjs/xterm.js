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
