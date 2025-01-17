/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test from '@playwright/test';
import { deepStrictEqual, strictEqual } from 'assert';
import { readFile } from 'fs';
import { resolve } from 'path';
import { ITestContext, createTestContext, openTerminal, timeout } from '../../../test/playwright/TestUtils';

/**
 * TIMEOUT should equal debounceTime + processing time for search to finish
 * for small search tests this could be a 0 when PriorityTaskQueue is used
 */
const TIMEOUT= 350;
let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx, { cols: 80, rows: 24 });
});
test.afterAll(async () => await ctx.page.close());

test.describe('Search Tests', () => {

  test.beforeEach(async () => {
    await ctx.page.evaluate(`
      window.term.reset()
      window.search?.dispose();
      window.search = new SearchAddon();
      window.term.loadAddon(window.search);
      window.calls = [];
      window.search.onDidChangeResults(e => window.calls.push(e));
    `);
  });

  test('Simple Search', async () => {
    await ctx.proxy.write('dafhdjfldshafhldsahfkjhldhjkftestlhfdsakjfhdjhlfdsjkafhjdlk');
    await ctx.page.evaluate(`window.search.findNext('test')`);

    await timeout(TIMEOUT);

    deepStrictEqual(await ctx.proxy.getSelection(), 'test');
    deepStrictEqual(
      await ctx.page.evaluate('window.calls[window.calls.length-1]'),
      { resultCount: 1, resultIndex: 0, searchCompleted : true }
    );
  });

  test('Scrolling Search', async () => {
    let dataString = '';
    for (let i = 0; i < 100; i++) {
      if (i === 52) {
        dataString += '$^1_3{}test$#';
      }
      dataString += makeData(50);
    }
    await ctx.proxy.write(dataString);
    await ctx.page.evaluate(`window.search.findNext('$^1_3{}test$#')`);

    await timeout(TIMEOUT);

    deepStrictEqual(await ctx.proxy.getSelection(), '$^1_3{}test$#');
    deepStrictEqual(
      await ctx.page.evaluate('window.calls[window.calls.length-1]'),
      { resultCount: 1, resultIndex: 0, searchCompleted : true }
    );
  });

  // test('Incremental Find Previous', async () => {
  //   await ctx.proxy.writeln(`package.jsonc\n`);
  //   await ctx.proxy.write('package.json pack package.lock');
  //   await ctx.page.evaluate(`window.search.findPrevious('pack', {incremental: true})`);
  //   let selectionPosition: { start: { x: number, y: number }, end: { x: number, y: number } } = (await ctx.proxy.getSelectionPosition())!;
  //   let line: string = await (await ctx.proxy.buffer.active.getLine(selectionPosition.start.y))!.translateToString();
  //   // We look further ahead in the line to ensure that pack was selected from package.lock
  //   deepStrictEqual(line.substring(selectionPosition.start.x, selectionPosition.end.x + 8), 'package.lock');
  //   await ctx.page.evaluate(`window.search.findPrevious('package.j', {incremental: true})`);
  //   selectionPosition = (await ctx.proxy.getSelectionPosition())!;
  //   deepStrictEqual(line.substring(selectionPosition.start.x, selectionPosition.end.x + 3), 'package.json');
  //   await ctx.page.evaluate(`window.search.findPrevious('package.jsonc', {incremental: true})`);
  //   // We have to reevaluate line because it should have switched starting rows at this point
  //   selectionPosition = (await ctx.proxy.getSelectionPosition())!;
  //   line = await (await ctx.proxy.buffer.active.getLine(selectionPosition.start.y))!.translateToString();
  //   deepStrictEqual(line.substring(selectionPosition.start.x, selectionPosition.end.x), 'package.jsonc');
  // });
  // test('Incremental Find Next', async () => {
  //   await ctx.proxy.writeln(`package.lock pack package.json package.ups\n`);
  //   await ctx.proxy.write('package.jsonc');
  //   await ctx.page.evaluate(`window.search.findNext('pack', {incremental: true})`);
  //   let selectionPosition: { start: { x: number, y: number }, end: { x: number, y: number } } = (await ctx.proxy.getSelectionPosition())!;
  //   let line: string = await (await ctx.proxy.buffer.active.getLine(selectionPosition.start.y))!.translateToString();
  //   // We look further ahead in the line to ensure that pack was selected from package.lock
  //   deepStrictEqual(line.substring(selectionPosition.start.x, selectionPosition.end.x + 8), 'package.lock');
  //   await ctx.page.evaluate(`window.search.findNext('package.j', {incremental: true})`);
  //   selectionPosition = (await ctx.proxy.getSelectionPosition())!;
  //   deepStrictEqual(line.substring(selectionPosition.start.x, selectionPosition.end.x + 3), 'package.json');
  //   await ctx.page.evaluate(`window.search.findNext('package.jsonc', {incremental: true})`);
  //   // We have to reevaluate line because it should have switched starting rows at this point
  //   selectionPosition = (await ctx.proxy.getSelectionPosition())!;
  //   line = await (await ctx.proxy.buffer.active.getLine(selectionPosition.start.y))!.translateToString();
  //   deepStrictEqual(line.substring(selectionPosition.start.x, selectionPosition.end.x), 'package.jsonc');
  // });
  test('Simple Regex', async () => {
    await ctx.proxy.write('abc123defABCD');
    await ctx.page.evaluate(`window.search.findNext('[a-z]+', {regex: true})`);
    await timeout(TIMEOUT);
    deepStrictEqual(await ctx.proxy.getSelection(), 'abc');
    await timeout(TIMEOUT);
    await ctx.page.evaluate(`window.search.findNext('[A-Z]+', {regex: true, caseSensitive: true})`);
    await timeout(TIMEOUT);
    deepStrictEqual(await ctx.proxy.getSelection(), 'ABCD');
  });

  test('Search for single result twice should not unselect it', async () => {
    await ctx.proxy.write('abc def');

    await ctx.page.evaluate(`window.search.findNext('abc')`);
    await timeout(TIMEOUT);
    deepStrictEqual(
      await ctx.page.evaluate('window.calls[window.calls.length-1]'),
      { resultCount: 1, resultIndex: 0, searchCompleted : true }
    );
    deepStrictEqual(await ctx.proxy.getSelection(), 'abc');


    await ctx.page.evaluate(`window.search.findNext('abc')`);
    await timeout(TIMEOUT);
    deepStrictEqual(
      await ctx.page.evaluate('window.calls[window.calls.length-1]'),
      { resultCount: 1, resultIndex: 0, searchCompleted : true }
    );
    deepStrictEqual(await ctx.proxy.getSelection(), 'abc');
  });

  test('Search for result bounding with wide unicode chars', async () => {
    await ctx.proxy.write('中文xx𝄞𝄞');

    await ctx.page.evaluate(`window.search.findNext('中')`);
    await timeout(TIMEOUT);
    deepStrictEqual(
      await ctx.page.evaluate('window.calls[window.calls.length-1]'),
      { resultCount: 1, resultIndex: 0, searchCompleted : true }
    );
    deepStrictEqual(await ctx.proxy.getSelection(), '中');

    await ctx.page.evaluate(`window.search.findNext('xx')`);
    await timeout(TIMEOUT);
    deepStrictEqual(
      await ctx.page.evaluate('window.calls[window.calls.length-1]'),
      { resultCount: 1, resultIndex: 0, searchCompleted : true }
    );
    deepStrictEqual(await ctx.proxy.getSelection(), 'xx');

    await ctx.page.evaluate(`window.search.findNext('𝄞')`);
    await timeout(TIMEOUT);
    deepStrictEqual(
      await ctx.page.evaluate('window.calls[window.calls.length-1]'),
      { resultCount: 2, resultIndex: 0, searchCompleted : true }
    );
    deepStrictEqual(await ctx.proxy.getSelection(), '𝄞');

    await ctx.page.evaluate(`window.search.findNext('𝄞')`);
    await timeout(TIMEOUT);
    deepStrictEqual(
      await ctx.page.evaluate('window.calls[window.calls.length-1]'),
      { resultCount: 2, resultIndex: 1, searchCompleted : true }
    );
    deepStrictEqual(await ctx.proxy.getSelection(), '𝄞');

    deepStrictEqual(await ctx.proxy.getSelectionPosition(), {
      start: {
        x: 7,
        y: 0
      },
      end: {
        x: 8,
        y: 0
      }
    });
  });

  test.describe('onDidChangeResults', async () => {
    test.describe('findNext', () => {
    //      // The only way to get results now is to listen to onDidChangeResults
    //      // because we are doing things asynchronously
    //      // Option1 is to fire on all, which is the way the code is behaving at this point to allow others test to be run
    //      // with this option we remove this test.
    //      // Option2 is to leave this intact, and add a public method for consumers to read the results.
    //      // Options 3: is there a way to detect testing environment in the add-on ?
    //      test('should not fire unless the decorations option is set', async () => {
    //       await ctx.proxy.write('abc');
    //       strictEqual(await ctx.page.evaluate(`window.search.findNext('a')`), true);
    //       strictEqual(await ctx.page.evaluate('window.calls.length'), 0);
    //       strictEqual(await ctx.page.evaluate(`window.search.findNext('b', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
    //       strictEqual(await ctx.page.evaluate('window.calls.length'), 1);
    //     });
      test('should fire with correct event values', async () => {
        await ctx.proxy.write('abc bc c');
        await ctx.page.evaluate(`window.search.findNext('a', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`);
        await timeout(TIMEOUT);
        deepStrictEqual(await ctx.page.evaluate('window.calls[window.calls.length - 1 ]'),
          { resultCount: 1, resultIndex: 0, searchCompleted: true }
        );
        await ctx.page.evaluate(`window.search.findNext('b', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`);
        await timeout(TIMEOUT);
        deepStrictEqual(await ctx.page.evaluate('window.calls[window.calls.length - 1 ]'),
          { resultCount: 2, resultIndex: 0, searchCompleted: true  });

        await ctx.page.evaluate(`window.search.findNext('d', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`);
        await timeout(TIMEOUT);
        deepStrictEqual(await ctx.page.evaluate('window.calls[window.calls.length - 1 ]'),
          { resultCount: 0, resultIndex: -1, searchCompleted: true  });

        await ctx.page.evaluate(`window.search.findNext('c', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`);
        await timeout(TIMEOUT);
        await ctx.page.evaluate(`window.search.findNext('c', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`);
        await timeout(TIMEOUT);
        await ctx.page.evaluate(`window.search.findNext('c', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`);
        await timeout(TIMEOUT);

        deepStrictEqual(await ctx.page.evaluate('window.calls[window.calls.length - 1 ]'),
          { resultCount: 3, resultIndex: 2, searchCompleted: true  });
      });
    //     test('should fire with correct event values (incremental)', async () => {
    //       await ctx.page.evaluate(`
    //         window.calls = [];
    //         window.search.onDidChangeResults(e => window.calls.push(e));
    //       `);
    //       await ctx.proxy.write('d abc aabc d');
    //       deepStrictEqual(await ctx.page.evaluate(`window.search.findNext('a', { incremental: true, decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
    //       deepStrictEqual(await ctx.page.evaluate('window.calls'), [
    //         { resultCount: 3, resultIndex: 0 }
    //       ]);
    //       deepStrictEqual(await ctx.page.evaluate(`window.search.findNext('ab', { incremental: true, decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
    //       deepStrictEqual(await ctx.page.evaluate('window.calls'), [
    //         { resultCount: 3, resultIndex: 0 },
    //         { resultCount: 2, resultIndex: 0 }
    //       ]);
    //       deepStrictEqual(await ctx.page.evaluate(`window.search.findNext('abc', { incremental: true, decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
    //       deepStrictEqual(await ctx.page.evaluate('window.calls'), [
    //         { resultCount: 3, resultIndex: 0 },
    //         { resultCount: 2, resultIndex: 0 },
    //         { resultCount: 2, resultIndex: 0 }
    //       ]);
    //       deepStrictEqual(await ctx.page.evaluate(`window.search.findNext('abc', { incremental: true, decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
    //       deepStrictEqual(await ctx.page.evaluate('window.calls'), [
    //         { resultCount: 3, resultIndex: 0 },
    //         { resultCount: 2, resultIndex: 0 },
    //         { resultCount: 2, resultIndex: 0 },
    //         { resultCount: 2, resultIndex: 1 }
    //       ]);
    //       deepStrictEqual(await ctx.page.evaluate(`window.search.findNext('d', { incremental: true, decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
    //       deepStrictEqual(await ctx.page.evaluate('window.calls'), [
    //         { resultCount: 3, resultIndex: 0 },
    //         { resultCount: 2, resultIndex: 0 },
    //         { resultCount: 2, resultIndex: 0 },
    //         { resultCount: 2, resultIndex: 1 },
    //         { resultCount: 2, resultIndex: 1 }
    //       ]);
    //       deepStrictEqual(await ctx.page.evaluate(`window.search.findNext('abcd', { incremental: true, decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), false);
    //       deepStrictEqual(await ctx.page.evaluate('window.calls'), [
    //         { resultCount: 3, resultIndex: 0 },
    //         { resultCount: 2, resultIndex: 0 },
    //         { resultCount: 2, resultIndex: 0 },
    //         { resultCount: 2, resultIndex: 1 },
    //         { resultCount: 2, resultIndex: 1 },
    //         { resultCount: 0, resultIndex: -1 }
    //       ]);
    });
    test('should fire with more than 1k matches', async () => {
      const data = ('a bc'.repeat(10) + '\\n\\r').repeat(150);
      await ctx.proxy.write(data);
      await ctx.page.evaluate('window.term.scrollToTop()');
      await ctx.page.evaluate(`window.search.findNext('a', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`);
      await timeout(TIMEOUT * 4);
      deepStrictEqual(await ctx.proxy.getSelection(), 'a');
      deepStrictEqual(
        await ctx.page.evaluate('window.calls[window.calls.length-1]'),
        { resultCount: 1000, resultIndex: 0, searchCompleted : true }
      );

      await ctx.page.evaluate(`window.search.findNext('a', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`);
      await timeout(TIMEOUT);
      deepStrictEqual(await ctx.proxy.getSelection(), 'a');
      deepStrictEqual(
        await ctx.page.evaluate('window.calls[window.calls.length-1]'),
        { resultCount: 1000, resultIndex: 1, searchCompleted : true }
      );


      await ctx.page.evaluate(`window.search.findNext('bc', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`);
      await timeout(TIMEOUT * 4);
      deepStrictEqual(await ctx.proxy.getSelection(), 'bc');
      deepStrictEqual(
        await ctx.page.evaluate('window.calls[window.calls.length-1]'),
        { resultCount: 1000, resultIndex: 0, searchCompleted : true }
      );

    });
    test('should fire when writing to terminal', async () => {
      await ctx.proxy.write('abc bc c\\n\\r'.repeat(2));
      await ctx.page.evaluate(`window.search.findNext('abc', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`);
      await timeout(TIMEOUT);
      deepStrictEqual(
        await ctx.page.evaluate('window.calls[window.calls.length-1]'),
        { resultCount: 2, resultIndex: 0, searchCompleted : true }
      );

      await ctx.proxy.write('abc bc c\\n\\r');
      await timeout(TIMEOUT * 4);
      deepStrictEqual(
        await ctx.page.evaluate('window.calls[window.calls.length-1]'),
        { resultCount: 3, resultIndex: 0, searchCompleted : true }
      );
    });
  });
  test.describe('findPrevious', () => {
    // test('should not fire unless the decorations option is set', async () => {
    //   await ctx.page.evaluate(`
    //     window.calls = [];
    //     window.search.onDidChangeResults(e => window.calls.push(e));
    //   `);
    //   await ctx.proxy.write('abc');
    //   strictEqual(await ctx.page.evaluate(`window.search.findPrevious('a')`), true);
    //   strictEqual(await ctx.page.evaluate('window.calls.length'), 0);
    //   strictEqual(await ctx.page.evaluate(`window.search.findPrevious('b', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
    //   strictEqual(await ctx.page.evaluate('window.calls.length'), 1);
    // });
    test('should fire with correct event values', async () => {

      await ctx.proxy.write('abc bc c');
      await ctx.page.evaluate(`window.search.findPrevious('a', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`);
      await timeout(TIMEOUT);
      deepStrictEqual(
        await ctx.page.evaluate('window.calls[window.calls.length-1]'),
        { resultCount: 1, resultIndex: 0, searchCompleted : true });


      await ctx.page.evaluate(`window.term.clearSelection()`);
      await ctx.page.evaluate(`window.search.findPrevious('b', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`);
      await timeout(TIMEOUT);
      deepStrictEqual(
        await ctx.page.evaluate('window.calls[window.calls.length-1]'),
        { resultCount: 2, resultIndex: 1, searchCompleted : true }
      );

      await timeout(2000);

      await ctx.page.evaluate(`debugger; window.search.findPrevious('d', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`);
      await timeout(TIMEOUT);
      deepStrictEqual(
        await ctx.page.evaluate('window.calls[window.calls.length-1]'),
        { resultCount: 0, resultIndex: -1, searchCompleted : true }
      );
      await ctx.page.evaluate(`window.search.findPrevious('c', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`);
      await timeout(TIMEOUT);
      deepStrictEqual(
        await ctx.page.evaluate('window.calls[window.calls.length-1]'),
        { resultCount: 3, resultIndex: 2, searchCompleted : true }
      );
      await ctx.page.evaluate(`window.search.findPrevious('c', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`);
      await timeout(TIMEOUT);
      deepStrictEqual(
        await ctx.page.evaluate('window.calls[window.calls.length-1]'),
        { resultCount: 3, resultIndex: 1, searchCompleted : true }
      );
      await ctx.page.evaluate(`window.search.findPrevious('c', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`);
      await timeout(TIMEOUT);
      deepStrictEqual(
        await ctx.page.evaluate('window.calls[window.calls.length-1]'),
        { resultCount: 3, resultIndex: 0, searchCompleted : true }
      );
    });
    // test('should fire with correct event values (incremental)', async () => {
    //   await ctx.page.evaluate(`
    //     window.calls = [];
    //     window.search.onDidChangeResults(e => window.calls.push(e));
    //   `);
    //   await ctx.proxy.write('d abc aabc d');
    //   deepStrictEqual(await ctx.page.evaluate(`window.search.findPrevious('a', { incremental: true, decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
    //   deepStrictEqual(await ctx.page.evaluate('window.calls'), [
    //     { resultCount: 3, resultIndex: 2 }
    //   ]);
    //   deepStrictEqual(await ctx.page.evaluate(`window.search.findPrevious('ab', { incremental: true, decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
    //   deepStrictEqual(await ctx.page.evaluate('window.calls'), [
    //     { resultCount: 3, resultIndex: 2 },
    //     { resultCount: 2, resultIndex: 1 }
    //   ]);
    //   deepStrictEqual(await ctx.page.evaluate(`window.search.findPrevious('abc', { incremental: true, decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
    //   deepStrictEqual(await ctx.page.evaluate('window.calls'), [
    //     { resultCount: 3, resultIndex: 2 },
    //     { resultCount: 2, resultIndex: 1 },
    //     { resultCount: 2, resultIndex: 1 }
    //   ]);
    //   deepStrictEqual(await ctx.page.evaluate(`window.search.findPrevious('abc', { incremental: true, decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
    //   deepStrictEqual(await ctx.page.evaluate('window.calls'), [
    //     { resultCount: 3, resultIndex: 2 },
    //     { resultCount: 2, resultIndex: 1 },
    //     { resultCount: 2, resultIndex: 1 },
    //     { resultCount: 2, resultIndex: 0 }
    //   ]);
    //   deepStrictEqual(await ctx.page.evaluate(`window.search.findPrevious('d', { incremental: true, decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
    //   deepStrictEqual(await ctx.page.evaluate('window.calls'), [
    //     { resultCount: 3, resultIndex: 2 },
    //     { resultCount: 2, resultIndex: 1 },
    //     { resultCount: 2, resultIndex: 1 },
    //     { resultCount: 2, resultIndex: 0 },
    //     { resultCount: 2, resultIndex: 1 }
    //   ]);
    //   deepStrictEqual(await ctx.page.evaluate(`window.search.findPrevious('abcd', { incremental: true, decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), false);
    //   deepStrictEqual(await ctx.page.evaluate('window.calls'), [
    //     { resultCount: 3, resultIndex: 2 },
    //     { resultCount: 2, resultIndex: 1 },
    //     { resultCount: 2, resultIndex: 1 },
    //     { resultCount: 2, resultIndex: 0 },
    //     { resultCount: 2, resultIndex: 1 },
    //     { resultCount: 0, resultIndex: -1 }
    //   ]);
    // });
    // test('should fire with more than 1k matches', async () => {
    //   await ctx.page.evaluate(`
    //     window.calls = [];
    //     window.search.onDidChangeResults(e => window.calls.push(e));
    //   `);
    //   const data = ('a bc'.repeat(10) + '\\n\\r').repeat(150);
    //   await ctx.proxy.write(data);
    //   strictEqual(await ctx.page.evaluate(`window.search.findPrevious('a', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
    //   deepStrictEqual(await ctx.page.evaluate('window.calls'), [
    //     { resultCount: 1000, resultIndex: -1 }
    //   ]);
    //   strictEqual(await ctx.page.evaluate(`window.search.findPrevious('a', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
    //   deepStrictEqual(await ctx.page.evaluate('window.calls'), [
    //     { resultCount: 1000, resultIndex: -1 },
    //     { resultCount: 1000, resultIndex: -1 }
    //   ]);
    //   strictEqual(await ctx.page.evaluate(`window.search.findPrevious('bc', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
    //   deepStrictEqual(await ctx.page.evaluate('window.calls'), [
    //     { resultCount: 1000, resultIndex: -1 },
    //     { resultCount: 1000, resultIndex: -1 },
    //     { resultCount: 1000, resultIndex: -1 }
    //   ]);
    // });
    // test('should fire when writing to terminal', async () => {
    //   await ctx.page.evaluate(`
    //     window.calls = [];
    //     window.search.onDidChangeResults(e => window.calls.push(e));
    //   `);
    //   await ctx.proxy.write('abc bc c\\n\\r'.repeat(2));
    //   strictEqual(await ctx.page.evaluate(`window.search.findPrevious('abc', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`), true);
    //   deepStrictEqual(await ctx.page.evaluate('window.calls'), [
    //     { resultCount: 2, resultIndex: 1 }
    //   ]);
    //   await ctx.proxy.write('abc bc c\\n\\r');
    //   await timeout(300);
    //   deepStrictEqual(await ctx.page.evaluate('window.calls'), [
    //     { resultCount: 2, resultIndex: 1 },
    //     { resultCount: 3, resultIndex: 1 }
    //   ]);
    // });
  });
  test.describe('Regression tests', () => {
    test.describe('#2444 wrapped line content not being found', () => {
      let fixture: string;
      test.beforeAll(async () => {
        fixture = (await new Promise<Buffer>(r => readFile(resolve(__dirname, '../fixtures/issue-2444'), (err, data) => r(data)))).toString();
        if (process.platform !== 'win32') {
          fixture = fixture.replace(/\n/g, '\n\r');
        }
      });
      test('should find all occurrences using findNext', async () => {
        await ctx.proxy.write(fixture);
        // since we now search from the top left of the viewport not the top of the buffer
        // we need to scroll all the way up
        await ctx.page.evaluate('window.term.scrollToTop()');
        await ctx.page.evaluate(`window.search.findNext('opencv')`);
        await timeout(TIMEOUT);
        let selectionPosition = await ctx.proxy.getSelectionPosition();
        deepStrictEqual(selectionPosition, { start: { x: 24, y: 53 }, end: { x: 30, y: 53 } });
        await ctx.page.evaluate(`window.search.findNext('opencv')`);
        await timeout(TIMEOUT);
        selectionPosition = await ctx.proxy.getSelectionPosition();
        deepStrictEqual(selectionPosition, { start: { x: 24, y: 76 }, end: { x: 30, y: 76 } });
        await ctx.page.evaluate(`window.search.findNext('opencv')`);
        await timeout(TIMEOUT);
        selectionPosition = await ctx.proxy.getSelectionPosition();
        deepStrictEqual(selectionPosition, { start: { x: 24, y: 96 }, end: { x: 30, y: 96 } });
        await ctx.page.evaluate(`window.search.findNext('opencv')`);
        await timeout(TIMEOUT);
        selectionPosition = await ctx.proxy.getSelectionPosition();
        deepStrictEqual(selectionPosition, { start: { x: 1, y: 114 }, end: { x: 7, y: 114 } });
        await ctx.page.evaluate(`window.search.findNext('opencv')`);
        await timeout(TIMEOUT);
        selectionPosition = await ctx.proxy.getSelectionPosition();
        deepStrictEqual(selectionPosition, { start: { x: 11, y: 115 }, end: { x: 17, y: 115 } });
        await ctx.page.evaluate(`window.search.findNext('opencv')`);
        await timeout(TIMEOUT);
        selectionPosition = await ctx.proxy.getSelectionPosition();
        deepStrictEqual(selectionPosition, { start: { x: 1, y: 126 }, end: { x: 7, y: 126 } });
        await ctx.page.evaluate(`window.search.findNext('opencv')`);
        await timeout(TIMEOUT);
        selectionPosition = await ctx.proxy.getSelectionPosition();
        deepStrictEqual(selectionPosition, { start: { x: 11, y: 127 }, end: { x: 17, y: 127 } });
        await ctx.page.evaluate(`window.search.findNext('opencv')`);
        await timeout(TIMEOUT);
        selectionPosition = await ctx.proxy.getSelectionPosition();
        deepStrictEqual(selectionPosition, { start: { x: 1, y: 135 }, end: { x: 7, y: 135 } });
        await ctx.page.evaluate(`window.search.findNext('opencv')`);
        await timeout(TIMEOUT);
        selectionPosition = await ctx.proxy.getSelectionPosition();
        deepStrictEqual(selectionPosition, { start: { x: 11, y: 136 }, end: { x: 17, y: 136 } });
        // Wrap around to first result
        await ctx.page.evaluate(`window.search.findNext('opencv')`);
        await timeout(TIMEOUT);
        selectionPosition = await ctx.proxy.getSelectionPosition();
        deepStrictEqual(selectionPosition, { start: { x: 24, y: 53 }, end: { x: 30, y: 53 } });
      });

      test('should y all occurrences using findPrevious', async () => {
        await ctx.proxy.write(fixture);
        await ctx.page.evaluate('window.term.scrollToTop()');
        await ctx.page.evaluate(`window.search.findPrevious('opencv')`);
        await timeout(TIMEOUT);
        let selectionPosition = await ctx.proxy.getSelectionPosition();
        deepStrictEqual(selectionPosition, { start: { x: 24, y: 53 }, end: { x: 30, y: 53 } });
        await ctx.page.evaluate(`window.search.findPrevious('opencv')`);
        await timeout(TIMEOUT);
        selectionPosition = await ctx.proxy.getSelectionPosition();
        deepStrictEqual(selectionPosition, { start: { x: 11, y: 136 }, end: { x: 17, y: 136 } });
        await ctx.page.evaluate(`window.search.findPrevious('opencv')`);
        await timeout(TIMEOUT);
        selectionPosition = await ctx.proxy.getSelectionPosition();
        deepStrictEqual(selectionPosition, { start: { x: 1, y: 135 }, end: { x: 7, y: 135 } });
        await ctx.page.evaluate(`window.search.findPrevious('opencv')`);
        await timeout(TIMEOUT);
        selectionPosition = await ctx.proxy.getSelectionPosition();
        deepStrictEqual(selectionPosition, { start: { x: 11, y: 127 }, end: { x: 17, y: 127 } });
        await ctx.page.evaluate(`window.search.findPrevious('opencv')`);
        await timeout(TIMEOUT);
        selectionPosition = await ctx.proxy.getSelectionPosition();
        deepStrictEqual(selectionPosition, { start: { x: 1, y: 126 }, end: { x: 7, y: 126 } });
        await ctx.page.evaluate(`window.search.findPrevious('opencv')`);
        await timeout(TIMEOUT);
        selectionPosition = await ctx.proxy.getSelectionPosition();
        deepStrictEqual(selectionPosition, { start: { x: 11, y: 115 }, end: { x: 17, y: 115 } });
        await ctx.page.evaluate(`window.search.findPrevious('opencv')`);
        await timeout(TIMEOUT);
        selectionPosition = await ctx.proxy.getSelectionPosition();
        deepStrictEqual(selectionPosition, { start: { x: 1, y: 114 }, end: { x: 7, y: 114 } });
        await ctx.page.evaluate(`window.search.findPrevious('opencv')`);
        await timeout(TIMEOUT);
        selectionPosition = await ctx.proxy.getSelectionPosition();
        deepStrictEqual(selectionPosition, { start: { x: 24, y: 96 }, end: { x: 30, y: 96 } });
        await ctx.page.evaluate(`window.search.findPrevious('opencv')`);
        await timeout(TIMEOUT);
        selectionPosition = await ctx.proxy.getSelectionPosition();
        deepStrictEqual(selectionPosition, { start: { x: 24, y: 76 }, end: { x: 30, y: 76 } });

        await ctx.page.evaluate(`window.search.findPrevious('opencv')`);
        await timeout(TIMEOUT);
        selectionPosition = await ctx.proxy.getSelectionPosition();
        deepStrictEqual(selectionPosition, { start: { x: 24, y: 53 }, end: { x: 30, y: 53 } });

        await ctx.page.evaluate(`window.search.findPrevious('opencv')`);
        await timeout(TIMEOUT);
        selectionPosition = await ctx.proxy.getSelectionPosition();
        deepStrictEqual(selectionPosition, { start: { x: 11, y: 136 }, end: { x: 17, y: 136 } });
      });
    });
  });
  test.describe('#3834 lines with null characters before search terms', () => {
    // This case can be triggered by the prompt when using starship under conpty
    test('should find all matches on a line containing null characters', async () => {
      // Move cursor forward 1 time to create a null character, as opposed to regular whitespace
      await ctx.proxy.write('\\x1b[CHi Hi');
      await ctx.page.evaluate(`window.search.findPrevious('h', { decorations: { activeMatchColorOverviewRuler: '#ff0000' } })`);
      await timeout(TIMEOUT);
      deepStrictEqual(await ctx.page.evaluate('window.calls[window.calls.length-1]'),
        { resultCount: 2, resultIndex: 1, searchCompleted: true }
      );
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
