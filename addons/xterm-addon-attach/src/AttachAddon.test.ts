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

describe.only('API Integration Tests', () => {
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

  after(async () => {
    await browser.close();
  });

  beforeEach(async function(): Promise<any> {
    this.timeout(5000);
    await page.goto(APP);
  });

  it('string', async function(): Promise<any> {
    this.timeout(20000);
    await openTerminal({ rendererType: 'dom' });
    const port = 8080;
    const server = new WebSocket.Server({ port });
    server.on('connection', socket => socket.send('foo'));
    await page.evaluate(`window.term.loadAddon(new window.AttachAddon(new WebSocket('ws://localhost:${port}')))`);
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
    await page.evaluate(`window.term.loadAddon(new window.AttachAddon(new WebSocket('ws://localhost:${port}'), { inputUtf8: true }))`);
    assert.equal(await page.evaluate(`window.term.buffer.getLine(0).translateToString(true)`), 'foo');
    server.close();
  });
});

// async function testHostName(hostname: string): Promise<void> {
//   await openTerminal({ rendererType: 'dom' });
//   await page.evaluate(`window.term.loadAddon(new window.WebLinksAddon())`);
//   await page.evaluate(`
//     window.term.writeln('  http://${hostname}  ');
//     window.term.writeln('  http://${hostname}/a~b#c~d?e~f  ');
//     window.term.writeln('  http://${hostname}/colon:test  ');
//     window.term.writeln('  http://${hostname}/colon:test:  ');
//     window.term.writeln('"http://${hostname}/"');
//     window.term.writeln('\\'http://${hostname}/\\'');
//     window.term.writeln('http://${hostname}/subpath/+/id');
//   `);
//   assert.equal(await getLinkAtCell(3, 1), `http://${hostname}`);
//   assert.equal(await getLinkAtCell(3, 2), `http://${hostname}/a~b#c~d?e~f`);
//   assert.equal(await getLinkAtCell(3, 3), `http://${hostname}/colon:test`);
//   assert.equal(await getLinkAtCell(3, 4), `http://${hostname}/colon:test`);
//   assert.equal(await getLinkAtCell(2, 5), `http://${hostname}/`);
//   assert.equal(await getLinkAtCell(2, 6), `http://${hostname}/`);
//   assert.equal(await getLinkAtCell(1, 7), `http://${hostname}/subpath/+/id`);
// }

async function openTerminal(options: ITerminalOptions = {}): Promise<void> {
  await page.evaluate(`window.term = new Terminal(${JSON.stringify(options)})`);
  await page.evaluate(`window.term.open(document.querySelector('#terminal-container'))`);
  if (options.rendererType === 'dom') {
    await page.waitForSelector('.xterm-rows');
  } else {
    await page.waitForSelector('.xterm-text-layer');
  }
}

// async function getLinkAtCell(col: number, row: number): Promise<string> {
//   const rowSelector = `.xterm-rows > :nth-child(${row})`;
//   await page.hover(`${rowSelector} > :nth-child(${col})`);
//   return await page.evaluate(`Array.prototype.reduce.call(document.querySelectorAll('${rowSelector} > span[style]'), (a, b) => a + b.textContent, '');`);
// }
