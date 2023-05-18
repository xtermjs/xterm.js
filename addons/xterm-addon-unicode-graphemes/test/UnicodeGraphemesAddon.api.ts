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
  async function evalWidth(str: string): Promise<number> {
    return page.evaluate(`window.term._core.unicodeService.getStringCellWidth('${str}')`);
  }
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
    assert.deepEqual(await evalWidth('🤣🤣🤣🤣🤣🤣🤣🤣🤣🤣'), 20);
    // baby with emoji modifier fitzpatrick type-6; baby
    assert.deepEqual(await evalWidth('\u{1F476}\u{1F3FF}\u{1F476}'), 4);
    // woman+zwj+woman+zwj+boy
    assert.deepEqual(await evalWidth('\u{1F469}\u200d\u{1f469}\u200d\u{1f466}'), 2);
    // REGIONAL INDICATOR SYMBOL LETTER N and RI O
    assert.deepEqual(await evalWidth('\u{1f1f3}\u{1f1f4}_'), 3);
    assert.deepEqual(await evalWidth('\u{1f1f3}_\u{1f1f4}'), 3);
    // letter a with acute accent
    assert.deepEqual(await evalWidth('\u0061\u0301'), 1);
    // Korean Jamo
    assert.deepEqual(await evalWidth('{\u1100\u1161\u11a8}'), 4);
    // coffin with text_presentation
    assert.deepEqual(await evalWidth('(\u26b0\ufe0e)'), 3);
    // coffin with Emoji_presentation
    assert.deepEqual(await evalWidth('(\u26b0\ufe0f)'), 4);
    // Égalité (using separate acute) emoij_presentation
    assert.deepEqual(await evalWidth('<E\u0301\ufe0fg\ufe0fa\ufe0fl\ufe0fi\ufe0f\ufe0ft\ufe0fe\u0301\ufe0f>'), 16);
  });
});
