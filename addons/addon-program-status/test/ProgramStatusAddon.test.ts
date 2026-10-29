/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test from '@playwright/test';
import { deepStrictEqual } from 'assert';
import { ITestContext, createTestContext, openTerminal, pollFor } from '../../../test/playwright/TestUtils';

const REPLY = '\x1b]7501;?\x1b\\';

let ctx: ITestContext;

test.describe('ProgramStatusAddon', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    ctx = await createTestContext(browser);
    await openTerminal(ctx);
  });

  test.afterAll(async () => {
    await ctx?.page?.close();
  });

  test.beforeEach(async function(): Promise<any> {
    await ctx.page.evaluate(`
      window.term.reset();
      window.programStatusAddon?.dispose();
      window.programStatusAddon = new ProgramStatusAddon();
      window.term.loadAddon(window.programStatusAddon);
      window.programStatusChanges = [];
      window.programStatusAddon.onChange(records => window.programStatusChanges.push(records));
    `);
  });

  test('keeps the status that programs report without printing it', async () => {
    await ctx.proxy.write('\x1b]7501;state=working:app=make:title=QnVpbGRpbmc\x1b\\');
    await ctx.proxy.write('\x1b]7501;state=blocked:kind=permission:id=deploy:msg=QXBwbHkgMyB0byBhZGQsIDEgdG8gY2hhbmdlLCAwIHRvIGRlc3Ryb3k/\x07');
    deepStrictEqual(await ctx.page.evaluate('window.programStatusAddon.records'), [
      { id: '', state: 'working', app: 'make', effectiveApp: 'make', title: 'Building' },
      { id: 'deploy', state: 'blocked', kind: 'permission', effectiveApp: 'make', message: 'Apply 3 to add, 1 to change, 0 to destroy?' }
    ]);
    deepStrictEqual(await ctx.page.evaluate('window.programStatusChanges.length'), 2);
    deepStrictEqual(await ctx.page.evaluate('window.term.buffer.active.getLine(0).translateToString(true)'), '');
  });

  test('accepts a message of 2048 bytes and discards one of 2049', async () => {
    const text = '0123456789abcdef'.repeat(128);
    await ctx.proxy.write(`\x1b]7501;state=done:id=long:msg=${btoa(text + '!')}\x1b\\`);
    await ctx.proxy.write(`\x1b]7501;state=done:msg=${btoa(text)}\x1b\\`);
    deepStrictEqual(await ctx.page.evaluate('window.programStatusAddon.records.map(record => [record.id, record.message.length])'), [['', 2048]]);
    deepStrictEqual(await ctx.page.evaluate('window.programStatusChanges.length'), 1);
  });

  test('answers the query with ST before a DA1 query that follows it', async () => {
    const replies: string[] = [];
    const listener = ctx.proxy.onData(data => replies.push(data));
    await ctx.proxy.write('\x1b]7501;?\x07\x1b[c');
    await pollFor(ctx.page, () => replies, [REPLY, '\x1b[?1;2c']);
    listener.dispose();
  });

  test('clears every record on RIS', async () => {
    await ctx.proxy.write('\x1b]7501;state=done:id=deploy\x1b\\\x1bc');
    deepStrictEqual(await ctx.page.evaluate('window.programStatusAddon.records'), []);
    deepStrictEqual(await ctx.page.evaluate('window.programStatusChanges.length'), 2);
  });

  test('rejects non-canonical base64, invalid UTF-8, and control characters', async () => {
    deepStrictEqual(await ctx.page.evaluate('typeof Uint8Array.prototype.setFromBase64'), 'function');
    await ctx.proxy.write([
      '\x1b]7501;state=done:id=keep:msg=SA\x1b\\',
      '\x1b]7501;state=working:id=keep:msg=SB\x1b\\',
      '\x1b]7501;state=error:id=keep:msg=gA==\x1b\\',
      '\x1b]7501;state=blocked:id=keep:title=AQ==\x1b\\'
    ].join(''));
    deepStrictEqual(await ctx.page.evaluate('window.programStatusAddon.records'), [
      { id: 'keep', state: 'done', message: 'H' }
    ]);
    deepStrictEqual(await ctx.page.evaluate('window.programStatusChanges.length'), 1);
  });

  test('removes working and blocked records on promptStarted()', async () => {
    await ctx.proxy.write([
      '\x1b]7501;state=working:id=us-east\x1b\\',
      '\x1b]7501;state=blocked:id=eu-west\x1b\\',
      '\x1b]7501;state=done:id=ap-south\x1b\\'
    ].join(''));
    await ctx.page.evaluate('window.programStatusAddon.promptStarted()');
    deepStrictEqual(await ctx.page.evaluate('window.programStatusAddon.records.map(record => record.id)'), ['ap-south']);
  });
});
