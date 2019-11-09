/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as puppeteer from 'puppeteer';
import { assert } from 'chai';
import { ITerminalOptions } from 'xterm';
import WebSocket = require('ws');

const APP = 'http://127.0.0.1:3000/test';

let browser: puppeteer.Browser;
let page: puppeteer.Page;
const width = 800;
const height = 600;

describe('AttachAddon', () => {
  before(async function(): Promise<any> {
    this.timeout(20000);
    browser = await puppeteer.launch({
      headless: process.argv.indexOf('--headless') !== -1,
      args: [`--window-size=${width},${height}`, `--no-sandbox`]
    });
    page = (await browser.pages())[0];
    await page.setViewport({ width, height });
  });

  after(async () => {
    await browser.close();
  });

  beforeEach(async function(): Promise<any> {
    this.timeout(20000);
    await page.goto(APP);
  });

  it('string', async function(): Promise<any> {
    this.timeout(20000);
    await openTerminal({ rendererType: 'dom' });
    const port = 8080;
    const server = new WebSocket.Server({ port });
    server.on('connection', socket => socket.send('foo'));
    await page.evaluate(`window.term.loadAddon(new window.AttachAddon(new WebSocket('ws://localhost:${port}')))`);
    await pollFor(page, `window.term.buffer.getLine(0).translateToString(true)`, 'foo');
    assert.equal(await page.evaluate(`window.term.buffer.getLine(0).translateToString(true)`), 'foo');
    server.close();
  });

  it('utf8', async function(): Promise<any> {
    this.timeout(20000);
    await openTerminal({ rendererType: 'dom' });
    const port = 8080;
    const server = new WebSocket.Server({ port });
    const data = new Uint8Array([102, 111, 111]);
    server.on('connection', socket => socket.send(data));
    await page.evaluate(`window.term.loadAddon(new window.AttachAddon(new WebSocket('ws://localhost:${port}')))`);
    await pollFor(page, `window.term.buffer.getLine(0).translateToString(true)`, 'foo');
    assert.equal(await page.evaluate(`window.term.buffer.getLine(0).translateToString(true)`), 'foo');
    server.close();
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

async function pollFor(page: puppeteer.Page, fn: string, val: any): Promise<void> {
  const result = await page.evaluate(fn);
  if (result !== val) {
    return new Promise<void>(r => {
      setTimeout(() => r(pollFor(page, fn, val)), 10);
    });
  }
}
