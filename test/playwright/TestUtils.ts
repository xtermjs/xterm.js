import { Browser, JSHandle, Page } from '@playwright/test';
import { deepStrictEqual, fail, ok } from 'assert';
import { IBuffer, IBufferLine, IBufferNamespace, IEvent, ISelectionPosition, ITerminalOptions, Terminal } from 'xterm';
import { EventEmitter } from '../../out/common/EventEmitter';
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
  const proxy = new TerminalProxy(page);
  proxy.initPage();
  return {
    page,
    termHandle: await page.evaluateHandle('window.term'),
    proxy
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

  /**
   * Initialize the proxy for a new playwright page.
   */
  public async initPage(): Promise<void> {
    await this._page.exposeFunction('onBell', () => this._onBell.fire());
    await this._page.exposeFunction('onBinary', (e: string) => this._onBinary.fire(e));
    await this._page.exposeFunction('onCursorMove', () => this._onCursorMove.fire());
    await this._page.exposeFunction('onData', (e: string) => this._onData.fire(e));
    await this._page.exposeFunction('onKey', (e: { key: string, domEvent: KeyboardEvent }) => this._onKey.fire(e));
    await this._page.exposeFunction('onLineFeed', () => this._onLineFeed.fire());
    await this._page.exposeFunction('onRender', (e: { start: number, end: number }) => this._onRender.fire(e));
    await this._page.exposeFunction('onResize', (e: { cols: number, rows: number }) => this._onResize.fire(e));
    await this._page.exposeFunction('onScroll', (e: number) => this._onScroll.fire(e));
    await this._page.exposeFunction('onSelectionChange', () => this._onSelectionChange.fire());
    await this._page.exposeFunction('onTitleChange', (e: string) => this._onTitleChange.fire(e));
  }

  /**
   * Initialize the proxy for a new terminal object.
   */
  public async initTerm(): Promise<void> {
    for (const emitter of [
      this._onBell,
      this._onBinary,
      this._onCursorMove,
      this._onData,
      this._onKey,
      this._onLineFeed,
      this._onRender,
      this._onResize,
      this._onScroll,
      this._onSelectionChange,
      this._onTitleChange
    ]) {
      emitter.clearListeners();
    }
    await this.evaluate(([term]) => term.onBell((window as any).onBell));
    await this.evaluate(([term]) => term.onBinary((window as any).onBinary));
    await this.evaluate(([term]) => term.onCursorMove((window as any).onCursorMove));
    await this.evaluate(([term]) => term.onData((window as any).onData));
    await this.evaluate(([term]) => term.onKey((window as any).onKey));
    await this.evaluate(([term]) => term.onLineFeed((window as any).onLineFeed));
    await this.evaluate(([term]) => term.onRender((window as any).onRender));
    await this.evaluate(([term]) => term.onResize((window as any).onResize));
    await this.evaluate(([term]) => term.onScroll((window as any).onScroll));
    await this.evaluate(([term]) => term.onSelectionChange((window as any).onSelectionChange));
    await this.evaluate(([term]) => term.onTitleChange((window as any).onTitleChange));
  }

  // #region Events
  private _onBell = new EventEmitter<void>();
  public readonly onBell = this._onBell.event;
  private _onBinary = new EventEmitter<string>();
  public readonly onBinary = this._onBinary.event;
  private _onCursorMove = new EventEmitter<void>();
  public readonly onCursorMove = this._onCursorMove.event;
  private _onData = new EventEmitter<string>();
  public readonly onData = this._onData.event;
  private _onKey = new EventEmitter<{ key: string, domEvent: KeyboardEvent }>();
  public readonly onKey = this._onKey.event;
  private _onLineFeed = new EventEmitter<void>();
  public readonly onLineFeed = this._onLineFeed.event;
  private _onRender = new EventEmitter<{ start: number, end: number }>();
  public readonly onRender = this._onRender.event;
  private _onResize = new EventEmitter<{ cols: number, rows: number }>();
  public readonly onResize = this._onResize.event;
  private _onScroll = new EventEmitter<number>();
  public readonly onScroll = this._onScroll.event;
  private _onSelectionChange = new EventEmitter<void>();
  public readonly onSelectionChange = this._onSelectionChange.event;
  private _onTitleChange = new EventEmitter<string>();
  public readonly onTitleChange = this._onTitleChange.event;
  // #endregion

  // #region Primitive properties
  public get cols(): Promise<number> { return this.evaluate(([term]) => term.cols); }
  public get rows(): Promise<number> { return this.evaluate(([term]) => term.rows); }
  // #endregion

  // #region Complex properties
  public get buffer(): TerminalBufferNamespaceProxy { return new TerminalBufferNamespaceProxy(this._page, this); }
  // #endregion

  // #region Proxied methods
  public async clear(): Promise<void> { return this.evaluate(([term]) => term.clear()); }
  public async focus(): Promise<void> { return this.evaluate(([term]) => term.focus()); }
  public async blur(): Promise<void> { return this.evaluate(([term]) => term.blur()); }
  public async hasSelection(): Promise<boolean> { return this.evaluate(([term]) => term.hasSelection()); }
  public async getSelection(): Promise<string> { return this.evaluate(([term]) => term.getSelection()); }
  public async getSelectionPosition(): Promise<ISelectionPosition | undefined> { return this.evaluate(([term]) => term.getSelectionPosition()); }
  public async selectAll(): Promise<void> { return this.evaluate(([term]) => term.selectAll()); }
  public async clearSelection(): Promise<void> { return this.evaluate(([term]) => term.clearSelection()); }
  public async select(column: number, row: number, length: number): Promise<void> { return this._page.evaluate(([term, column, row, length]) => term.select(column, row, length), [await this._getHandle(), column, row, length] as const); }
  public async paste(data: string): Promise<void> { return this._page.evaluate(([term, data]) => term.paste(data), [await this._getHandle(), data] as const); }
  public async getOption(key: string): Promise<any> { return this._page.evaluate(([term, key]) => term.getOption(key), [await this._getHandle(), key] as const); }
  public async setOption(key: string, value: any): Promise<any> { return this._page.evaluate(([term, key, value]) => term.setOption(key, value), [await this._getHandle(), key, value] as const); }
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
  await ctx.proxy.initTerm();
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
