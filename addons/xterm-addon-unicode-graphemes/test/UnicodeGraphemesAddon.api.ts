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
    assert.deepEqual(await page.evaluate(`window.term.unicode.versions`), ['6', '15', '15-graphemes']);
    // switch should not throw
    await page.evaluate(`window.term.unicode.activeVersion = '${ourVersion}';`);
    assert.equal(await page.evaluate(`window.term.unicode.activeVersion`), ourVersion);
    assert.equal(await evalWidth('🤣🤣🤣🤣🤣🤣🤣🤣🤣🤣'), 20,
      '10 emoji - width 10 in V6; 20 in V11 or later');
    assert.equal(await evalWidth('\u{1F476}\u{1F3FF}\u{1F476}'), 4,
      'baby with emoji modifier fitzpatrick type-6; baby');
    assert.equal(await evalWidth('\u{1F469}\u200d\u{1f469}\u200d\u{1f466}'), 2,
      'woman+zwj+woman+zwj+boy');
    assert.equal(await evalWidth('=\u{1F3CB}\u{FE0F}=\u{F3CB}\u{1F3FE}\u200D\u2640='), 7,
      'person lifting weights (plain, emoji); woman lighting weights, medium dark');
    assert.equal(await evalWidth('\u{1F469}\u{1F469}\u{200D}\u{1F393}\u{1F468}\u{1F3FF}\u{200D}\u{1F393}'), 6,
      'woman; woman student; man student dark');
    assert.equal(await evalWidth('\u{1f1f3}\u{1f1f4}/'), 3,
      'regional indicator symbol letters N and O, cluster');
    assert.equal(await evalWidth('\u{1f1f3}/\u{1f1f4}'), 3,
      'regional indicator symbol letters N and O, separated');
    assert.equal(await evalWidth('\u0061\u0301'), 1,
      'letter a with acute accent');
    assert.equal(await evalWidth('{\u1100\u1161\u11a8\u1100\u1161}'), 6,
      'Korean Jamo');
    assert.equal(await evalWidth('\uAC00=\uD685='), 6,
      'Hangul syllables (pre-composed)');
    assert.equal(await evalWidth('(\u26b0\ufe0e)'), 3,
      'coffin with text presentation');
    assert.equal(await evalWidth('(\u26b0\ufe0f)'), 4,
      'coffin with emoji presentation');
    assert.equal(await evalWidth('<E\u0301\ufe0fg\ufe0fa\ufe0fl\ufe0fi\ufe0f\ufe0ft\ufe0fe\u0301\ufe0f>'), 16,
      'Égalité (using separate acute) emoij_presentation');
  });
});
