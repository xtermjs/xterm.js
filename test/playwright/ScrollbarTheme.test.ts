/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { expect, test } from '@playwright/test';

for (const strictCsp of [false, true]) {
  test(`scrollbar themes are isolated and update with strict CSP=${strictCsp}`, async ({ page }) => {
    await page.route('**/scrollbar-theme-test', route => route.fulfill({
      contentType: 'text/html',
      headers: strictCsp ? { 'Content-Security-Policy': 'style-src \'self\'' } : {},
      body: '<!doctype html><link rel="stylesheet" href="/xterm.css"><div id="first"></div><div id="second"></div><script src="/dist/client-bundle.js"></script>'
    }));
    await page.goto('http://127.0.0.1:3000/scrollbar-theme-test');
    await page.evaluate(`
      window.term = new window.Terminal({ rows: 3, theme: {
        scrollbarSliderBackground: '#112233',
        scrollbarSliderHoverBackground: '#445566',
        scrollbarSliderActiveBackground: '#778899'
      }});
      window.term.open(document.querySelector('#first'));
      window.secondTerm = new window.Terminal({ rows: 3, theme: {
        scrollbarSliderBackground: '#aabbcc'
      }});
      window.secondTerm.open(document.querySelector('#second'));
      window.term.write('1\\r\\n2\\r\\n3\\r\\n4\\r\\n5');
      window.secondTerm.write('1\\r\\n2\\r\\n3\\r\\n4\\r\\n5');
    `);
    const first = page.locator('#first .xterm-scrollbar.xterm-vertical > .xterm-slider');
    const second = page.locator('#second .xterm-scrollbar.xterm-vertical > .xterm-slider');
    await expect(first).toHaveCSS('background-color', 'rgb(17, 34, 51)');
    await expect(second).toHaveCSS('background-color', 'rgb(170, 187, 204)');
    await first.hover({ force: true });
    await expect(first).toHaveCSS('background-color', 'rgb(68, 85, 102)');
    await first.evaluate(el => el.classList.add('xterm-active'));
    await expect(first).toHaveCSS('background-color', 'rgb(119, 136, 153)');
    await first.evaluate(el => el.classList.remove('xterm-active'));
    await page.mouse.move(0, 0);
    await page.evaluate(`window.term.options.theme = { scrollbarSliderBackground: '#123456' };`);
    await expect(first).toHaveCSS('background-color', 'rgb(18, 52, 86)');
    await expect(second).toHaveCSS('background-color', 'rgb(170, 187, 204)');
    await page.evaluate('window.term.resize(60, 4); window.term.dispose();');
    await expect(first).toHaveCount(0);
    await expect(second).toHaveCSS('background-color', 'rgb(170, 187, 204)');
  });
}
