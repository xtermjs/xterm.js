/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { writeSync, openTerminal, getBrowserType } from './TestUtils';
import { Browser, Page } from 'playwright';

const APP = 'http://127.0.0.1:3000/test';

let browser: Browser;
let page: Page;
const width = 800;
const height = 600;

describe('Parser Integration Tests', function(): void {
  before(async function(): Promise<any> {
    const browserType = getBrowserType();
    browser = await browserType.launch({
      headless: process.argv.indexOf('--headless') !== -1
    });
    page = await (await browser.newContext()).newPage();
    await page.setViewportSize({ width, height });
    await page.goto(APP);
    await openTerminal(page);
  });

  after(async () => browser.close());

  describe('registerCsiHandler', () => {
    it('should call custom CSI handler with js array params', async () => {
      await page.evaluate(`
        window.term.reset();
        window._customCsiHandlerParams = [];
        const _customCsiHandler = window.term.parser.registerCsiHandler({final: 'm'}, (params, collect) => {
          window._customCsiHandlerParams.push(params);
          return false;
        }, '');
      `);
      await writeSync(page, '\x1b[38;5;123mparams\x1b[38:2::50:100:150msubparams');
      assert.deepEqual(await page.evaluate(`(() => window._customCsiHandlerParams)();`), [[38, 5, 123], [38, [2, -1, 50, 100, 150]]]);
    });
  });
  describe('registerDcsHandler', () => {
    it('should respects return value', async () => {
      await page.evaluate(`
        window.term.reset();
        window._customDcsHandlerCallStack = [];
        const _customDcsHandlerA = window.term.parser.registerDcsHandler({intermediates:'+', final: 'p'}, (data, params) => {
          window._customDcsHandlerCallStack.push(['A', params, data]);
          return false;
        });
        const _customDcsHandlerB = window.term.parser.registerDcsHandler({intermediates:'+', final: 'p'}, (data, params) => {
          window._customDcsHandlerCallStack.push(['B', params, data]);
          return true;
        });
        const _customDcsHandlerC = window.term.parser.registerDcsHandler({intermediates:'+', final: 'p'}, (data, params) => {
          window._customDcsHandlerCallStack.push(['C', params, data]);
          return false;
        });
      `);
      await writeSync(page, '\x1bP1;2+psome data\x1b\\\\');
      assert.deepEqual(await page.evaluate(`(() => window._customDcsHandlerCallStack)();`), [['C', [1, 2], 'some data'], ['B', [1, 2], 'some data']]);
    });
  });
  describe('registerEscHandler', () => {
    it('should respects return value', async () => {
      await page.evaluate(`
        window.term.reset();
        window._customEscHandlerCallStack = [];
        const _customEscHandlerA = window.term.parser.registerEscHandler({intermediates:'(', final: 'B'}, () => {
          window._customEscHandlerCallStack.push('A');
          return false;
        });
        const _customEscHandlerB = window.term.parser.registerEscHandler({intermediates:'(', final: 'B'}, () => {
          window._customEscHandlerCallStack.push('B');
          return true;
        });
        const _customEscHandlerC = window.term.parser.registerEscHandler({intermediates:'(', final: 'B'}, () => {
          window._customEscHandlerCallStack.push('C');
          return false;
        });
      `);
      await writeSync(page, '\x1b(B');
      assert.deepEqual(await page.evaluate(`(() => window._customEscHandlerCallStack)();`), ['C', 'B']);
    });
  });
  describe('registerOscHandler', () => {
    it('should respects return value', async () => {
      await page.evaluate(`
        window.term.reset();
        window._customOscHandlerCallStack = [];
        const _customOscHandlerA = window.term.parser.registerOscHandler(1234, data => {
          window._customOscHandlerCallStack.push(['A', data]);
          return false;
        });
        const _customOscHandlerB = window.term.parser.registerOscHandler(1234, data => {
          window._customOscHandlerCallStack.push(['B', data]);
          return true;
        });
        const _customOscHandlerC = window.term.parser.registerOscHandler(1234, data => {
          window._customOscHandlerCallStack.push(['C', data]);
          return false;
        });
      `);
      await writeSync(page, '\x1b]1234;some data\x07');
      assert.deepEqual(await page.evaluate(`(() => window._customOscHandlerCallStack)();`), [['C', 'some data'], ['B', 'some data']]);
    });
  });
});
