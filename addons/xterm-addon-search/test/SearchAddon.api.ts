/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { readFile } from 'fs';
import { resolve } from 'path';
import { openTerminal, writeSync, launchBrowser, timeout } from '../../../out-test/api/TestUtils';
import { Browser, Page } from 'playwright';

const APP = 'http://127.0.0.1:3001/test';

let browser: Browser;
let page: Page;
const width = 800;
const height = 600;

describe('Search Tests', function(): void {
  before(async function(): Promise<any> {
    browser = await launchBrowser();
    page = await (await browser.newContext()).newPage();
    await page.setViewportSize({ width, height });
    await page.goto(APP);
    await openTerminal(page);
  });

  after(() => {
    browser.close();
  });

  beforeEach(async () => {
    await page.evaluate(`
      window.term.reset()
      window.search?.dispose();
      window.search = new SearchAddon();
      window.term.loadAddon(window.search);
    `);
  });

  it('Simple Search', async () => {
    await writeSync(page, 'dafhdjfldshafhldsahfkjhldhjkftestlhfdsakjfhdjhlfdsjkafhjdlk');
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
    await writeSync(page, dataString);
    assert.deepEqual(await page.evaluate(`window.search.findNext('$^1_3{}test$#')`), true);
    assert.deepEqual(await page.evaluate(`window.term.getSelection()`), '$^1_3{}test$#');
  });
  it('Incremental Find Previous', async () => {
    await page.evaluate(`window.term.writeln('package.jsonc\\n')`);
    await writeSync(page, 'package.json pack package.lock');
    await page.evaluate(`window.search.findPrevious('pack', {incremental: true})`);
    let line: string = await page.evaluate(`window.term.buffer.active.getLine(window.term.getSelectionPosition().startRow).translateToString()`);
    let selectionPosition: { startColumn: number, startRow: number, endColumn: number, endRow: number } = await page.evaluate(`window.term.getSelectionPosition()`);
    // We look further ahead in the line to ensure that pack was selected from package.lock
    assert.deepEqual(line.substring(selectionPosition.startColumn, selectionPosition.endColumn + 8), 'package.lock');
    await page.evaluate(`window.search.findPrevious('package.j', {incremental: true})`);
    selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
    assert.deepEqual(line.substring(selectionPosition.startColumn, selectionPosition.endColumn + 3), 'package.json');
    await page.evaluate(`window.search.findPrevious('package.jsonc', {incremental: true})`);
    // We have to reevaluate line because it should have switched starting rows at this point
    line = await page.evaluate(`window.term.buffer.active.getLine(window.term.getSelectionPosition().startRow).translateToString()`);
    selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
    assert.deepEqual(line.substring(selectionPosition.startColumn, selectionPosition.endColumn), 'package.jsonc');
  });
  it('Incremental Find Next', async () => {
    await page.evaluate(`window.term.writeln('package.lock pack package.json package.ups\\n')`);
    await writeSync(page, 'package.jsonc');
    await page.evaluate(`window.search.findNext('pack', {incremental: true})`);
    let line: string = await page.evaluate(`window.term.buffer.active.getLine(window.term.getSelectionPosition().startRow).translateToString()`);
    let selectionPosition: { startColumn: number, startRow: number, endColumn: number, endRow: number } = await page.evaluate(`window.term.getSelectionPosition()`);
    // We look further ahead in the line to ensure that pack was selected from package.lock
    assert.deepEqual(line.substring(selectionPosition.startColumn, selectionPosition.endColumn + 8), 'package.lock');
    await page.evaluate(`window.search.findNext('package.j', {incremental: true})`);
    selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
    assert.deepEqual(line.substring(selectionPosition.startColumn, selectionPosition.endColumn + 3), 'package.json');
    await page.evaluate(`window.search.findNext('package.jsonc', {incremental: true})`);
    // We have to reevaluate line because it should have switched starting rows at this point
    line = await page.evaluate(`window.term.buffer.active.getLine(window.term.getSelectionPosition().startRow).translateToString()`);
    selectionPosition = await page.evaluate(`window.term.getSelectionPosition()`);
    assert.deepEqual(line.substring(selectionPosition.startColumn, selectionPosition.endColumn), 'package.jsonc');
  });
  it('Simple Regex', async () => {
    await writeSync(page, 'abc123defABCD');
    await page.evaluate(`window.search.findNext('[a-z]+', {regex: true})`);
    assert.deepEqual(await page.evaluate(`window.term.getSelection()`), 'abc');
    await page.evaluate(`window.search.findNext('[A-Z]+', {regex: true, caseSensitive: true})`);
    assert.deepEqual(await page.evaluate(`window.term.getSelection()`), 'ABCD');
  });

  it('Search for single result twice should not unselect it', async () => {
    await writeSync(page, 'abc def');
    assert.deepEqual(await page.evaluate(`window.search.findNext('abc')`), true);
    assert.deepEqual(await page.evaluate(`window.term.getSelection()`), 'abc');
    assert.deepEqual(await page.evaluate(`window.search.findNext('abc')`), true);
    assert.deepEqual(await page.evaluate(`window.term.getSelection()`), 'abc');
  });

  it('Search for result bounding with wide unicode chars', async () => {
    await writeSync(page, '中文xx𝄞𝄞');
    assert.deepEqual(await page.evaluate(`window.search.findNext('中')`), true);
    assert.deepEqual(await page.evaluate(`window.term.getSelection()`), '中');
    assert.deepEqual(await page.evaluate(`window.search.findNext('xx')`), true);
    assert.deepEqual(await page.evaluate(`window.term.getSelection()`), 'xx');
    assert.deepEqual(await page.evaluate(`window.search.findNext('𝄞')`), true);
    assert.deepEqual(await page.evaluate(`window.term.getSelection()`), '𝄞');
    assert.deepEqual(await page.evaluate(`window.search.findNext('𝄞')`), true);
    assert.deepEqual(await page.evaluate(`window.term.getSelectionPosition()`), {
      startRow: 0,
      endRow: 0,
      startColumn: 7,
      endColumn: 8
    });
  });

  describe('onDidChangeResults', async () => {
    describe('findNext', () => {
      it('should not fire unless the decorations option is set', async () => {
        await page.evaluate(`
          window.calls = [];
          window.search.onDidChangeResults(e => window.calls.push(e));
        `);
        await writeSync(page, 'abc');
        assert.strictEqual(await page.evaluate(`window.search.findNext('a')`), true);
        assert.strictEqual(await page.evaluate('window.calls.length'), 0);
        assert.strictEqual(await page.evaluate(`window.search.findNext('b', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
        assert.strictEqual(await page.evaluate('window.calls.length'), 1);
      });
      it('should fire with correct event values', async () => {
        await page.evaluate(`
          window.calls = [];
          window.search.onDidChangeResults(e => window.calls.push(e));
        `);
        await writeSync(page, 'abc bc c');
        assert.strictEqual(await page.evaluate(`window.search.findNext('a', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
        assert.deepStrictEqual(await page.evaluate('window.calls'), [
          { resultCount: 1, resultIndex: 0 }
        ]);
        assert.strictEqual(await page.evaluate(`window.search.findNext('b', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
        assert.deepStrictEqual(await page.evaluate('window.calls'), [
          { resultCount: 1, resultIndex: 0 },
          { resultCount: 2, resultIndex: 0 }
        ]);
        assert.strictEqual(await page.evaluate(`window.search.findNext('d', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), false);
        assert.deepStrictEqual(await page.evaluate('window.calls'), [
          { resultCount: 1, resultIndex: 0 },
          { resultCount: 2, resultIndex: 0 },
          { resultCount: -1, resultIndex: -1 }
        ]);
        assert.strictEqual(await page.evaluate(`window.search.findNext('c', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
        assert.strictEqual(await page.evaluate(`window.search.findNext('c', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
        assert.strictEqual(await page.evaluate(`window.search.findNext('c', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
        assert.deepStrictEqual(await page.evaluate('window.calls'), [
          { resultCount: 1, resultIndex: 0 },
          { resultCount: 2, resultIndex: 0 },
          { resultCount: -1, resultIndex: -1 },
          { resultCount: 3, resultIndex: 0 },
          { resultCount: 3, resultIndex: 1 },
          { resultCount: 3, resultIndex: 2 }
        ]);
      });
      it('should fire with correct event values (incremental)', async () => {
        await page.evaluate(`
          window.calls = [];
          window.search.onDidChangeResults(e => window.calls.push(e));
        `);
        await writeSync(page, 'abc aabc');
        assert.deepStrictEqual(await page.evaluate(`window.search.findNext('a', { incremental: true, decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
        assert.deepStrictEqual(await page.evaluate('window.calls'), [
          { resultCount: 3, resultIndex: 0 }
        ]);
        assert.deepStrictEqual(await page.evaluate(`window.search.findNext('ab', { incremental: true, decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
        assert.deepStrictEqual(await page.evaluate('window.calls'), [
          { resultCount: 3, resultIndex: 0 },
          { resultCount: 2, resultIndex: 0 }
        ]);
        assert.deepStrictEqual(await page.evaluate(`window.search.findNext('abc', { incremental: true, decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
        assert.deepStrictEqual(await page.evaluate('window.calls'), [
          { resultCount: 3, resultIndex: 0 },
          { resultCount: 2, resultIndex: 0 },
          { resultCount: 2, resultIndex: 0 }
        ]);
        assert.deepStrictEqual(await page.evaluate(`window.search.findNext('abc', { incremental: true, decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
        assert.deepStrictEqual(await page.evaluate('window.calls'), [
          { resultCount: 3, resultIndex: 0 },
          { resultCount: 2, resultIndex: 0 },
          { resultCount: 2, resultIndex: 0 },
          { resultCount: 2, resultIndex: 1 }
        ]);
        assert.deepStrictEqual(await page.evaluate(`window.search.findNext('abcd', { incremental: true, decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), false);
        assert.deepStrictEqual(await page.evaluate('window.calls'), [
          { resultCount: 3, resultIndex: 0 },
          { resultCount: 2, resultIndex: 0 },
          { resultCount: 2, resultIndex: 0 },
          { resultCount: 2, resultIndex: 1 },
          { resultCount: -1, resultIndex: -1 }
        ]);
      });
    });
    describe('findPrevious', () => {
      it('should not fire unless the decorations option is set', async () => {
        await page.evaluate(`
          window.calls = [];
          window.search.onDidChangeResults(e => window.calls.push(e));
        `);
        await writeSync(page, 'abc');
        assert.strictEqual(await page.evaluate(`window.search.findPrevious('a')`), true);
        assert.strictEqual(await page.evaluate('window.calls.length'), 0);
        assert.strictEqual(await page.evaluate(`window.search.findPrevious('b', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
        assert.strictEqual(await page.evaluate('window.calls.length'), 1);
      });
      it('should fire with correct event values', async () => {
        await page.evaluate(`
          window.calls = [];
          window.search.onDidChangeResults(e => window.calls.push(e));
        `);
        await writeSync(page, 'abc bc c');
        assert.strictEqual(await page.evaluate(`window.search.findPrevious('a', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
        assert.deepStrictEqual(await page.evaluate('window.calls'), [
          { resultCount: 1, resultIndex: 0 }
        ]);
        assert.strictEqual(await page.evaluate(`window.search.findPrevious('b', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
        assert.deepStrictEqual(await page.evaluate('window.calls'), [
          { resultCount: 1, resultIndex: 0 },
          { resultCount: 2, resultIndex: 1 }
        ]);
        await timeout(2000);
        assert.strictEqual(await page.evaluate(`debugger; window.search.findPrevious('d', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), false);
        assert.deepStrictEqual(await page.evaluate('window.calls'), [
          { resultCount: 1, resultIndex: 0 },
          { resultCount: 2, resultIndex: 1 },
          { resultCount: -1, resultIndex: -1 }
        ]);
        assert.strictEqual(await page.evaluate(`window.search.findPrevious('c', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
        assert.strictEqual(await page.evaluate(`window.search.findPrevious('c', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
        assert.strictEqual(await page.evaluate(`window.search.findPrevious('c', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
        assert.deepStrictEqual(await page.evaluate('window.calls'), [
          { resultCount: 1, resultIndex: 0 },
          { resultCount: 2, resultIndex: 1 },
          { resultCount: -1, resultIndex: -1 },
          { resultCount: 3, resultIndex: 2 },
          { resultCount: 3, resultIndex: 1 },
          { resultCount: 3, resultIndex: 0 }
        ]);
      });
      it('should fire with correct event values (incremental)', async () => {
        await page.evaluate(`
          window.calls = [];
          window.search.onDidChangeResults(e => window.calls.push(e));
        `);
        await writeSync(page, 'abc aabc');
        assert.deepStrictEqual(await page.evaluate(`window.search.findPrevious('a', { incremental: true, decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
        assert.deepStrictEqual(await page.evaluate('window.calls'), [
          { resultCount: 3, resultIndex: 2 }
        ]);
        assert.deepStrictEqual(await page.evaluate(`window.search.findPrevious('ab', { incremental: true, decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
        assert.deepStrictEqual(await page.evaluate('window.calls'), [
          { resultCount: 3, resultIndex: 2 },
          { resultCount: 2, resultIndex: 1 }
        ]);
        assert.deepStrictEqual(await page.evaluate(`window.search.findPrevious('abc', { incremental: true, decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
        assert.deepStrictEqual(await page.evaluate('window.calls'), [
          { resultCount: 3, resultIndex: 2 },
          { resultCount: 2, resultIndex: 1 },
          { resultCount: 2, resultIndex: 1 }
        ]);
        assert.deepStrictEqual(await page.evaluate(`window.search.findPrevious('abc', { incremental: true, decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
        assert.deepStrictEqual(await page.evaluate('window.calls'), [
          { resultCount: 3, resultIndex: 2 },
          { resultCount: 2, resultIndex: 1 },
          { resultCount: 2, resultIndex: 1 },
          { resultCount: 2, resultIndex: 0 }
        ]);
        assert.deepStrictEqual(await page.evaluate(`window.search.findPrevious('abcd', { incremental: true, decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), false);
        assert.deepStrictEqual(await page.evaluate('window.calls'), [
          { resultCount: 3, resultIndex: 2 },
          { resultCount: 2, resultIndex: 1 },
          { resultCount: 2, resultIndex: 1 },
          { resultCount: 2, resultIndex: 0 },
          { resultCount: -1, resultIndex: -1 }
        ]);
      });
    });
  });

  describe('Regression tests', () => {
    describe('#2444 wrapped line content not being found', () => {
      let fixture: string;
      before(async () => {
        const rawFixture = await new Promise<Buffer>(r => readFile(resolve(__dirname, '../fixtures/issue-2444'), (err, data) => r(data)));
        if (process.platform === 'win32') {
          fixture = rawFixture.toString()
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');
        } else {
          fixture = rawFixture.toString()
            .replace(/\n/g, '\\n\\r');
        }
        fixture = fixture
          .replace(/'/g, `\\'`);
      });
      it('should find all occurrences using findNext', async () => {
        await writeSync(page, fixture);
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
        await writeSync(page, fixture);
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

function makeData(length: number): string {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
