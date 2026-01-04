/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import test from '@playwright/test';
import { deepStrictEqual, strictEqual } from 'assert';
import { ITestContext, createTestContext, openTerminal, pollFor, timeout } from '../../../test/playwright/TestUtils';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx, { cols: 40 });
});
test.afterAll(async () => await ctx.page.close());

test.describe('WebFontsAddon', () => {

  test.beforeEach(async () => {
    // make sure that we start with no webfonts in the document
    const empty = await await getDocumentFonts();
    deepStrictEqual(empty, []);
  });
  test.afterEach(async () => {
    // for font loading tests to work, we have to remove added rules and fonts
    // to work around the quite aggressive font caching done by the browsers
    await ctx.page.evaluate(`
      document.styleSheets[0].deleteRule(1);
      document.styleSheets[0].deleteRule(0);
      document.fonts.clear();
    `);
  });

  test.describe('font loading at runtime', () => {
    test('loadFonts (JS)', async () => {
      await ctx.page.evaluate(`
        const ff1 = new FontFace('Kongtext', "url(/kongtext.regular.ttf) format('truetype')");
        const ff2 = new FontFace('BPdots', "url(/bpdots.regular.otf) format('opentype')");
        loadFonts([ff1, ff2]);
      `);
      deepStrictEqual(await getDocumentFonts(), [{ family: 'Kongtext', status: 'loaded' }, { family: 'BPdots', status: 'loaded' }]);
    });
    test('loadFonts (CSS, unquoted)', async () => {
      await ctx.page.evaluate(`
        document.styleSheets[0].insertRule("@font-face {font-family: Kongtext; src: url(/kongtext.regular.ttf) format('truetype')}", 0);
        document.styleSheets[0].insertRule("@font-face {font-family: BPdots; src: url(/bpdots.regular.otf) format('opentype')}", 1);
        loadFonts(['Kongtext', 'BPdots']);
      `);
      deepStrictEqual(await getDocumentFonts(), [{ family: 'Kongtext', status: 'loaded' }, { family: 'BPdots', status: 'loaded' }]);
    });
    test('loadFonts (CSS, quoted)', async ({ browser }) => {
      // NOTE: firefox preserves family quotes from CSS rules in fontface, all other browsers unquote them
      await ctx.page.evaluate(`
        document.styleSheets[0].insertRule("@font-face {font-family: 'Kongtext'; src: url(/kongtext.regular.ttf) format('truetype')}", 0);
        document.styleSheets[0].insertRule("@font-face {font-family: 'BPdots'; src: url(/bpdots.regular.otf) format('opentype')}", 1);
        loadFonts(['Kongtext', 'BPdots']);
      `);
      if (browser.browserType().name() === 'firefox') {
        deepStrictEqual(await getDocumentFonts(), [{ family: '"Kongtext"', status: 'loaded' }, { family: '"BPdots"', status: 'loaded' }]);
      } else {
        deepStrictEqual(await getDocumentFonts(), [{ family: 'Kongtext', status: 'loaded' }, { family: 'BPdots', status: 'loaded' }]);
      }
    });
    test('FontFace hashing', async () => {
      // multiple calls of `loadFonts` with the same objects shall not bloat document.fonts
      await ctx.page.evaluate(`
        const ff1 = new FontFace('Kongtext', "url(/kongtext.regular.ttf) format('truetype')");
        const ff2 = new FontFace('BPdots', "url(/bpdots.regular.otf) format('opentype')");
        loadFonts([ff1, ff2]);
        loadFonts([ff1, ff2]);
        loadFonts([ff1, ff2]).then(() => loadFonts([ff1, ff2]));
      `);
      deepStrictEqual(await getDocumentFonts(), [{ family: 'Kongtext', status: 'loaded' }, { family: 'BPdots', status: 'loaded' }]);
    });

    test('autoload & relayout from ctor', async ({ browser }) => {
      // to make this test work, we exclude the default measurement char W (x57) by restricting unicode-range
      // now the browser will postpone font loading until codepoint is hit --> wrong glyph metrics on first usage
      const data = await ctx.page.evaluate(`
          document.styleSheets[0].insertRule("@font-face {font-family: Kongtext; src: url(/kongtext.regular.ttf) format('truetype'); unicode-range: U+00A0-00FF}", 0);
        `);
      deepStrictEqual(await getDocumentFonts(), [{ family: 'Kongtext', status: 'unloaded' }]);

      // broken case: webfont in ctor without addon usage
      await ctx.page.evaluate(`
          window.helperTerm = new Terminal({fontFamily: '"Kongtext", ' + term.options.fontFamily});
          window.helperTerm.open(term.element);
        `);

      // safari loads the font, firefox & chrome dont
      if (browser.browserType().name() === 'webkit') {
        deepStrictEqual(await getDocumentFonts(), [{ family: 'Kongtext', status: 'loaded' }]);
      } else {
        deepStrictEqual(await getDocumentFonts(), [{ family: 'Kongtext', status: 'unloaded' }]);
      }

      // good case: addon fixes layout for webfont in ctor
      // the relayout happens async, so wait a bit with a promise
      await ctx.page.evaluate(`
          window.helperTerm.dispose();
          window.helperTerm = new Terminal({fontFamily: '"Kongtext", ' + term.options.fontFamily});
          window._webfontsAddon = new WebFontsAddon();
          window.helperTerm.loadAddon(window._webfontsAddon);
          window.helperTerm.open(term.element);
        `);
      await timeout(100);
      deepStrictEqual(await getDocumentFonts(), [{ family: 'Kongtext', status: 'loaded' }]);

      // cleanup this messy test case
      await ctx.page.evaluate(`
          window.helperTerm.dispose();
          window._webfontsAddon.dispose();
        `);
    });
  });

});

async function getDocumentFonts(): Promise<any> {
  return ctx.page.evaluate(`Array.from(document.fonts).map(ff => ({family: ff.family, status: ff.status}))`);
}
