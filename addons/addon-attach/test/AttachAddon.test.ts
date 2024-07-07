/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import WebSocket = require('ws');

import test from '@playwright/test';
import { ITestContext, createTestContext, openTerminal, pollFor, timeout } from '../../../test/playwright/TestUtils';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx);
});
test.afterAll(async () => await ctx.page.close());

test.describe('Search Tests', () => {

  test.beforeEach(async () => {
    await ctx.proxy.reset();
  });

  test('string', async function(): Promise<any> {
    const port = 8080;
    const server = new WebSocket.Server({ port });
    server.on('connection', socket => socket.send('foo'));
    await ctx.page.evaluate(`window.term.loadAddon(new window.AttachAddon(new WebSocket('ws://localhost:${port}')))`);
    await pollFor(ctx.page, `window.term.buffer.active.getLine(0).translateToString(true)`, 'foo');
    server.close();
  });

  test('utf8', async function(): Promise<any> {
    const port = 8080;
    const server = new WebSocket.Server({ port });
    const data = new Uint8Array([102, 111, 111]);
    server.on('connection', socket => socket.send(data));
    await ctx.page.evaluate(`window.term.loadAddon(new window.AttachAddon(new WebSocket('ws://localhost:${port}')))`);
    await pollFor(ctx.page, `window.term.buffer.active.getLine(0).translateToString(true)`, 'foo');
    server.close();
  });
});
