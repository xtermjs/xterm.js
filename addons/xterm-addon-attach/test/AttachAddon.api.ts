/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import WebSocket = require('ws');
import { openTerminal, pollFor, launchBrowser } from '../../../out-test/api/TestUtils';
import { Browser, Page } from '@playwright/test';

const APP = 'http://127.0.0.1:3001/test';

let browser: Browser;
let page: Page;
const width = 800;
const height = 600;

describe('AttachAddon', () => {
  before(async function(): Promise<any> {
    browser = await launchBrowser();
    page = await (await browser.newContext()).newPage();
    await page.setViewportSize({ width, height });
  });

  after(async () => {
    await browser.close();
  });

  beforeEach(async () => await page.goto(APP));

  it('string', async function(): Promise<any> {
    await openTerminal(page);
    const port = 8080;
    const server = new WebSocket.Server({ port });
    server.on('connection', socket => socket.send('foo'));
    await page.evaluate(`window.term.loadAddon(new window.AttachAddon(new WebSocket('ws://localhost:${port}')))`);
    await pollFor(page, `window.term.buffer.active.getLine(0).translateToString(true)`, 'foo');
    server.close();
  });

  it('utf8', async function(): Promise<any> {
    await openTerminal(page);
    const port = 8080;
    const server = new WebSocket.Server({ port });
    const data = new Uint8Array([102, 111, 111]);
    server.on('connection', socket => socket.send(data));
    await page.evaluate(`window.term.loadAddon(new window.AttachAddon(new WebSocket('ws://localhost:${port}')))`);
    await pollFor(page, `window.term.buffer.active.getLine(0).translateToString(true)`, 'foo');
    server.close();
  });
});
