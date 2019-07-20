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

describe.only('Broken Tests', function (): void {
  this.timeout(200000);

  before(async function (): Promise<any> {
    browser = await puppeteer.launch({
      headless: process.argv.indexOf('--headless') !== -1,
      slowMo: 80,
      args: [`--window-size=${width},${height}`]
    });
    page = (await browser.pages())[0];
    await page.setViewport({ width, height });
    await page.goto(APP);
    await openTerminal();
    await page.evaluate(`window.search = new SearchAddon();`);
    await page.evaluate(`window.term.loadAddon(window.search);`);
  });

  after(() => {
    // browser.close();
  });

  beforeEach(async () => {
    await page.evaluate(`window.term.reset()`);
  });

  it('Simple Search', async () => {
    await writeSync('dafhdjfldshafhldsahfkjhldhjkftestlhfdsakjfhdjhlfdsjkafhjdlk');
    assert.deepEqual(await page.evaluate(`window.search.findNext('test')`), true);
    assert.deepEqual(await page.evaluate(`window.term.getSelection()`), 'test');
  });

  it('Scrolling Search', async () => {
    let dataString = '';
    for (let i = 0; i < 100; i++) {
      if (i === 52) {
        dataString += '$^1_3{}test$#';
      }
      dataString += makeData(50);
    }
    await writeSync(dataString);
    assert.deepEqual(await page.evaluate(`window.search.findNext('$^1_3{}test$#')`), true);
    assert.deepEqual(await page.evaluate(`window.term.getSelection()`), '$^1_3{}test$#');
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

function makeData(length: number): string {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
