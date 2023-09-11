/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { test } from '@playwright/test';
import { createTestContext, ITestContext, openTerminal, pollFor } from './TestUtils';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx);
});
test.afterAll(async () => await ctx.page.close());

test.beforeEach(async () => await ctx.proxy.reset());

test.describe('CharWidth Integration Tests', () => {
  test.describe('getStringCellWidth', () => {
    test('ASCII chars', async () => {
      await ctx.proxy.write('This is just ASCII text.#');
      await pollFor(ctx.page, () => sumWidths(0, 1, '#'), 25);
    });

    test('combining chars', async () => {
      await ctx.proxy.write('e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301#');
      await pollFor(ctx.page, () => sumWidths(0, 1, '#'), 10);
    });

    test('surrogate chars', async () => {
      await ctx.proxy.write('𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞#');
      await pollFor(ctx.page, () => sumWidths(0, 1, '#'), 28);
    });

    test('surrogate combining chars', async () => {
      await ctx.proxy.write('𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301#');
      await pollFor(ctx.page, () => sumWidths(0, 1, '#'), 12);
    });

    test('fullwidth chars', async () => {
      await ctx.proxy.write('１２３４５６７８９０#');
      await pollFor(ctx.page, () => sumWidths(0, 1, '#'), 21);
    });

    test('fullwidth chars offset 1', async () => {
      await ctx.proxy.write('a１２３４５６７８９０#');
      await pollFor(ctx.page, () => sumWidths(0, 1, '#'), 22);
    });

    // TODO: multiline tests once #1685 is resolved
  });
});

async function sumWidths(start: number, end: number, sentinel: string): Promise<number> {
  await ctx.page.evaluate(`
    (function() {
      window.result = 0;
      const buffer = window.term.buffer.active;
      for (let i = ${start}; i < ${end}; i++) {
        const line = buffer.getLine(i);
        let j = 0;
        while (true) {
          const cell = line.getCell(j++);
          if (!cell) {
            break;
          }
          window.result += cell.getWidth();
          if (cell.getChars() === '${sentinel}') {
            return;
          }
        }
      }
    })();
  `);
  return await ctx.page.evaluate(`window.result`);
}
