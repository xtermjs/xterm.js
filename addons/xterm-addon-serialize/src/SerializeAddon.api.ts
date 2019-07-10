/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as puppeteer from 'puppeteer';
import * as util from 'util';
import { assert } from 'chai';
import { ITerminalOptions } from 'xterm';

const APP = 'http://127.0.0.1:3000/test';

let browser: puppeteer.Browser;
let page: puppeteer.Page;
const width = 800;
const height = 600;

describe('SerializeAddon', () => {
  before(async function (): Promise<any> {
    this.timeout(20000);
    browser = await puppeteer.launch({
      headless: process.argv.indexOf('--headless') !== -1,
      slowMo: 80,
      args: [`--window-size=${width},${height}`]
    });
    page = (await browser.pages())[0];
    await page.setViewport({ width, height });
  });

  after(async () => {
    await browser.close();
  });

  beforeEach(async function (): Promise<any> {
    this.timeout(20000);
    await page.goto(APP);
  });

  it('empty content', async function (): Promise<any> {
    this.timeout(20000);
    const rows = 10;
    const cols = 10;
    const blankline = ' '.repeat(cols);
    const lines = newArray<string>(blankline, rows);

    await openTerminal({ rows: rows, cols: cols, rendererType: 'dom' });
    await page.evaluate(`
      window.serializeAddon = new SerializeAddon();
      window.term.loadAddon(window.serializeAddon);
    `);

    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('digits content', async function (): Promise<any> {
    this.timeout(20000);
    const rows = 10;
    const cols = 10;
    const digitsLine = digitsString(cols);
    const lines = newArray<string>(digitsLine, rows);

    await openTerminal({ rows: rows, cols: cols, rendererType: 'dom' });
    await page.evaluate(`
      window.serializeAddon = new SerializeAddon();
      window.term.loadAddon(window.serializeAddon);
      window.term.write(${util.inspect(lines.join('\r\n'))});
    `);

    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('serialize n rows of content', async function (): Promise<any> {
    this.timeout(20000);
    const rows = 10;
    const halfRows = rows >> 1;
    const cols = 10;
    const lines = newArray<string>((index: number) => digitsString(cols, index), rows);

    await openTerminal({ rows: rows, cols: cols, rendererType: 'dom' });
    await page.evaluate(`
      window.serializeAddon = new SerializeAddon();
      window.term.loadAddon(window.serializeAddon);
      window.term.write(${util.inspect(lines.join('\r\n'))});
    `);

    assert.equal(await page.evaluate(`serializeAddon.serialize(${halfRows});`), lines.slice(0, halfRows).join('\r\n'));
  });

  it('serialize 0 rows of content', async function (): Promise<any> {
    this.timeout(20000);
    const rows = 10;
    const cols = 10;
    const lines = newArray<string>((index: number) => digitsString(cols, index), rows);

    await openTerminal({ rows: rows, cols: cols, rendererType: 'dom' });
    await page.evaluate(`
      window.serializeAddon = new SerializeAddon();
      window.term.loadAddon(window.serializeAddon);
      window.term.write(${util.inspect(lines.join('\r\n'))});
    `);

    assert.equal(await page.evaluate(`serializeAddon.serialize(0);`), '');
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

function newArray<T>(initial: T | ((index: number) => T), count: number): T[] {
  const array: T[] = new Array<T>(count);
  for (let i = 0; i < array.length; i++) {
    if (typeof initial === 'function') {
      array[i] = (<(index: number) => T>initial)(i);
    } else {
      array[i] = <T>initial;
    }
  }
  return array;
}

function digitsString(length: number, from: number = 0): string {
  let s = '';
  for (let i = 0; i < length; i++) {
    s += (from++) % 10;
  }
  return s;
}
