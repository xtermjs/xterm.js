/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as puppeteer from 'puppeteer';
import * as assert from 'assert';
import { ITerminalOptions } from '../../../src/Types';
import { ITheme } from 'xterm';

const APP = 'http://127.0.0.1:3000/test';

let browser: puppeteer.Browser;
let page: puppeteer.Page;
const width = 800;
const height = 600;

describe('WebGL Renderer Integration Tests', function(): void {
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
    await page.evaluate(`window.term.loadAddon(new WebglAddon(true));`);
  });

  after(() => {
    browser.close();
  });

  beforeEach(async () => {
    await page.evaluate(`window.term.reset()`);
  });

  describe('WebGL Renderer', () => {
    it('foreground colors normal', async function(): Promise<any> {
      const theme: ITheme = {
        black: '#010203',
        red: '#040506',
        green: '#070809',
        yellow: '#0a0b0c',
        blue: '#0d0e0f',
        magenta: '#101112',
        cyan: '#131415',
        white: '#161718'
      };
      await page.evaluate(`window.term.setOption('theme', ${JSON.stringify(theme)});`);
      await writeSync(`\\x1b[30m█\\x1b[31m█\\x1b[32m█\\x1b[33m█\\x1b[34m█\\x1b[35m█\\x1b[36m█\\x1b[37m█`);
      assert.deepEqual(await getCellColor(1, 1), [1, 2, 3, 255]);
      assert.deepEqual(await getCellColor(2, 1), [4, 5, 6, 255]);
      assert.deepEqual(await getCellColor(3, 1), [7, 8, 9, 255]);
      assert.deepEqual(await getCellColor(4, 1), [10, 11, 12, 255]);
      assert.deepEqual(await getCellColor(5, 1), [13, 14, 15, 255]);
      assert.deepEqual(await getCellColor(6, 1), [16, 17, 18, 255]);
      assert.deepEqual(await getCellColor(7, 1), [19, 20, 21, 255]);
      assert.deepEqual(await getCellColor(8, 1), [22, 23, 24, 255]);
    });

    it('foreground colors bright', async function(): Promise<any> {
      const theme: ITheme = {
        brightBlack: '#010203',
        brightRed: '#040506',
        brightGreen: '#070809',
        brightYellow: '#0a0b0c',
        brightBlue: '#0d0e0f',
        brightMagenta: '#101112',
        brightCyan: '#131415',
        brightWhite: '#161718'
      };
      await page.evaluate(`window.term.setOption('theme', ${JSON.stringify(theme)});`);
      await writeSync(`\\x1b[90m█\\x1b[91m█\\x1b[92m█\\x1b[93m█\\x1b[94m█\\x1b[95m█\\x1b[96m█\\x1b[97m█`);
      assert.deepEqual(await getCellColor(1, 1), [1, 2, 3, 255]);
      assert.deepEqual(await getCellColor(2, 1), [4, 5, 6, 255]);
      assert.deepEqual(await getCellColor(3, 1), [7, 8, 9, 255]);
      assert.deepEqual(await getCellColor(4, 1), [10, 11, 12, 255]);
      assert.deepEqual(await getCellColor(5, 1), [13, 14, 15, 255]);
      assert.deepEqual(await getCellColor(6, 1), [16, 17, 18, 255]);
      assert.deepEqual(await getCellColor(7, 1), [19, 20, 21, 255]);
      assert.deepEqual(await getCellColor(8, 1), [22, 23, 24, 255]);
    });

    it('background colors normal', async function(): Promise<any> {
      const theme: ITheme = {
        black: '#010203',
        red: '#040506',
        green: '#070809',
        yellow: '#0a0b0c',
        blue: '#0d0e0f',
        magenta: '#101112',
        cyan: '#131415',
        white: '#161718'
      };
      await page.evaluate(`window.term.setOption('theme', ${JSON.stringify(theme)});`);
      await writeSync(`\\x1b[40m \\x1b[41m \\x1b[42m \\x1b[43m \\x1b[44m \\x1b[45m \\x1b[46m \\x1b[47m `);
      assert.deepEqual(await getCellColor(1, 1), [1, 2, 3, 255]);
      assert.deepEqual(await getCellColor(2, 1), [4, 5, 6, 255]);
      assert.deepEqual(await getCellColor(3, 1), [7, 8, 9, 255]);
      assert.deepEqual(await getCellColor(4, 1), [10, 11, 12, 255]);
      assert.deepEqual(await getCellColor(5, 1), [13, 14, 15, 255]);
      assert.deepEqual(await getCellColor(6, 1), [16, 17, 18, 255]);
      assert.deepEqual(await getCellColor(7, 1), [19, 20, 21, 255]);
      assert.deepEqual(await getCellColor(8, 1), [22, 23, 24, 255]);
    });

    it('background colors bright', async function(): Promise<any> {
      const theme: ITheme = {
        brightBlack: '#010203',
        brightRed: '#040506',
        brightGreen: '#070809',
        brightYellow: '#0a0b0c',
        brightBlue: '#0d0e0f',
        brightMagenta: '#101112',
        brightCyan: '#131415',
        brightWhite: '#161718'
      };
      await page.evaluate(`window.term.setOption('theme', ${JSON.stringify(theme)});`);
      await writeSync(`\\x1b[100m \\x1b[101m \\x1b[102m \\x1b[103m \\x1b[104m \\x1b[105m \\x1b[106m \\x1b[107m `);
      assert.deepEqual(await getCellColor(1, 1), [1, 2, 3, 255]);
      assert.deepEqual(await getCellColor(2, 1), [4, 5, 6, 255]);
      assert.deepEqual(await getCellColor(3, 1), [7, 8, 9, 255]);
      assert.deepEqual(await getCellColor(4, 1), [10, 11, 12, 255]);
      assert.deepEqual(await getCellColor(5, 1), [13, 14, 15, 255]);
      assert.deepEqual(await getCellColor(6, 1), [16, 17, 18, 255]);
      assert.deepEqual(await getCellColor(7, 1), [19, 20, 21, 255]);
      assert.deepEqual(await getCellColor(8, 1), [22, 23, 24, 255]);
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

async function writeSync(data: string): Promise<void> {
  await page.evaluate(`window.term.write('${data}');`);
  while (true) {
    if (await page.evaluate(`window.term._core.writeBuffer.length === 0`)) {
      break;
    }
  }
}

async function getCellColor(col: number, row: number): Promise<number[]> {
  await page.evaluate(`
    window.gl = window.term._core._renderService._renderer._gl;
    window.result = new Uint8Array(4);
    window.d = window.term._core._renderService.dimensions;
    window.gl.readPixels(
      Math.floor((${col - 0.5}) * window.d.scaledCellWidth),
      Math.floor(window.gl.drawingBufferHeight - 1 - (${row - 0.5}) * window.d.scaledCellHeight),
      1, 1, window.gl.RGBA, window.gl.UNSIGNED_BYTE, window.result
    );
  `);
  return await page.evaluate(`Array.from(window.result)`);
}
