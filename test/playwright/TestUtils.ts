import { Browser, JSHandle, Page } from '@playwright/test';
import { deepStrictEqual, fail, ok } from 'assert';
import { IBuffer, IBufferLine, IBufferNamespace, IEvent, ITerminalOptions, Terminal } from 'xterm';
// TODO: We could avoid needing this
import deepEqual = require('deep-equal');
import { PageFunction } from '@playwright/test/types/structs';

export interface ITestContext {
  page: Page;
  termHandle: JSHandle<Terminal>;
  proxy: TerminalProxy;
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
  // Interfaces that the proxy implements with async values
  EnsureAsyncProperties<Pick<Terminal, 'cols' | 'rows'>> {

  // Custom proxy methods
  evaluate<T>(pageFunction: PageFunction<JSHandle<Terminal>[], T>): Promise<T>;
  write(data: string | Uint8Array): Promise<void>;
}

export class TerminalProxy implements ITerminalProxy {
  constructor(private readonly _page: Page) {
  }

  // #region Simple proxied properties
  public get cols(): Promise<number> { return this.evaluate(([term]) => term.cols); }
  public get rows(): Promise<number> { return this.evaluate(([term]) => term.rows); }
  // #endregion

  // #region Simple proxies methods
  public async clear(): Promise<void> { return this.evaluate(([term]) => term.clear()); }
  public async paste(data: string): Promise<void> {
    return this._page.evaluate(([term, data]) => term.paste(data), [await this._getHandle(), data] as const);
  }
  public async getOption(key: string): Promise<any> {
    return this._page.evaluate(([term, key]) => term.getOption(key), [await this._getHandle(), key] as const);
  }
  public async setOption(key: string, value: any): Promise<any> {
    return this._page.evaluate(([term, key, value]) => term.setOption(key, value), [await this._getHandle(), key, value] as const);
  }
  // #endregion

  // #region Proxy objects
  public get buffer(): TerminalBufferNamespaceProxy { return new TerminalBufferNamespaceProxy(this._page, this); }
  // #endregion

  // #region Complex proxied methods
  public async write(data: string | Uint8Array): Promise<void> {
    return this._page.evaluate(([term, data]) => {
      return new Promise(r => term.write(typeof data === 'string' ? data : new Uint8Array(data), r));
    }, [await this._getHandle(), typeof data === 'string' ? data : Array.from(data)] as const);
  }
  public async writeln(data: string | Uint8Array): Promise<void> {
    return this._page.evaluate(([term, data]) => {
      return new Promise(r => term.writeln(typeof data === 'string' ? data : new Uint8Array(data), r));
    }, [await this._getHandle(), typeof data === 'string' ? data : Array.from(data)] as const);
  }
  // #endregion

  // #region Events
  public async onData(cb: (data: string) => void): Promise<void> {
    this._page.exposeFunction('onData', cb);
    this.evaluate(([term]) => term.onData((window as any).onData));
  }
  // #endregion

  public async evaluate<T>(pageFunction: PageFunction<JSHandle<Terminal>[], T>): Promise<T> {
    return this._page.evaluate(pageFunction, [await this._getHandle()]);
  }

  public async evaluateHandle<T>(pageFunction: PageFunction<JSHandle<Terminal>[], T>): Promise<JSHandle<T>> {
    return this._page.evaluateHandle(pageFunction, [await this._getHandle()]);
  }

  private _getHandle(): Promise<JSHandle<Terminal>> {
    // This is async because it must be evaluated each time it is called since term may have changed
    return this._page.evaluateHandle('window.term');
  }
}

class TerminalBufferNamespaceProxy {
  constructor(
    private readonly _page: Page,
    private readonly _proxy: TerminalProxy
  ) {

  }

  public get active(): TerminalBufferProxy { return new TerminalBufferProxy(this._page, this._proxy); }
}

class TerminalBufferProxy {
  private readonly _handle: Promise<JSHandle<IBuffer>>;

  constructor(
    private readonly _page: Page,
    private readonly _proxy: TerminalProxy
  ) {
    this._handle = this._proxy.evaluateHandle(([term]) => term.buffer.active);
  }

  public get type(): Promise<'normal' | 'alternate'> { return this.evaluate(([buffer]) => buffer.type); }
  public get cursorY(): Promise<number> { return this.evaluate(([buffer]) => buffer.cursorY); }
  public get cursorX(): Promise<number> { return this.evaluate(([buffer]) => buffer.cursorX); }
  public get viewportY(): Promise<number> { return this.evaluate(([buffer]) => buffer.viewportY); }
  public get baseY(): Promise<number> { return this.evaluate(([buffer]) => buffer.baseY); }
  public get length(): Promise<number> { return this.evaluate(([buffer]) => buffer.length); }
  public async getLine(y: number): Promise<TerminalBufferLine | undefined> {
    const lineHandle = await this._page.evaluateHandle(([buffer, y]) => buffer.getLine(y), [await this._handle, y] as const);
    const value = await lineHandle.jsonValue();
    if (value) {
      return new TerminalBufferLine(this._page, lineHandle as JSHandle<IBufferLine>);
    }
    return undefined;
  }

  public async evaluate<T>(pageFunction: PageFunction<JSHandle<IBuffer>[], T>): Promise<T> {
    return this._page.evaluate(pageFunction, [await this._handle]);
  }
}

class TerminalBufferLine {
  constructor(
    private readonly _page: Page,
    private readonly _handle: JSHandle<IBufferLine>
  ) {
  }

  public translateToString(trimRight?: boolean, startColumn?: number, endColumn?: number): Promise<string> {
    return this._page.evaluate(([bufferLine, trimRight, startColumn, endColumn]) => {
      return bufferLine.translateToString(trimRight, startColumn, endColumn);
    }, [this._handle, trimRight, startColumn, endColumn] as const);
  }

  public async evaluate<T>(pageFunction: PageFunction<JSHandle<IBufferLine>[], T>): Promise<T> {
    return this._page.evaluate(pageFunction, [this._handle]);
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
