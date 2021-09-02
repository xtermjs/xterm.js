import { Browser, JSHandle, Page } from '@playwright/test';
import { deepStrictEqual, fail, ok } from 'assert';
import { ITerminalOptions, Terminal } from 'xterm';
// TODO: We could avoid needing this
import deepEqual = require('deep-equal');
import { PageFunction } from '@playwright/test/types/structs';

export interface ITestContext {
  page: Page;
  termHandle: JSHandle<Terminal>;
  proxy: ITerminalProxy;
}

export async function createTextContext(browser: Browser): Promise<ITestContext> {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3000/test');
  return {
    page,
    termHandle: await page.evaluateHandle('window.term'),
    proxy: new TerminalProxy(page)
  };
}

type EnsureAsync<T> = T extends PromiseLike<any> ? T : Promise<T>;
type EnsureAsyncProperties<T> = {
  [Key in keyof T]: EnsureAsync<T[Key]>
};

interface ITerminalProxy extends
  EnsureAsyncProperties<Pick<Terminal, 'cols' | 'rows'>> {
  evaluate<T>(pageFunction: PageFunction<JSHandle<Terminal>[], T>): Promise<T>;
}

export class TerminalProxy implements ITerminalProxy {
  constructor(private readonly _page: Page) {
  }

  public get cols(): Promise<number> { return this.evaluate(([term]) => term.cols); }
  public get rows(): Promise<number> { return this.evaluate(([term]) => term.rows); }

  public async evaluate<T>(pageFunction: PageFunction<JSHandle<Terminal>[], T>): Promise<T> {
    return this._page.evaluate(pageFunction, [await this._getTermHandle()]);
  }

  private async _getTermHandle(): Promise<JSHandle<Terminal>> {
    return this._page.evaluateHandle('window.term');
  }
}

export async function openTerminal(ctx: ITestContext, options: ITerminalOptions = {}): Promise<void> {
  await ctx.page.evaluate(`
    if ('term' in window) {
      window.term.dispose();
    }
    window.term = new Terminal(${JSON.stringify(options)});
    window.term.open(document.querySelector('#terminal-container'));
  `);
  if (options.rendererType === 'dom') {
    await ctx.page.waitForSelector('.xterm-rows');
  } else {
    await ctx.page.waitForSelector('.xterm-text-layer');
  }
  ctx.termHandle = await ctx.page.evaluateHandle('window.term');
}

export async function pollFor<T>(page: Page, evalOrFn: string | (() => Promise<T>), val: T, preFn?: () => Promise<void>, maxDuration?: number): Promise<void> {
  if (preFn) {
    await preFn();
  }
  const result = typeof evalOrFn === 'string' ? await page.evaluate(evalOrFn) : await evalOrFn();

  // TODO: Use PWDEBUG?
  if (process.env.DEBUG) {
    console.log('pollFor result: ', result);
  }

  if (!deepEqual(result, val)) {
    if (maxDuration === undefined) {
      maxDuration = 2000;
    }
    if (maxDuration <= 0) {
      deepStrictEqual(result, val, 'pollFor max duration exceeded');
    }
    return new Promise<void>(r => {
      setTimeout(() => r(pollFor(page, evalOrFn, val, preFn, maxDuration! - 10)), 10);
    });
  }
}

export async function asyncThrows(cb: () => Promise<any>, expectedMessage?: string): Promise<void> {
  try {
    await cb();
  } catch (e) {
    if (expectedMessage) {
      ok((e as Error).message.indexOf(expectedMessage) !== -1);
    }
    return;
  }
  fail('Expected callback to throw');
}
