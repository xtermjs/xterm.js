/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test from '@playwright/test';
import { deepStrictEqual } from 'assert';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';


let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  ctx.page.setViewportSize({ width: 1024, height: 768 });
  await openTerminal(ctx);
});
test.afterAll(async () => await ctx.page.close());


test.describe('ProgressAddon', () => {
  test.beforeEach(async function(): Promise<any> {
    await ctx.page.evaluate(`
      window.progressStack = [];
      window.term.reset();
      window.progressAddon?.dispose();
      window.progressAddon = new ProgressAddon();
      window.term.loadAddon(window.progressAddon);
      window.progressAddon.onChange(progress => window.progressStack.push(progress));
    `);
  });

  test('initial values should be 0;0', async () => {
    deepStrictEqual(await ctx.page.evaluate('window.progressAddon.progress'), {state: 0, value: 0});
  });
  test('state 0: remove', async () => {
    // no value
    await ctx.proxy.write('\x1b]9;4;0\x1b\\');
    deepStrictEqual(await ctx.page.evaluate('window.progressStack'), [{state: 0, value: 0}]);
    // value ignored
    await ctx.proxy.write('\x1b]9;4;0;12\x1b\\');
    deepStrictEqual(await ctx.page.evaluate('window.progressStack'), [{state: 0, value: 0}, {state: 0, value: 0}]);
  });
  test('state 1: set', async () => {
    // set 10%
    await ctx.proxy.write('\x1b]9;4;1;10\x1b\\');
    deepStrictEqual(await ctx.page.evaluate('window.progressStack'), [{state: 1, value: 10}]);
    // set 50%
    await ctx.proxy.write('\x1b]9;4;1;50\x1b\\');
    deepStrictEqual(await ctx.page.evaluate('window.progressStack'), [{state: 1, value: 10}, {state: 1, value: 50}]);
    // set 23%
    await ctx.proxy.write('\x1b]9;4;1;23\x1b\\');
    deepStrictEqual(await ctx.page.evaluate('window.progressStack'), [{state: 1, value: 10}, {state: 1, value: 50}, {state: 1, value: 23}]);
  });
  test('state 1: set - special sequence handling', async () => {
    // missing progress value defaults to 0
    await ctx.proxy.write('\x1b]9;4;1\x1b\\');
    deepStrictEqual(await ctx.page.evaluate('window.progressStack'), [{state: 1, value: 0}]);
    // malformed progress value get ignored
    await ctx.proxy.write('\x1b]9;4;1;12x\x1b\\');
    deepStrictEqual(await ctx.page.evaluate('window.progressStack'), [{state: 1, value: 0}]);
    // out of bounds gets clamped to 100
    await ctx.proxy.write('\x1b]9;4;1;123\x1b\\');
    deepStrictEqual(await ctx.page.evaluate('window.progressStack'), [{state: 1, value: 0}, {state: 1, value: 100}]);
  });
  test('state 2: error - preserve previous value on empty/0', async () => {
    // set value to 12
    await ctx.proxy.write('\x1b]9;4;1;12\x1b\\');
    // omitted/empty/0 value emits previous value
    await ctx.proxy.write('\x1b]9;4;2\x1b\\');
    await ctx.proxy.write('\x1b]9;4;2;\x1b\\');
    await ctx.proxy.write('\x1b]9;4;2;0\x1b\\');
    deepStrictEqual(
      await ctx.page.evaluate('window.progressStack'),
      [{state: 1, value: 12}, {state: 2, value: 12}, {state: 2, value: 12}, {state: 2, value: 12}]
    );
  });
  test('state 2: error - with new value', async () => {
    // set value to 12
    await ctx.proxy.write('\x1b]9;4;1;12\x1b\\');
    // new value updates clamped
    await ctx.proxy.write('\x1b]9;4;2;25\x1b\\');
    await ctx.proxy.write('\x1b]9;4;2;123\x1b\\');
    deepStrictEqual(
      await ctx.page.evaluate('window.progressStack'),
      [{state: 1, value: 12}, {state: 2, value: 25}, {state: 2, value: 100}]
    );
  });
  test('state 3: indeterminate - keeps value untouched', async () => {
    // set value to 12
    await ctx.proxy.write('\x1b]9;4;1;12\x1b\\');
    // new value updates clamped
    await ctx.proxy.write('\x1b]9;4;3\x1b\\');
    await ctx.proxy.write('\x1b]9;4;3;123\x1b\\');
    deepStrictEqual(
      await ctx.page.evaluate('window.progressStack'),
      [{state: 1, value: 12}, {state: 3, value: 12}, {state: 3, value: 12}]
    );
  });
  test('state 4: pause - preserve previous value on empty/0', async () => {
    // set value to 12
    await ctx.proxy.write('\x1b]9;4;1;12\x1b\\');
    // omitted/empty/0 value emits previous value
    await ctx.proxy.write('\x1b]9;4;4\x1b\\');
    await ctx.proxy.write('\x1b]9;4;4;\x1b\\');
    await ctx.proxy.write('\x1b]9;4;4;0\x1b\\');
    deepStrictEqual(
      await ctx.page.evaluate('window.progressStack'),
      [{state: 1, value: 12}, {state: 4, value: 12}, {state: 4, value: 12}, {state: 4, value: 12}]
    );
  });
  test('state 4: pause - with new value', async () => {
    // set value to 12
    await ctx.proxy.write('\x1b]9;4;1;12\x1b\\');
    // new value updates clamped
    await ctx.proxy.write('\x1b]9;4;4;25\x1b\\');
    await ctx.proxy.write('\x1b]9;4;4;123\x1b\\');
    deepStrictEqual(
      await ctx.page.evaluate('window.progressStack'),
      [{state: 1, value: 12}, {state: 4, value: 25}, {state: 4, value: 100}]
    );
  });
  test('invalid sequences should not emit anything', async () => {
    // illegal state
    await ctx.proxy.write('\x1b]9;4;5;12\x1b\\');
    // illegal chars in value
    await ctx.proxy.write('\x1b]9;4;1; 123xxxx\x1b\\');
    deepStrictEqual(await ctx.page.evaluate('window.progressStack'), []);
  });
});
