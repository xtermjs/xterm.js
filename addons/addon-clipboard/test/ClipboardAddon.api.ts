/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { openTerminal, launchBrowser, writeSync, getBrowserType } from '../../../out-test/api/TestUtils';
import { Browser, BrowserContext, Page } from '@playwright/test';
import { beforeEach } from 'mocha';

const APP = 'http://127.0.0.1:3001/test';

let browser: Browser;
let context: BrowserContext;
let page: Page;
const width = 800;
const height = 600;

describe('ClipboardAddon', () => {
  before(async function (): Promise<any> {
    browser = await launchBrowser({
      // Enable clipboard access in firefox, mainly for readText
      firefoxUserPrefs: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'dom.events.testing.asyncClipboard': true,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'dom.events.asyncClipboard.readText': true
      }
    });
    context = await browser.newContext();
    if (getBrowserType().name() !== 'webkit') {
      // Enable clipboard access in chromium without user gesture
      context.grantPermissions(['clipboard-read', 'clipboard-write']);
    }
    page = await context.newPage();
    await page.setViewportSize({ width, height });
    await page.goto(APP);
    await openTerminal(page);
    await page.evaluate(`
      window.clipboardAddon = new ClipboardAddon();
      window.term.loadAddon(window.clipboardAddon);
    `);
  });

  after(() => {
    browser.close();
  });

  beforeEach(async () => {
    await page.evaluate(`window.term.reset()`);
  });

  const testDataEncoded = 'aGVsbG8gd29ybGQ=';
  const testDataDecoded = 'hello world';

  describe('write data', async function (): Promise<any> {
    it('simple string', async () => {
      await writeSync(page, `\x1b]52;c;${testDataEncoded}\x07`);
      assert.deepEqual(await page.evaluate(() => window.navigator.clipboard.readText()), testDataDecoded);
    });
    it('invalid base64 string', async () => {
      await writeSync(page, `\x1b]52;c;${testDataEncoded}invalid\x07`);
      assert.deepEqual(await page.evaluate(() => window.navigator.clipboard.readText()), '');
    });
    it('empty string', async () => {
      await writeSync(page, `\x1b]52;c;${testDataEncoded}\x07`);
      await writeSync(page, `\x1b]52;c;\x07`);
      assert.deepEqual(await page.evaluate(() => window.navigator.clipboard.readText()), '');
    });
  });

  describe('read data', async function (): Promise<any> {
    it('simple string', async () => {
      await page.evaluate(`
        window.data = [];
        window.term.onData(e => data.push(e));
      `);
      await page.evaluate(() => window.navigator.clipboard.writeText('hello world'));
      await writeSync(page, `\x1b]52;c;?\x07`);
      assert.deepEqual(await page.evaluate('window.data'), [`\x1b]52;c;${testDataEncoded}\x07`]);
    });
    it('clear clipboard', async () => {
      await writeSync(page, `\x1b]52;c;!\x07`);
      await writeSync(page, `\x1b]52;c;?\x07`);
      assert.deepEqual(await page.evaluate(() => window.navigator.clipboard.readText()), '');
    });
  });
});
