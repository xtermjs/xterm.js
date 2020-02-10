/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as playwright from 'playwright';
import { assert } from 'chai';
import { ITerminalOptions } from 'xterm';
import { readFile } from 'fs';
import { resolve } from 'path';

const APP = 'http://127.0.0.1:3000/test';

let browser: playwright.Browser;
let page: playwright.Page;
const width = 800;
const height = 600;

describe('Search Tests', function (): void {
  this.timeout(20000);

  before(async function (): Promise<any> {
    browser = await getBrowserType().launch({
      headless: process.argv.indexOf('--headless') !== -1,
      args: [`--window-size=${width},${height}`, `--no-sandbox`]
    });
    page = (await browser.defaultContext().pages())[0];
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
  it('Incremental Find Previous', async () => {
    await page.evaluate(`window.term.writeln('package.jsonc\\n')`);
    await writeSync('package.json pack package.lock');
    await page.evaluate(`window.search.findPrevious('pack', {incremental: true})`);
    let line: string = await page.evaluate(`window.term.buffer.getLine(window.term.getSelectionPosition().startRow).translateToString()`);
    let selectionPosition: { startColumn: number, startRow: number, endColumn: number, endRow: number } = await page.evaluate(`window.term.getSelectionPosition()`);
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
  it('Incremental Find Next', async () => {
    await page.evaluate(`window.term.writeln('package.lock pack package.json package.ups\\n')`);
    await writeSync('package.jsonc');
    await page.evaluate(`window.search.findNext('pack', {incremental: true})`);
    let line: string = await page.evaluate(`window.term.buffer.getLine(window.term.getSelectionPosition().startRow).translateToString()`);
    let selectionPosition: { startColumn: number, startRow: number, endColumn: number, endRow: number } = await page.evaluate(`window.term.getSelectionPosition()`);
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
  it('Simple Regex', async () => {
    await writeSync('abc123defABCD');
    await page.evaluate(`window.search.findNext('[a-z]+', {regex: true})`);
    assert.deepEqual(await page.evaluate(`window.term.getSelection()`), 'abc');
    await page.evaluate(`window.search.findNext('[A-Z]+', {regex: true, caseSensitive: true})`);
    assert.deepEqual(await page.evaluate(`window.term.getSelection()`), 'ABCD');
  });

  it('Search for single result twice should not unselect it', async () => {
    await writeSync('abc def');
    assert.deepEqual(await page.evaluate(`window.search.findNext('abc')`), true);
    assert.deepEqual(await page.evaluate(`window.term.getSelection()`), 'abc');
    assert.deepEqual(await page.evaluate(`window.search.findNext('abc')`), true);
    assert.deepEqual(await page.evaluate(`window.term.getSelection()`), 'abc');
  });

  describe('Regression tests', () => {
    describe('#2444 wrapped line content not being found', () => {
      let fixture: string;
      before(async () => {
        const rawFixture = await new Promise<Buffer>(r => readFile(resolve(__dirname, '../fixtures/issue-2444'), (err, data) => r(data)));
        fixture = rawFixture.toString()
          .replace(/\n/g, '\\n\\r')
          .replace(/'/g, '\\\'');
      });
      it('should find all occurrences using findNext', async () => {
        await writeSync(fixture);
        assert.deepEqual(await page.evaluate(`window.search.findNext('opencv')`), true);
        let selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
        assert.deepEqual(selectionPosition, { startColumn: 24, startRow: 53, endColumn: 30, endRow: 53 });
        assert.deepEqual(await page.evaluate(`window.search.findNext('opencv')`), true);
        selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
        assert.deepEqual(selectionPosition, { startColumn: 24, startRow: 76, endColumn: 30, endRow: 76 });
        assert.deepEqual(await page.evaluate(`window.search.findNext('opencv')`), true);
        selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
        assert.deepEqual(selectionPosition, { startColumn: 24, startRow: 96, endColumn: 30, endRow: 96 });
        assert.deepEqual(await page.evaluate(`window.search.findNext('opencv')`), true);
        selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
        assert.deepEqual(selectionPosition, { startColumn: 1, startRow: 114, endColumn: 7, endRow: 114 });
        assert.deepEqual(await page.evaluate(`window.search.findNext('opencv')`), true);
        selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
        assert.deepEqual(selectionPosition, { startColumn: 11, startRow: 115, endColumn: 17, endRow: 115 });
        assert.deepEqual(await page.evaluate(`window.search.findNext('opencv')`), true);
        selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
        assert.deepEqual(selectionPosition, { startColumn: 1, startRow: 126, endColumn: 7, endRow: 126 });
        assert.deepEqual(await page.evaluate(`window.search.findNext('opencv')`), true);
        selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
        assert.deepEqual(selectionPosition, { startColumn: 11, startRow: 127, endColumn: 17, endRow: 127 });
        assert.deepEqual(await page.evaluate(`window.search.findNext('opencv')`), true);
        selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
        assert.deepEqual(selectionPosition, { startColumn: 1, startRow: 135, endColumn: 7, endRow: 135 });
        assert.deepEqual(await page.evaluate(`window.search.findNext('opencv')`), true);
        selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
        assert.deepEqual(selectionPosition, { startColumn: 11, startRow: 136, endColumn: 17, endRow: 136 });
        // Wrap around to first result
        assert.deepEqual(await page.evaluate(`window.search.findNext('opencv')`), true);
        selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
        assert.deepEqual(selectionPosition, { startColumn: 24, startRow: 53, endColumn: 30, endRow: 53 });
      });
      it('should find all occurrences using findPrevious', async () => {
        await writeSync(fixture);
        assert.deepEqual(await page.evaluate(`window.search.findPrevious('opencv')`), true);
        let selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
        assert.deepEqual(selectionPosition, { startColumn: 11, startRow: 136, endColumn: 17, endRow: 136 });
        assert.deepEqual(await page.evaluate(`window.search.findPrevious('opencv')`), true);
        selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
        assert.deepEqual(selectionPosition, { startColumn: 1, startRow: 135, endColumn: 7, endRow: 135 });
        assert.deepEqual(await page.evaluate(`window.search.findPrevious('opencv')`), true);
        selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
        assert.deepEqual(selectionPosition, { startColumn: 11, startRow: 127, endColumn: 17, endRow: 127 });
        assert.deepEqual(await page.evaluate(`window.search.findPrevious('opencv')`), true);
        selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
        assert.deepEqual(selectionPosition, { startColumn: 1, startRow: 126, endColumn: 7, endRow: 126 });
        assert.deepEqual(await page.evaluate(`window.search.findPrevious('opencv')`), true);
        selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
        assert.deepEqual(selectionPosition, { startColumn: 11, startRow: 115, endColumn: 17, endRow: 115 });
        assert.deepEqual(await page.evaluate(`window.search.findPrevious('opencv')`), true);
        selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
        assert.deepEqual(selectionPosition, { startColumn: 1, startRow: 114, endColumn: 7, endRow: 114 });
        assert.deepEqual(await page.evaluate(`window.search.findPrevious('opencv')`), true);
        selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
        assert.deepEqual(selectionPosition, { startColumn: 24, startRow: 96, endColumn: 30, endRow: 96 });
        assert.deepEqual(await page.evaluate(`window.search.findPrevious('opencv')`), true);
        selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
        assert.deepEqual(selectionPosition, { startColumn: 24, startRow: 76, endColumn: 30, endRow: 76 });
        assert.deepEqual(await page.evaluate(`window.search.findPrevious('opencv')`), true);
        selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
        assert.deepEqual(selectionPosition, { startColumn: 24, startRow: 53, endColumn: 30, endRow: 53 });
        // Wrap around to first result
        assert.deepEqual(await page.evaluate(`window.search.findPrevious('opencv')`), true);
        selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
        assert.deepEqual(selectionPosition, { startColumn: 11, startRow: 136, endColumn: 17, endRow: 136 });
      });
    });
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
  return page.evaluate(`new Promise(resolve => window.term.write('${data}', resolve))`);
}

function makeData(length: number): string {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function getBrowserType(): playwright.BrowserType {
  // Default to chromium
  let browserType: playwright.BrowserType = playwright['chromium'];

  const index = process.argv.indexOf('--browser');
  if (index !== -1 && process.argv.length > index + 2 && typeof process.argv[index + 1] === 'string') {
    const string = process.argv[index + 1];
    if (string === 'firefox' || string === 'webkit') {
      browserType = playwright[string];
    }
  }

  return browserType;
}
