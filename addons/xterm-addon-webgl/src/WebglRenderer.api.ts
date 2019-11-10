/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as puppeteer from 'puppeteer';
import { ITerminalOptions } from '../../../src/Types';
import { ITheme } from 'xterm';
import { assert } from 'chai';
import deepEqual = require('deep-equal');

const APP = 'http://127.0.0.1:3000/test';

let browser: puppeteer.Browser;
let page: puppeteer.Page;
const width = 800;
const height = 600;

describe.only('WebGL Renderer Integration Tests', function(): void {
  it('dispose removes renderer canvases', async () => {
    await setupBrowser();
    assert.equal(await page.evaluate(`document.querySelectorAll('.xterm canvas').length`), 3);
    await page.evaluate(`addon.dispose()`);
    assert.equal(await page.evaluate(`document.querySelectorAll('.xterm canvas').length`), 0);
    await browser.close();
  });

  describe('colors', () => {
    before(async () => setupBrowser());
    after(async () => browser.close());
    beforeEach(async () => page.evaluate(`window.term.reset()`));

    it('foreground 0-15', async () => {
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
      await pollFor(page, () => getCellColor(1, 1), [1, 2, 3, 255]);
      await pollFor(page, () => getCellColor(2, 1), [4, 5, 6, 255]);
      await pollFor(page, () => getCellColor(3, 1), [7, 8, 9, 255]);
      await pollFor(page, () => getCellColor(4, 1), [10, 11, 12, 255]);
      await pollFor(page, () => getCellColor(5, 1), [13, 14, 15, 255]);
      await pollFor(page, () => getCellColor(6, 1), [16, 17, 18, 255]);
      await pollFor(page, () => getCellColor(7, 1), [19, 20, 21, 255]);
      await pollFor(page, () => getCellColor(8, 1), [22, 23, 24, 255]);
    });

    it('background 0-15', async () => {
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
      await pollFor(page, () => getCellColor(1, 1), [1, 2, 3, 255]);
      await pollFor(page, () => getCellColor(2, 1), [4, 5, 6, 255]);
      await pollFor(page, () => getCellColor(3, 1), [7, 8, 9, 255]);
      await pollFor(page, () => getCellColor(4, 1), [10, 11, 12, 255]);
      await pollFor(page, () => getCellColor(5, 1), [13, 14, 15, 255]);
      await pollFor(page, () => getCellColor(6, 1), [16, 17, 18, 255]);
      await pollFor(page, () => getCellColor(7, 1), [19, 20, 21, 255]);
      await pollFor(page, () => getCellColor(8, 1), [22, 23, 24, 255]);
    });

    it('foreground 0-15 bright', async () => {
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
      await pollFor(page, () => getCellColor(1, 1), [1, 2, 3, 255]);
      await pollFor(page, () => getCellColor(2, 1), [4, 5, 6, 255]);
      await pollFor(page, () => getCellColor(3, 1), [7, 8, 9, 255]);
      await pollFor(page, () => getCellColor(4, 1), [10, 11, 12, 255]);
      await pollFor(page, () => getCellColor(5, 1), [13, 14, 15, 255]);
      await pollFor(page, () => getCellColor(6, 1), [16, 17, 18, 255]);
      await pollFor(page, () => getCellColor(7, 1), [19, 20, 21, 255]);
      await pollFor(page, () => getCellColor(8, 1), [22, 23, 24, 255]);
    });

    it('background 0-15 bright', async () => {
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
      await pollFor(page, () => getCellColor(1, 1), [1, 2, 3, 255]);
      await pollFor(page, () => getCellColor(2, 1), [4, 5, 6, 255]);
      await pollFor(page, () => getCellColor(3, 1), [7, 8, 9, 255]);
      await pollFor(page, () => getCellColor(4, 1), [10, 11, 12, 255]);
      await pollFor(page, () => getCellColor(5, 1), [13, 14, 15, 255]);
      await pollFor(page, () => getCellColor(6, 1), [16, 17, 18, 255]);
      await pollFor(page, () => getCellColor(7, 1), [19, 20, 21, 255]);
      await pollFor(page, () => getCellColor(8, 1), [22, 23, 24, 255]);
    });

    it('foreground 16-255', async () => {
      let data = '';
      for (let y = 0; y < 240 / 16; y++) {
        for (let x = 0; x < 16; x++) {
          data += `\\x1b[38;5;${16 + y * 16 + x}m█\x1b[0m`;
        }
        data += '\\r\\n';
      }
      await writeSync(data);
      for (let y = 0; y < 240 / 16; y++) {
        for (let x = 0; x < 16; x++) {
          const cssColor = COLORS_16_TO_255[y * 16 + x];
          const r = parseInt(cssColor.substr(1, 2), 16);
          const g = parseInt(cssColor.substr(3, 2), 16);
          const b = parseInt(cssColor.substr(5, 2), 16);
          await pollFor(page, () => getCellColor(x + 1, y + 1), [r, g, b, 255]);
        }
      }
    });

    it('background 16-255', async () => {
      let data = '';
      for (let y = 0; y < 240 / 16; y++) {
        for (let x = 0; x < 16; x++) {
          data += `\\x1b[48;5;${16 + y * 16 + x}m \x1b[0m`;
        }
        data += '\\r\\n';
      }
      await writeSync(data);
      for (let y = 0; y < 240 / 16; y++) {
        for (let x = 0; x < 16; x++) {
          const cssColor = COLORS_16_TO_255[y * 16 + x];
          const r = parseInt(cssColor.substr(1, 2), 16);
          const g = parseInt(cssColor.substr(3, 2), 16);
          const b = parseInt(cssColor.substr(5, 2), 16);
          await pollFor(page, () => getCellColor(x + 1, y + 1), [r, g, b, 255]);
        }
      }
    });

    it('foreground true color red', async () => {
      let data = '';
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const i = y * 16 + x;
          data += `\\x1b[38;2;${i};0;0m█\x1b[0m`;
        }
        data += '\\r\\n';
      }
      await writeSync(data);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const i = y * 16 + x;
          await pollFor(page, () => getCellColor(x + 1, y + 1), [i, 0, 0, 255]);
        }
      }
    });

    it('foreground true color green', async () => {
      let data = '';
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const i = y * 16 + x;
          data += `\\x1b[38;2;0;${i};0m█\x1b[0m`;
        }
        data += '\\r\\n';
      }
      await writeSync(data);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const i = y * 16 + x;
          await pollFor(page, () => getCellColor(x + 1, y + 1), [0, i, 0, 255]);
        }
      }
    });

    it('foreground true color blue', async () => {
      let data = '';
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const i = y * 16 + x;
          data += `\\x1b[38;2;0;0;${i}m█\x1b[0m`;
        }
        data += '\\r\\n';
      }
      await writeSync(data);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const i = y * 16 + x;
          await pollFor(page, () => getCellColor(x + 1, y + 1), [0, 0, i, 255]);
        }
      }
    });

    it('foreground true color grey', async () => {
      let data = '';
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const i = y * 16 + x;
          data += `\\x1b[38;2;${i};${i};${i}m█\x1b[0m`;
        }
        data += '\\r\\n';
      }
      await writeSync(data);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const i = y * 16 + x;
          await pollFor(page, () => getCellColor(x + 1, y + 1), [i, i, i, 255]);
        }
      }
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
  return page.evaluate(`new Promise(resolve => window.term.write('${data}', resolve))`);
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

async function setupBrowser(): Promise<void> {
  browser = await puppeteer.launch({
    headless: process.argv.indexOf('--headless') !== -1,
    args: [`--window-size=${width},${height}`, `--no-sandbox`]
  });
  page = (await browser.pages())[0];
  await page.setViewport({ width, height });
  await page.goto(APP);
  await openTerminal({
    rendererType: 'dom'
  });
  await page.evaluate(`
    window.addon = new WebglAddon(true);
    window.term.loadAddon(window.addon);
  `);
}

export async function pollFor<T>(page: puppeteer.Page, evalOrFn: string | (() => Promise<T>), val: T, preFn?: () => Promise<void>): Promise<void> {
  if (preFn) {
    await preFn();
  }
  const result = typeof evalOrFn === 'string' ? await page.evaluate(evalOrFn) : await evalOrFn();
  if (!deepEqual(result, val)) {
    return new Promise<void>(r => {
      setTimeout(() => r(pollFor(page, evalOrFn, val, preFn)), 1);
    });
  }
}

const COLORS_16_TO_255 = [
  '#000000', '#00005f', '#000087', '#0000af', '#0000d7', '#0000ff', '#005f00', '#005f5f', '#005f87', '#005faf', '#005fd7', '#005fff', '#008700', '#00875f', '#008787', '#0087af',
  '#0087d7', '#0087ff', '#00af00', '#00af5f', '#00af87', '#00afaf', '#00afd7', '#00afff', '#00d700', '#00d75f', '#00d787', '#00d7af', '#00d7d7', '#00d7ff', '#00ff00', '#00ff5f',
  '#00ff87', '#00ffaf', '#00ffd7', '#00ffff', '#5f0000', '#5f005f', '#5f0087', '#5f00af', '#5f00d7', '#5f00ff', '#5f5f00', '#5f5f5f', '#5f5f87', '#5f5faf', '#5f5fd7', '#5f5fff',
  '#5f8700', '#5f875f', '#5f8787', '#5f87af', '#5f87d7', '#5f87ff', '#5faf00', '#5faf5f', '#5faf87', '#5fafaf', '#5fafd7', '#5fafff', '#5fd700', '#5fd75f', '#5fd787', '#5fd7af',
  '#5fd7d7', '#5fd7ff', '#5fff00', '#5fff5f', '#5fff87', '#5fffaf', '#5fffd7', '#5fffff', '#870000', '#87005f', '#870087', '#8700af', '#8700d7', '#8700ff', '#875f00', '#875f5f',
  '#875f87', '#875faf', '#875fd7', '#875fff', '#878700', '#87875f', '#878787', '#8787af', '#8787d7', '#8787ff', '#87af00', '#87af5f', '#87af87', '#87afaf', '#87afd7', '#87afff',
  '#87d700', '#87d75f', '#87d787', '#87d7af', '#87d7d7', '#87d7ff', '#87ff00', '#87ff5f', '#87ff87', '#87ffaf', '#87ffd7', '#87ffff', '#af0000', '#af005f', '#af0087', '#af00af',
  '#af00d7', '#af00ff', '#af5f00', '#af5f5f', '#af5f87', '#af5faf', '#af5fd7', '#af5fff', '#af8700', '#af875f', '#af8787', '#af87af', '#af87d7', '#af87ff', '#afaf00', '#afaf5f',
  '#afaf87', '#afafaf', '#afafd7', '#afafff', '#afd700', '#afd75f', '#afd787', '#afd7af', '#afd7d7', '#afd7ff', '#afff00', '#afff5f', '#afff87', '#afffaf', '#afffd7', '#afffff',
  '#d70000', '#d7005f', '#d70087', '#d700af', '#d700d7', '#d700ff', '#d75f00', '#d75f5f', '#d75f87', '#d75faf', '#d75fd7', '#d75fff', '#d78700', '#d7875f', '#d78787', '#d787af',
  '#d787d7', '#d787ff', '#d7af00', '#d7af5f', '#d7af87', '#d7afaf', '#d7afd7', '#d7afff', '#d7d700', '#d7d75f', '#d7d787', '#d7d7af', '#d7d7d7', '#d7d7ff', '#d7ff00', '#d7ff5f',
  '#d7ff87', '#d7ffaf', '#d7ffd7', '#d7ffff', '#ff0000', '#ff005f', '#ff0087', '#ff00af', '#ff00d7', '#ff00ff', '#ff5f00', '#ff5f5f', '#ff5f87', '#ff5faf', '#ff5fd7', '#ff5fff',
  '#ff8700', '#ff875f', '#ff8787', '#ff87af', '#ff87d7', '#ff87ff', '#ffaf00', '#ffaf5f', '#ffaf87', '#ffafaf', '#ffafd7', '#ffafff', '#ffd700', '#ffd75f', '#ffd787', '#ffd7af',
  '#ffd7d7', '#ffd7ff', '#ffff00', '#ffff5f', '#ffff87', '#ffffaf', '#ffffd7', '#ffffff', '#080808', '#121212', '#1c1c1c', '#262626', '#303030', '#3a3a3a', '#444444', '#4e4e4e',
  '#585858', '#626262', '#6c6c6c', '#767676', '#808080', '#8a8a8a', '#949494', '#9e9e9e', '#a8a8a8', '#b2b2b2', '#bcbcbc', '#c6c6c6', '#d0d0d0', '#dadada', '#e4e4e4', '#eeeeee'
];
