/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import test from '@playwright/test';
import { deepStrictEqual, strictEqual } from 'assert';
import { readFile } from 'fs';
import { resolve } from 'path';
import { ITestContext, createTestContext, openTerminal, pollFor, timeout } from '../../../test/playwright/TestUtils';

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


let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx, { cols: 40 });
});
test.afterAll(async () => await ctx.page.close());

test.describe('WebLinksAddon', () => {

  test.beforeEach(async () => {
    await ctx.page.evaluate(`
      window.term.reset();
      window._linkaddon?.dispose();
    `);
    await timeout(10);
    await ctx.page.evaluate(`
      window._linkaddon = new WebLinksAddon();
      window.term.loadAddon(window._linkaddon);
    `);
  });

  const countryTlds = [
    '.ac', '.ad', '.ae', '.af', '.ag', '.ai', '.al', '.am', '.ao', '.aq', '.ar', '.as', '.at',
    '.au', '.aw', '.ax', '.az', '.ba', '.bb', '.bd', '.be', '.bf', '.bg', '.bh', '.bi', '.bj',
    '.bm', '.bn', '.bo', '.bq', '.br', '.bs', '.bt', '.bw', '.by', '.bz', '.ca', '.cc', '.cd',
    '.cf', '.cg', '.ch', '.ci', '.ck', '.cl', '.cm', '.cn', '.co', '.cr', '.cu', '.cv', '.cw',
    '.cx', '.cy', '.cz', '.de', '.dj', '.dk', '.dm', '.do', '.dz', '.ec', '.ee', '.eg', '.eh',
    '.er', '.es', '.et', '.eu', '.fi', '.fj', '.fk', '.fm', '.fo', '.fr', '.ga', '.gd', '.ge',
    '.gf', '.gg', '.gh', '.gi', '.gl', '.gm', '.gn', '.gp', '.gq', '.gr', '.gs', '.gt', '.gu',
    '.gw', '.gy', '.hk', '.hm', '.hn', '.hr', '.ht', '.hu', '.id', '.ie', '.il', '.im', '.in',
    '.io', '.iq', '.ir', '.is', '.it', '.je', '.jm', '.jo', '.jp', '.ke', '.kg', '.kh', '.ki',
    '.km', '.kn', '.kp', '.kr', '.kw', '.ky', '.kz', '.la', '.lb', '.lc', '.li', '.lk', '.lr',
    '.ls', '.lt', '.lu', '.lv', '.ly', '.ma', '.mc', '.md', '.me', '.mg', '.mh', '.mk', '.ml',
    '.mm', '.mn', '.mo', '.mp', '.mq', '.mr', '.ms', '.mt', '.mu', '.mv', '.mw', '.mx', '.my',
    '.mz', '.na', '.nc', '.ne', '.nf', '.ng', '.ni', '.nl', '.no', '.np', '.nr', '.nu', '.nz',
    '.om', '.pa', '.pe', '.pf', '.pg', '.ph', '.pk', '.pl', '.pm', '.pn', '.pr', '.ps', '.pt',
    '.pw', '.py', '.qa', '.re', '.ro', '.rs', '.ru', '.rw', '.sa', '.sb', '.sc', '.sd', '.se',
    '.sg', '.sh', '.si', '.sk', '.sl', '.sm', '.sn', '.so', '.sr', '.ss', '.st', '.su', '.sv',
    '.sx', '.sy', '.sz', '.tc', '.td', '.tf', '.tg', '.th', '.tj', '.tk', '.tl', '.tm', '.tn',
    '.to', '.tr', '.tt', '.tv', '.tw', '.tz', '.ua', '.ug', '.uk', '.us', '.uy', '.uz', '.va',
    '.vc', '.ve', '.vg', '.vi', '.vn', '.vu', '.wf', '.ws', '.ye', '.yt', '.za', '.zm', '.zw'
  ];
  for (const tld of countryTlds) {
    test(tld, async () => await testHostName(`foo${tld}`));
  }
  test(`.com`, async () => await testHostName(`foo.com`));
  for (const tld of countryTlds) {
    test(`.com${tld}`, async () => await testHostName(`foo.com${tld}`));
  }

  test.describe('correct buffer offsets & uri', () => {
    test.beforeEach(async () => {
      await ctx.page.evaluate(`
        window._linkStateData = {uri:''};
        window._linkaddon._options.hover = (event, uri, range) => { window._linkStateData = { uri, range }; };
      `);
    });
    test('all half width', async () => {
      await ctx.proxy.write('aaa http://example.com aaa http://example.com aaa');
      await resetAndHover(5, 0);
      await evalLinkStateData('http://example.com', { start: { x: 5, y: 1 }, end: { x: 22, y: 1 } });
      await resetAndHover(1, 1);
      await evalLinkStateData('http://example.com', { start: { x: 28, y: 1 }, end: { x: 5, y: 2 } });
    });
    test('url after full width', async () => {
      await ctx.proxy.write('￥￥￥ http://example.com ￥￥￥ http://example.com aaa');
      await resetAndHover(8, 0);
      await evalLinkStateData('http://example.com', { start: { x: 8, y: 1 }, end: { x: 25, y: 1 } });
      await resetAndHover(1, 1);
      await evalLinkStateData('http://example.com', { start: { x: 34, y: 1 }, end: { x: 11, y: 2 } });
    });
    test('full width within url and before', async () => {
      await ctx.proxy.write('￥￥￥ https://ko.wikipedia.org/wiki/위키백과:대문 aaa https://ko.wikipedia.org/wiki/위키백과:대문 ￥￥￥');
      await resetAndHover(8, 0);
      await evalLinkStateData('https://ko.wikipedia.org/wiki/위키백과:대문', { start: { x: 8, y: 1 }, end: { x: 11, y: 2 } });
      await resetAndHover(1, 1);
      await evalLinkStateData('https://ko.wikipedia.org/wiki/위키백과:대문', { start: { x: 8, y: 1 }, end: { x: 11, y: 2 } });
      await resetAndHover(17, 1);
      await evalLinkStateData('https://ko.wikipedia.org/wiki/위키백과:대문', { start: { x: 17, y: 2 }, end: { x: 19, y: 3 } });
    });
    test('name + password url after full width and combining', async () => {
      await ctx.proxy.write('￥￥￥cafe\u0301 http://test:password@example.com/some_path');
      await resetAndHover(12, 0);
      await evalLinkStateData('http://test:password@example.com/some_path', { start: { x: 12, y: 1 }, end: { x: 13, y: 2 } });
      await resetAndHover(5, 1);
      await evalLinkStateData('http://test:password@example.com/some_path', { start: { x: 12, y: 1 }, end: { x: 13, y: 2 } });
    });
    test('url encoded params work properly', async () => {
      await ctx.proxy.write('￥￥￥cafe\u0301 http://test:password@example.com/some_path?param=1%202%3');
      await resetAndHover(12, 0);
      await evalLinkStateData('http://test:password@example.com/some_path?param=1%202%3', { start: { x: 12, y: 1 }, end: { x: 27, y: 2 } });
      await resetAndHover(5, 1);
      await evalLinkStateData('http://test:password@example.com/some_path?param=1%202%3', { start: { x: 12, y: 1 }, end: { x: 27, y: 2 } });
    });
  });

  // issue #4964
  test('uppercase in protocol and host, default ports', async () => {
    await ctx.proxy.write(
      `  HTTP://EXAMPLE.COM  \r\n` +
      `  HTTPS://Example.com  \r\n` +
      `  HTTP://Example.com:80  \r\n` +
      `  HTTP://Example.com:80/staysUpper  \r\n` +
      `  HTTP://Ab:xY@abc.com:80/staysUpper  \r\n`
    );
    await pollForLinkAtCell(3, 0, `HTTP://EXAMPLE.COM`);
    await pollForLinkAtCell(3, 1, `HTTPS://Example.com`);
    await pollForLinkAtCell(3, 2, `HTTP://Example.com:80`);
    await pollForLinkAtCell(3, 3, `HTTP://Example.com:80/staysUpper`);
    await pollForLinkAtCell(3, 4, `HTTP://Ab:xY@abc.com:80/staysUpper`);
  });
});

async function testHostName(hostname: string): Promise<void> {
  await ctx.proxy.write(
    `  http://${hostname}  \r\n` +
    `  http://${hostname}/a~b#c~d?e~f  \r\n` +
    `  http://${hostname}/colon:test  \r\n` +
    `  http://${hostname}/colon:test:  \r\n` +
    `"http://${hostname}/"\r\n` +
    `\'http://${hostname}/\'\r\n` +
    `http://${hostname}/subpath/+/id`
  );
  await pollForLinkAtCell(3, 0, `http://${hostname}`);
  await pollForLinkAtCell(3, 1, `http://${hostname}/a~b#c~d?e~f`);
  await pollForLinkAtCell(3, 2, `http://${hostname}/colon:test`);
  await pollForLinkAtCell(3, 3, `http://${hostname}/colon:test`);
  await pollForLinkAtCell(2, 4, `http://${hostname}/`);
  await pollForLinkAtCell(2, 5, `http://${hostname}/`);
  await pollForLinkAtCell(1, 6, `http://${hostname}/subpath/+/id`);
}

async function pollForLinkAtCell(col: number, row: number, value: string): Promise<void> {
  await ctx.page.mouse.move(...(await cellPos(col, row)));
  await pollFor(ctx.page, `!!Array.from(document.querySelectorAll('.xterm-rows > :nth-child(${row+1}) > span[style]')).filter(el => el.style.textDecoration == 'underline').length`, true);
  const text = await ctx.page.evaluate(`Array.from(document.querySelectorAll('.xterm-rows > :nth-child(${row+1}) > span[style]')).filter(el => el.style.textDecoration == 'underline').map(el => el.textContent).join('');`);
  deepStrictEqual(text, value);
}

async function resetAndHover(col: number, row: number): Promise<void> {
  await ctx.page.mouse.move(0, 0);
  await ctx.page.evaluate(`window._linkStateData = {uri:''};`);
  await new Promise(r => setTimeout(r, 200));
  await ctx.page.mouse.move(...(await cellPos(col, row)));
  await pollFor(ctx.page, `!!window._linkStateData.uri.length`, true);
}

async function evalLinkStateData(uri: string, range: any): Promise<void> {
  const data: ILinkStateData = await ctx.page.evaluate(`window._linkStateData`);
  strictEqual(data.uri, uri);
  deepStrictEqual(data.range, range);
}

async function cellPos(col: number, row: number): Promise<[number, number]> {
  const coords: any = await ctx.page.evaluate(`
    (function() {
      const rect = window.term.element.getBoundingClientRect();
      const dim = term._core._renderService.dimensions;
      return {left: rect.left, top: rect.top, bottom: rect.bottom, right: rect.right, width: dim.css.cell.width, height: dim.css.cell.height};
    })();
  `);
  return [col * coords.width + coords.left + 2, row * coords.height + coords.top + 2];
}
