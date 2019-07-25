/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as puppeteer from 'puppeteer';
import * as assert from 'assert';
import { ITerminalOptions } from 'xterm';

const APP = 'http://127.0.0.1:3000/test';

let browser: puppeteer.Browser;
let page: puppeteer.Page;
const width = 800;
const height = 600;

describe('CharWidth Integration Tests', function(): void {
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
    await openTerminal({ rows: 5, cols: 30 });
  });

  after(() => {
    browser.close();
  });

  describe('getStringCellWidth', () => {
    beforeEach(async () => {
      await page.evaluate(`window.term.reset()`);
    });

    it('ASCII chars', async function(): Promise<void> {
      const input = 'This is just ASCII text.#';
      await page.evaluate(`window.term.write('${input}')`);
      assert.equal(25, await sumWidths(0, 1, '#'));
    });

    it('combining chars', async function(): Promise<void> {
      const input = 'e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301#';
      await page.evaluate(`window.term.write('${input}')`);
      assert.equal(10, await sumWidths(0, 1, '#'));
    });

    it('surrogate chars', async function(): Promise<void> {
      const input = '𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞#';
      await page.evaluate(`window.term.write('${input}')`);
      assert.equal(28, await sumWidths(0, 1, '#'));
    });

    it('surrogate combining chars', async function(): Promise<void> {
      const input = '𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301#';
      await page.evaluate(`window.term.write('${input}')`);
      assert.equal(12, await sumWidths(0, 1, '#'));
    });

    it('fullwidth chars', async function(): Promise<void> {
      const input = '１２３４５６７８９０#';
      await page.evaluate(`window.term.write('${input}')`);
      assert.equal(21, await sumWidths(0, 1, '#'));
    });

    it('fullwidth chars offset 1', async function(): Promise<void> {
      const input = 'a１２３４５６７８９０#';
      await page.evaluate(`window.term.write('${input}')`);
      assert.equal(22, await sumWidths(0, 1, '#'));
    });

    // TODO: multiline tests once #1685 is resolved
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

async function sumWidths(start: number, end: number, sentinel: string): Promise<number> {
  await page.evaluate(`
    (function() {
      window.result = 0;
      const buffer = window.term.buffer;
      for (let i = ${start}; i < ${end}; i++) {
        const line = buffer.getLine(i);
        let j = 0;
        while (true) {
          const cell = line.getCell(j++);
          if (!cell) {
            break;
          }
          window.result += cell.width;
          if (cell.char === '${sentinel}') {
            return;
          }
        }
      }
    })();
  `);
  return await page.evaluate(`window.result`);
}
