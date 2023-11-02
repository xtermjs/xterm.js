/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { test } from '@playwright/test';
import { deepStrictEqual, ok, strictEqual } from 'assert';
import type { IDisposable } from '@xterm/xterm';
import { createTestContext, ITestContext, openTerminal, pollFor } from './TestUtils';

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx);
});
test.afterAll(async () => await ctx.page.close());

declare global {
  interface Window { // eslint-disable-line @typescript-eslint/naming-convention
    customCsiHandlerParams?: (number | number[])[][];
    customCsiHandlerCallStack?: string[];
    customDcsHandlerCallStack?: [string, (number | number[])[], string][];
    customEscHandlerCallStack?: string[];
    customOscHandlerCallStack?: string[][];
    disposable?: IDisposable;
    disposables?: IDisposable[];
  }
}

test.describe('Parser Integration Tests', () => {
  test.beforeEach(async () => await ctx.proxy.reset());
  test.afterEach(async () => {
    await ctx.page.evaluate(() => {
      window.disposable?.dispose();
      window.disposable = undefined;
      window.disposables?.forEach(e => e.dispose());
      window.disposables = undefined;
    });
  });

  test.describe('registerCsiHandler', () => {
    test('should call custom CSI handler with js array params', async () => {
      await ctx.proxy.evaluate(([term]) => {
        window.customCsiHandlerParams = [];
        window.disposable = term.parser.registerCsiHandler({final: 'm'}, (params) => {
          window.customCsiHandlerParams!.push(params);
          return false;
        });
      });
      await ctx.proxy.write('\x1b[38;5;123mparams\x1b[38:2::50:100:150msubparams');
      deepStrictEqual(await ctx.page.evaluate(() => window.customCsiHandlerParams), [
        [38, 5, 123],
        [38, [2, -1, 50, 100, 150]]
      ]);
    });
    test('async', async () => {
      await ctx.proxy.evaluate(([term]) => {
        window.customCsiHandlerCallStack = [];
        window.customCsiHandlerParams = [];
        window.disposables = [
          term.parser.registerCsiHandler({intermediates:'+', final: 'Z'}, params => {
            window.customCsiHandlerCallStack!.push('A');
            window.customCsiHandlerParams!.push(params);
            return false;
          }),
          term.parser.registerCsiHandler({intermediates:'+', final: 'Z'}, params => {
            return new Promise(res => setTimeout(res, 50)).then(() => {
              window.customCsiHandlerCallStack!.push('B');
              window.customCsiHandlerParams!.push(params);
              return false;
            });
          }),
          term.parser.registerCsiHandler({intermediates:'+', final: 'Z'}, params => {
            window.customCsiHandlerCallStack!.push('C');
            window.customCsiHandlerParams!.push(params);
            return false;
          })
        ];
      });
      await ctx.proxy.write('\x1b[1;2+Z');
      deepStrictEqual(await ctx.page.evaluate(() => window.customCsiHandlerCallStack), [
        'C',
        'B',
        'A'
      ]);
      deepStrictEqual(await ctx.page.evaluate(() => window.customCsiHandlerParams), [
        [1, 2],
        [1, 2],
        [1, 2]
      ]);
    });
  });
  test.describe('registerDcsHandler', () => {
    test('should respects return value', async () => {
      await ctx.proxy.evaluate(([term]) => {
        window.customDcsHandlerCallStack = [];
        window.disposables = [
          term.parser.registerDcsHandler({intermediates:'+', final: 'p'}, (data, params) => {
            window.customDcsHandlerCallStack!.push(['A', params, data]);
            return false;
          }),
          term.parser.registerDcsHandler({intermediates:'+', final: 'p'}, (data, params) => {
            window.customDcsHandlerCallStack!.push(['B', params, data]);
            return true;
          }),
          term.parser.registerDcsHandler({intermediates:'+', final: 'p'}, (data, params) => {
            window.customDcsHandlerCallStack!.push(['C', params, data]);
            return false;
          })
        ];
      });
      await ctx.proxy.write('\x1bP1;2+psome data\x1b\\');
      deepStrictEqual(await ctx.page.evaluate(() => window.customDcsHandlerCallStack), [
        ['C', [1, 2], 'some data'],
        ['B', [1, 2], 'some data']
      ]);
    });
    test('async', async () => {
      await ctx.proxy.evaluate(([term]) => {
        window.customDcsHandlerCallStack = [];
        window.disposables = [
          term.parser.registerDcsHandler({intermediates:'+', final: 'q'}, (data, params) => {
            window.customDcsHandlerCallStack!.push(['A', params, data]);
            return false;
          }),
          term.parser.registerDcsHandler({intermediates:'+', final: 'q'}, (data, params) => {
            return new Promise(res => setTimeout(res, 50)).then(() => {
              window.customDcsHandlerCallStack!.push(['B', params, data]);
              return false;
            });
          }),
          term.parser.registerDcsHandler({intermediates:'+', final: 'q'}, (data, params) => {
            window.customDcsHandlerCallStack!.push(['C', params, data]);
            return false;
          })
        ];
      });
      await ctx.proxy.write('\x1bP1;2+qsome data\x1b\\');
      deepStrictEqual(await ctx.page.evaluate(() => window.customDcsHandlerCallStack), [
        ['C', [1, 2], 'some data'],
        ['B', [1, 2], 'some data'],
        ['A', [1, 2], 'some data']
      ]);
    });
  });
  test.describe('registerEscHandler', () => {
    test('should respects return value', async () => {
      await ctx.proxy.evaluate(([term]) => {
        window.customEscHandlerCallStack = [];
        window.disposables = [
          term.parser.registerEscHandler({intermediates:'(', final: 'B'}, () => {
            window.customEscHandlerCallStack!.push('A');
            return false;
          }),
          term.parser.registerEscHandler({intermediates:'(', final: 'B'}, () => {
            window.customEscHandlerCallStack!.push('B');
            return true;
          }),
          term.parser.registerEscHandler({intermediates:'(', final: 'B'}, () => {
            window.customEscHandlerCallStack!.push('C');
            return false;
          })
        ];
      });
      await ctx.proxy.write('\x1b(B');
      deepStrictEqual(await ctx.page.evaluate(() => window.customEscHandlerCallStack), ['C', 'B']);
    });
    test('async', async () => {
      await ctx.proxy.evaluate(([term]) => {
        window.customEscHandlerCallStack = [];
        window.disposables = [
          term.parser.registerEscHandler({intermediates:'(', final: 'Z'}, () => {
            window.customEscHandlerCallStack!.push('A');
            return false;
          }),
          term.parser.registerEscHandler({intermediates:'(', final: 'Z'}, () => {
            return new Promise(res => setTimeout(res, 50)).then(() => {
              window.customEscHandlerCallStack!.push('B');
              return false;
            });
          }),
          term.parser.registerEscHandler({intermediates:'(', final: 'Z'}, () => {
            window.customEscHandlerCallStack!.push('C');
            return false;
          })
        ];
      });
      await ctx.proxy.write('\x1b(Z');
      deepStrictEqual(await ctx.page.evaluate(() => window.customEscHandlerCallStack), ['C', 'B', 'A']);
    });
  });
  test.describe('registerOscHandler', () => {
    test('should respects return value', async () => {
      await ctx.proxy.evaluate(([term]) => {
        window.customOscHandlerCallStack = [];
        window.disposables = [
          term.parser.registerOscHandler(1234, data => {
            window.customOscHandlerCallStack!.push(['A', data]);
            return false;
          }),
          term.parser.registerOscHandler(1234, data => {
            window.customOscHandlerCallStack!.push(['B', data]);
            return true;
          }),
          term.parser.registerOscHandler(1234, data => {
            window.customOscHandlerCallStack!.push(['C', data]);
            return false;
          })
        ];
      });
      await ctx.proxy.write('\x1b]1234;some data\x07');
      deepStrictEqual(await ctx.page.evaluate(() => window.customOscHandlerCallStack), [
        ['C', 'some data'],
        ['B', 'some data']
      ]);
    });
    test('async', async () => {
      await ctx.proxy.evaluate(([term]) => {
        window.customOscHandlerCallStack = [];
        window.disposables = [
          term.parser.registerOscHandler(666, data => {
            window.customOscHandlerCallStack!.push(['A', data]);
            return false;
          }),
          term.parser.registerOscHandler(666, data => {
            return new Promise(res => setTimeout(res, 50)).then(() => {
              window.customOscHandlerCallStack!.push(['B', data]);
              return false;
            });
          }),
          term.parser.registerOscHandler(666, data => {
            window.customOscHandlerCallStack!.push(['C', data]);
            return false;
          })
        ];
      });
      await ctx.proxy.write('\x1b]666;some data\x07');
      deepStrictEqual(await ctx.page.evaluate(() => window.customOscHandlerCallStack), [
        ['C', 'some data'],
        ['B', 'some data'],
        ['A', 'some data']
      ]);
    });
  });
});
