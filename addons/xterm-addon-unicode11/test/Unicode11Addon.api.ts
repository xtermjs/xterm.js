/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { openTerminal, launchBrowser } from '../../../out-test/api/TestUtils';
import { Browser, Page } from '@playwright/test';

const APP = 'http://127.0.0.1:3001/test';

let browser: Browser;
let page: Page;
const width = 800;
const height = 600;

describe('Unicode11Addon', () => {
  before(async function(): Promise<any> {
    browser = await launchBrowser();
    page = await (await browser.newContext()).newPage();
    await page.setViewportSize({ width, height });
  });

  after(async () => {
    await browser.close();
  });

  beforeEach(async function(): Promise<any> {
    await page.goto(APP);
    await openTerminal(page);
  });

  it('wcwidth V11 emoji test', async () => {
    await page.evaluate(`
      window.unicode11 = new Unicode11Addon();
      window.term.loadAddon(window.unicode11);
    `);
    // should have loaded '11'
    assert.deepEqual((await page.evaluate(`window.term.unicode.versions`) as string[]).includes('11'), true);
    // switch should not throw
    await page.evaluate(`window.term.unicode.activeVersion = '11';`);
    assert.deepEqual(await page.evaluate(`window.term.unicode.activeVersion`), '11');
    // v6: 10, V11: 20
    assert.deepEqual(await page.evaluate(`window.term._core.unicodeService.getStringCellWidth('🤣🤣🤣🤣🤣🤣🤣🤣🤣🤣')`), 20);
  });
});
