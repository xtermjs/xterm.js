/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { openTerminal, launchBrowser } from '../../../out-test/api/TestUtils';
import { Browser, Page } from 'playwright';

const APP = 'http://127.0.0.1:3001/test';

let browser: Browser;
let page: Page;
const width = 800;
const height = 600;

describe('UnicodeGraphemesAddon', () => {
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
  const ourVersion = '15-graphemes';
  it('wcwidth V15 emoji test', async () => {
    await page.evaluate(`
      window.unicode = new UnicodeGraphemesAddon();
      window.term.loadAddon(window.unicode);
    `);
    // should have loaded '15-graphemes'
    assert.deepEqual(await page.evaluate(`window.term.unicode.versions`), ['6', ourVersion]);
    // switch should not throw
    await page.evaluate(`window.term.unicode.activeVersion = '${ourVersion}';`);
    assert.deepEqual(await page.evaluate(`window.term.unicode.activeVersion`), ourVersion);
    // v6: 10, V15: 20
    assert.deepEqual(await page.evaluate(`window.term._core.unicodeService.getStringCellWidth('🤣🤣🤣🤣🤣🤣🤣🤣🤣🤣')`), 20);
  });
});
