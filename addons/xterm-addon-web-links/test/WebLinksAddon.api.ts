/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { openTerminal, pollFor, writeSync, launchBrowser } from '../../../out-test/api/TestUtils';
import { Browser, Page } from 'playwright';

const APP = 'http://127.0.0.1:3001/test';

let browser: Browser;
let page: Page;
const width = 800;
const height = 600;

describe('WebLinksAddon', () => {
  before(async function(): Promise<any> {
    browser = await launchBrowser();
    page = await (await browser.newContext()).newPage();
    await page.setViewportSize({ width, height });
  });

  after(async () => await browser.close());
  beforeEach(async () => await page.goto(APP));

  it('.com', async function(): Promise<any> {
    await testHostName('foo.com');
  });

  it('.com.au', async function(): Promise<any> {
    await testHostName('foo.com.au');
  });

  it('.io', async function(): Promise<any> {
    await testHostName('foo.io');
  });
});

async function testHostName(hostname: string): Promise<void> {
  await openTerminal(page, { rendererType: 'dom', cols: 40 });
  await page.evaluate(`window.term.loadAddon(new window.WebLinksAddon())`);
  const data = `  http://${hostname}  \\r\\n` +
    `  http://${hostname}/a~b#c~d?e~f  \\r\\n` +
    `  http://${hostname}/colon:test  \\r\\n` +
    `  http://${hostname}/colon:test:  \\r\\n` +
    `"http://${hostname}/"\\r\\n` +
    `\\'http://${hostname}/\\'\\r\\n` +
    `http://${hostname}/subpath/+/id`;
  await writeSync(page, data);
  await pollForLinkAtCell(3, 1, `http://${hostname}`);
  await pollForLinkAtCell(3, 2, `http://${hostname}/a~b#c~d?e~f`);
  await pollForLinkAtCell(3, 3, `http://${hostname}/colon:test`);
  await pollForLinkAtCell(3, 4, `http://${hostname}/colon:test`);
  await pollForLinkAtCell(2, 5, `http://${hostname}/`);
  await pollForLinkAtCell(2, 6, `http://${hostname}/`);
  await pollForLinkAtCell(1, 7, `http://${hostname}/subpath/+/id`);
}

async function pollForLinkAtCell(col: number, row: number, value: string): Promise<void> {
  const rowSelector = `.xterm-rows > :nth-child(${row})`;
  // Ensure the hover element exists before trying to hover it
  await pollFor(page, `!!document.querySelector('${rowSelector} > :nth-child(${col})')`, true);
  await pollFor(page, `document.querySelectorAll('${rowSelector} > span[style]').length >= ${value.length}`, true, async () => page.hover(`${rowSelector} > :nth-child(${col})`));
  assert.equal(await page.evaluate(`Array.prototype.reduce.call(document.querySelectorAll('${rowSelector} > span[style]'), (a, b) => a + b.textContent, '');`), value);
}
