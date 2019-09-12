/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as puppeteer from 'puppeteer';
import { assert } from 'chai';
import { ITerminalOptions } from 'xterm';

const APP = 'http://127.0.0.1:3000/test';

let browser: puppeteer.Browser;
let page: puppeteer.Page;
const width = 800;
const height = 600;

describe('Search Tests', function (): void {
  this.timeout(200000);

  before(async function (): Promise<any> {
    browser = await puppeteer.launch({
      headless: process.argv.indexOf('--headless') !== -1,
      slowMo: 80,
      args: [`--window-size=${width},${height}`]
    });
    page = (await browser.pages())[0];
    await page.setViewport({ width, height });
    await page.goto(APP);
    await openTerminal();
    await page.evaluate(`window.search = new SearchAddon();`);
    await page.evaluate(`window.term.loadAddon(window.search);`);
  });

  after(() => {
    browser.close();
  });

  beforeEach(async () => {
    await page.evaluate(`window.term.reset()`);
  });

  it('Simple Search', async () => {
    await writeSync('dafhdjfldshafhldsahfkjhldhjkftestlhfdsakjfhdjhlfdsjkafhjdlk');
    assert.deepEqual(await page.evaluate(`window.search.findNext('test')`), true);
    assert.deepEqual(await page.evaluate(`window.term.getSelection()`), 'test');
  });

  it('Scrolling Search', async () => {
    let dataString = '';
    for (let i = 0; i < 100; i++) {
      if (i === 52) {
        dataString += '$^1_3{}test$#';
      }
      dataString += makeData(50);
    }
    await writeSync(dataString);
    assert.deepEqual(await page.evaluate(`window.search.findNext('$^1_3{}test$#')`), true);
    assert.deepEqual(await page.evaluate(`window.term.getSelection()`), '$^1_3{}test$#');
  });
  it ('Incremental Find Previous', async () => {
    await page.evaluate(`window.term.writeln('package.jsonc\\n')`);
    await writeSync('package.json pack package.lock');
    await page.evaluate(`window.search.findPrevious('pack', {incremental: true})`);
    let line: string = await page.evaluate(`window.term.buffer.getLine(window.term.getSelectionPosition().startRow).translateToString()`);
    let selectionPosition: {startColumn: number, startRow: number, endColumn: number, endRow: number} = await page.evaluate(`window.term.getSelectionPosition()`);
    // We look further ahead in the line to ensure that pack was selected from package.lock
    assert.deepEqual(line.substring(selectionPosition.startColumn, selectionPosition.endColumn + 8), 'package.lock');
    await page.evaluate(`window.search.findPrevious('package.j', {incremental: true})`);
    selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
    assert.deepEqual(line.substring(selectionPosition.startColumn, selectionPosition.endColumn + 3), 'package.json');
    await page.evaluate(`window.search.findPrevious('package.jsonc', {incremental: true})`);
    // We have to reevaluate line because it should have switched starting rows at this point
    line = await page.evaluate(`window.term.buffer.getLine(window.term.getSelectionPosition().startRow).translateToString()`);
    selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
    assert.deepEqual(line.substring(selectionPosition.startColumn, selectionPosition.endColumn), 'package.jsonc');
  });
  it ('Incremental Find Next', async () => {
    await page.evaluate(`window.term.writeln('package.lock pack package.json package.ups\\n')`);
    await writeSync('package.jsonc');
    await page.evaluate(`window.search.findNext('pack', {incremental: true})`);
    let line: string = await page.evaluate(`window.term.buffer.getLine(window.term.getSelectionPosition().startRow).translateToString()`);
    let selectionPosition: {startColumn: number, startRow: number, endColumn: number, endRow: number} = await page.evaluate(`window.term.getSelectionPosition()`);
    // We look further ahead in the line to ensure that pack was selected from package.lock
    assert.deepEqual(line.substring(selectionPosition.startColumn, selectionPosition.endColumn + 8), 'package.lock');
    await page.evaluate(`window.search.findNext('package.j', {incremental: true})`);
    selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
    assert.deepEqual(line.substring(selectionPosition.startColumn, selectionPosition.endColumn + 3), 'package.json');
    await page.evaluate(`window.search.findNext('package.jsonc', {incremental: true})`);
    // We have to reevaluate line because it should have switched starting rows at this point
    line = await page.evaluate(`window.term.buffer.getLine(window.term.getSelectionPosition().startRow).translateToString()`);
    selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
    assert.deepEqual(line.substring(selectionPosition.startColumn, selectionPosition.endColumn), 'package.jsonc');
  });
  it ('Simple Regex', async () => {
    await writeSync('abc123defABCD');
    await page.evaluate(`window.search.findNext('[a-z]+', {regex: true})`);
    assert.deepEqual(await page.evaluate(`window.term.getSelection()`), 'abc');
    await page.evaluate(`window.search.findNext('[A-Z]+', {regex: true, caseSensitive: true})`);
    assert.deepEqual(await page.evaluate(`window.term.getSelection()`), 'ABCD');
  });
});

async function openTerminal(options: ITerminalOptions = {}): Promise<void> {
  await page.evaluate(`window.term = new Terminal(${JSON.stringify(options)})`);
  await page.evaluate(`window.term.open(document.querySelector('#terminal-container'))`);
  if (options.rendererType === 'dom') {
    await page.waitForSelector('.xterm-rows');
  } else {
    await page.waitForSelector('.xterm-text-layer');
  }
}

async function writeSync(data: string): Promise<void> {
  await page.evaluate(`window.term.write('${data}');`);
  while (true) {
    if (await page.evaluate(`window.term._core._writeBuffer.length === 0`)) {
      break;
    }
  }
}

function makeData(length: number): string {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
