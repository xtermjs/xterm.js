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

describe('Parser Integration Tests', function(): void {
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

  describe('addCsiHandler', () => {
    it('should call custom CSI handler with js array params', async () => {
      await page.evaluate(`
        window.term.reset();
        const _customCsiHandlerParams = [];
        const _customCsiHandler = window.term.parser.addCsiHandler({final: 'm'}, (params, collect) => {
          _customCsiHandlerParams.push(params);
          return false;
        }, '');
      `);
      await page.evaluate(`
        window.term.write('\x1b[38;5;123mparams\x1b[38:2::50:100:150msubparams');
      `);
      assert.deepEqual(await page.evaluate(`(() => _customCsiHandlerParams)();`), [[38, 5, 123], [38, [2, -1, 50, 100, 150]]]);
    });
  });
  describe('addDcsHandler', () => {
    it('should respects return value', async () => {
      await page.evaluate(`
        window.term.reset();
        const _customDcsHandlerCallStack = [];
        const _customDcsHandlerA = window.term.parser.addDcsHandler({intermediates:'+', final: 'p'}, (data, params) => {
          _customDcsHandlerCallStack.push(['A', params, data]);
          return false;
        });
        const _customDcsHandlerB = window.term.parser.addDcsHandler({intermediates:'+', final: 'p'}, (data, params) => {
          _customDcsHandlerCallStack.push(['B', params, data]);
          return true;
        });
        const _customDcsHandlerC = window.term.parser.addDcsHandler({intermediates:'+', final: 'p'}, (data, params) => {
          _customDcsHandlerCallStack.push(['C', params, data]);
          return false;
        });
      `);
      await page.evaluate(`
        window.term.write('\x1bP1;2+psome data\x1b\\\\');
      `);
      assert.deepEqual(await page.evaluate(`(() => _customDcsHandlerCallStack)();`), [['C', [1, 2], 'some data'], ['B', [1, 2], 'some data']]);
    });
  });
  describe('addEscHandler', () => {
    it('should respects return value', async () => {
      await page.evaluate(`
        window.term.reset();
        const _customEscHandlerCallStack = [];
        const _customEscHandlerA = window.term.parser.addEscHandler({intermediates:'(', final: 'B'}, () => {
          _customEscHandlerCallStack.push('A');
          return false;
        });
        const _customEscHandlerB = window.term.parser.addEscHandler({intermediates:'(', final: 'B'}, () => {
          _customEscHandlerCallStack.push('B');
          return true;
        });
        const _customEscHandlerC = window.term.parser.addEscHandler({intermediates:'(', final: 'B'}, () => {
          _customEscHandlerCallStack.push('C');
          return false;
        });
      `);
      await page.evaluate(`
        window.term.write('\x1b(B');
      `);
      assert.deepEqual(await page.evaluate(`(() => _customEscHandlerCallStack)();`), ['C', 'B']);
    });
  });
  describe('addOscHandler', () => {
    it('should respects return value', async () => {
      await page.evaluate(`
        window.term.reset();
        const _customOscHandlerCallStack = [];
        const _customOscHandlerA = window.term.parser.addOscHandler(1234, data => {
          _customOscHandlerCallStack.push(['A', data]);
          return false;
        });
        const _customOscHandlerB = window.term.parser.addOscHandler(1234, data => {
          _customOscHandlerCallStack.push(['B', data]);
          return true;
        });
        const _customOscHandlerC = window.term.parser.addOscHandler(1234, data => {
          _customOscHandlerCallStack.push(['C', data]);
          return false;
        });
      `);
      await page.evaluate(`
        window.term.write('\x1b]1234;some data\x07');
      `);
      assert.deepEqual(await page.evaluate(`(() => _customOscHandlerCallStack)();`), [['C', 'some data'], ['B', 'some data']]);
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
