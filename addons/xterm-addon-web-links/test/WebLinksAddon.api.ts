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


interface ILinkStateData {
  uri?: string;
  range?: {
    start: {
      x: number;
      y: number;
    };
    end: {
      x: number;
      y: number;
    };
  };
}


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

  describe('correct buffer offsets & uri', () => {
    it('all half width', async () => {
      setupCustom();
      await writeSync(page, 'aaa http://example.com aaa http://example.com aaa');
      await resetAndHover(5, 0);
      await evalLinkStateData('http://example.com', { start: { x: 5, y: 1 }, end: { x: 22, y: 1 } });
      await resetAndHover(1, 1);
      await evalLinkStateData('http://example.com', { start: { x: 28, y: 1 }, end: { x: 5, y: 2 } });
    });
    it('url after full width', async () => {
      setupCustom();
      await writeSync(page, '￥￥￥ http://example.com ￥￥￥ http://example.com aaa');
      await resetAndHover(8, 0);
      await evalLinkStateData('http://example.com', { start: { x: 8, y: 1 }, end: { x: 25, y: 1 } });
      await resetAndHover(1, 1);
      await evalLinkStateData('http://example.com', { start: { x: 34, y: 1 }, end: { x: 11, y: 2 } });
    });
    it('full width within url and before', async () => {
      setupCustom();
      await writeSync(page, '￥￥￥ https://ko.wikipedia.org/wiki/위키백과:대문 aaa https://ko.wikipedia.org/wiki/위키백과:대문 ￥￥￥');
      await resetAndHover(8, 0);
      await evalLinkStateData('https://ko.wikipedia.org/wiki/위키백과:대문', { start: { x: 8, y: 1 }, end: { x: 11, y: 2 } });
      await resetAndHover(1, 1);
      await evalLinkStateData('https://ko.wikipedia.org/wiki/위키백과:대문', { start: { x: 8, y: 1 }, end: { x: 11, y: 2 } });
      await resetAndHover(17, 1);
      await evalLinkStateData('https://ko.wikipedia.org/wiki/위키백과:대문', { start: { x: 17, y: 2 }, end: { x: 19, y: 3 } });
    });
    it('name + password url after full width and combining', async () => {
      setupCustom();
      await writeSync(page, '￥￥￥cafe\u0301 http://test:password@example.com/some_path');
      await resetAndHover(12, 0);
      await evalLinkStateData('http://test:password@example.com/some_path', { start: { x: 12, y: 1 }, end: { x: 13, y: 2 } });
      await resetAndHover(5, 1);
      await evalLinkStateData('http://test:password@example.com/some_path', { start: { x: 12, y: 1 }, end: { x: 13, y: 2 } });
    });
  });
});

async function testHostName(hostname: string): Promise<void> {
  await openTerminal(page, { cols: 40 });
  await page.evaluate(`window.term.loadAddon(new window.WebLinksAddon())`);
  const data = `  http://${hostname}  \\r\\n` +
    `  http://${hostname}/a~b#c~d?e~f  \\r\\n` +
    `  http://${hostname}/colon:test  \\r\\n` +
    `  http://${hostname}/colon:test:  \\r\\n` +
    `"http://${hostname}/"\\r\\n` +
    `\\'http://${hostname}/\\'\\r\\n` +
    `http://${hostname}/subpath/+/id`;
  await writeSync(page, data);
  await pollForLinkAtCell(3, 0, `http://${hostname}`);
  await pollForLinkAtCell(3, 1, `http://${hostname}/a~b#c~d?e~f`);
  await pollForLinkAtCell(3, 2, `http://${hostname}/colon:test`);
  await pollForLinkAtCell(3, 3, `http://${hostname}/colon:test`);
  await pollForLinkAtCell(2, 4, `http://${hostname}/`);
  await pollForLinkAtCell(2, 5, `http://${hostname}/`);
  await pollForLinkAtCell(1, 6, `http://${hostname}/subpath/+/id`);
}

async function pollForLinkAtCell(col: number, row: number, value: string): Promise<void> {
  await page.mouse.move(...(await cellPos(col, row)));
  await pollFor(page, `!!Array.from(document.querySelectorAll('.xterm-rows > :nth-child(${row+1}) > span[style]')).filter(el => el.style.textDecoration == 'underline').length`, true);
  const text = await page.evaluate(`Array.from(document.querySelectorAll('.xterm-rows > :nth-child(${row+1}) > span[style]')).filter(el => el.style.textDecoration == 'underline').map(el => el.textContent).join(' , ');`);
  assert.deepEqual(text, value);
}

async function setupCustom(): Promise<void> {
  await openTerminal(page, { cols: 40 });
  await page.evaluate(`window._linkStateData = {uri:''};
window._linkaddon = new window.WebLinksAddon();
window._linkaddon._options.hover = (event, uri, range) => { window._linkStateData = { uri, range }; };
window.term.loadAddon(window._linkaddon);`);
}

async function resetAndHover(col: number, row: number): Promise<void> {
  await page.mouse.move(0, 0);
  await page.evaluate(`window._linkStateData = {uri:''};`);
  // FIXME: pollFor not working here - why?
  await new Promise(r => setTimeout(r, 200));
  //await pollFor(page, `!!window._linkStateData.uri.length`, false);
  await page.mouse.move(...(await cellPos(col, row)));
  await pollFor(page, `!!window._linkStateData.uri.length`, true);
}

async function evalLinkStateData(uri: string, range: any): Promise<void> {
  const data: ILinkStateData = await page.evaluate(`window._linkStateData`);
  assert.equal(data.uri, uri);
  assert.deepEqual(data.range, range);
}

async function cellPos(col: number, row: number): Promise<[number, number]> {
  const coords: any = await page.evaluate(`
    (function() {
      const rect = window.term.element.getBoundingClientRect();
      const dim = term._core._renderService.dimensions;
      return {left: rect.left, top: rect.top, bottom: rect.bottom, right: rect.right, width: dim.css.cell.width, height: dim.css.cell.height};
    })();
  `);
  return [col * coords.width + coords.left + 2, row * coords.height + coords.top + 2];
}
