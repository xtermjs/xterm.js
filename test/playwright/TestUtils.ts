/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Browser, JSHandle, Page } from '@playwright/test';
import { deepStrictEqual, strictEqual } from 'assert';
import type { IRenderDimensions } from 'browser/renderer/shared/Types';
import type { IRenderService } from 'browser/services/Services';
import type { ICoreTerminal, IMarker } from 'common/Types';
import * as playwright from '@playwright/test';
import { PageFunction } from 'playwright-core/types/structs';
import { IBuffer, IBufferCell, IBufferLine, IBufferNamespace, IBufferRange, IDecoration, IDecorationOptions, IModes, ITerminalInitOnlyOptions, ITerminalOptions, Terminal } from '@xterm/xterm';
import { EventEmitter } from '../../out/common/EventEmitter';

export interface ITestContext {
  browser: Browser;
  page: Page;
  termHandle: JSHandle<Terminal>;
  proxy: TerminalProxy;
}

export async function createTestContext(browser: Browser): Promise<ITestContext> {
  const page = await browser.newPage();
  page.on('console', e => console.log(`[${browser.browserType().name()}:${e.type()}]`, e));
  page.on('pageerror', e => console.error(`[${browser.browserType().name()}]`, e));
  await page.goto('/test');
  const proxy = new TerminalProxy(page);
  proxy.initPage();
  return {
    browser,
    page,
    termHandle: await page.evaluateHandle('window.term'),
    proxy
  };
}

type EnsureAsync<T> = T extends PromiseLike<any> ? T : Promise<T>;
type EnsureAsyncProperties<T> = {
  [Key in keyof T]: EnsureAsync<T[Key]>
};
type EnsureAsyncMethods<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Return
    ? (...args: Args) => Promise<Return>
    : T[K];
};

/**
 * A type that proxy objects implement that enables overriding a base interface with a set of types
 * to override as async (ie. properties that are not synced to the node side), and a set of types to
 * omit from the interface (ie. properties that map to completely different implementations).
 */
type PlaywrightApiProxy<TBaseInterface, TAsyncPropOverrides extends keyof TBaseInterface, TAsyncMethodOverrides extends keyof TBaseInterface, TCustomOverrides extends keyof TBaseInterface> = (
  // Interfaces that the proxy implements as async
  EnsureAsyncProperties<Pick<TBaseInterface, TAsyncPropOverrides>> &
  EnsureAsyncMethods<Pick<TBaseInterface, TAsyncMethodOverrides>> &
  // Interfaces that the proxy implements as is (exclude async/custom)
  Omit<TBaseInterface, TAsyncPropOverrides | TAsyncMethodOverrides | TCustomOverrides>
);

interface ITerminalProxyCustomMethods {
  evaluate<T>(pageFunction: PageFunction<JSHandle<Terminal>[], T>): Promise<T>;
  write(data: string | Uint8Array): Promise<void>;
}

type TerminalProxyAsyncPropOverrides = 'cols' | 'rows' | 'modes';
type TerminalProxyAsyncMethodOverrides = 'hasSelection' | 'getSelection' | 'getSelectionPosition' | 'registerMarker' | 'registerDecoration';
type TerminalProxyCustomOverrides = 'buffer' | (
  // The below are not implemented yet
  'element' |
  'textarea' |
  'markers' |
  'unicode' |
  'parser' |
  'options' |
  'open' |
  'attachCustomKeyEventHandler' |
  'attachCustomWheelEventHandler' |
  'registerLinkProvider' |
  'registerCharacterJoiner' |
  'deregisterCharacterJoiner' |
  'loadAddon'
);
export class TerminalProxy implements ITerminalProxyCustomMethods, PlaywrightApiProxy<Terminal, TerminalProxyAsyncPropOverrides, TerminalProxyAsyncMethodOverrides, TerminalProxyCustomOverrides> {
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
    await this._page.exposeFunction('onWriteParsed', () => this._onWriteParsed.fire());
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
      this._onTitleChange,
      this._onWriteParsed
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
    await this.evaluate(([term]) => term.onWriteParsed((window as any).onWriteParsed));
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
  private _onWriteParsed = new EventEmitter<void>();
  public readonly onWriteParsed = this._onWriteParsed.event;
  // #endregion

  // #region Simple properties
  public get cols(): Promise<number> { return this.evaluate(([term]) => term.cols); }
  public get rows(): Promise<number> { return this.evaluate(([term]) => term.rows); }
  public get modes(): Promise<IModes> { return this.evaluate(([term]) => term.modes); }
  // #endregion

  // #region Complex properties
  public get buffer(): TerminalBufferNamespaceProxy { return new TerminalBufferNamespaceProxy(this._page, this); }
  /**
   * Exposes somewhat unsafe access to internals for testing things difficult to do with the regular
   * API
   */
  public get core(): TerminalCoreProxy { return new TerminalCoreProxy(this._page, this); }
  // #endregion

  // #region Proxied methods
  public async dispose(): Promise<void> { return this.evaluate(([term]) => term.dispose()); }
  public async reset(): Promise<void> { return this.evaluate(([term]) => term.reset()); }
  public async clear(): Promise<void> { return this.evaluate(([term]) => term.clear()); }
  public async focus(): Promise<void> { return this.evaluate(([term]) => term.focus()); }
  public async blur(): Promise<void> { return this.evaluate(([term]) => term.blur()); }
  public async hasSelection(): Promise<boolean> { return this.evaluate(([term]) => term.hasSelection()); }
  public async getSelection(): Promise<string> { return this.evaluate(([term]) => term.getSelection()); }
  public async getSelectionPosition(): Promise<IBufferRange | undefined> { return this.evaluate(([term]) => term.getSelectionPosition()); }
  public async selectAll(): Promise<void> { return this.evaluate(([term]) => term.selectAll()); }
  public async selectLines(start: number, end: number): Promise<void> { return this._page.evaluate(([term, start, end]) => term.selectLines(start, end), [await this.getHandle(), start, end] as const); }
  public async clearSelection(): Promise<void> { return this.evaluate(([term]) => term.clearSelection()); }
  public async select(column: number, row: number, length: number): Promise<void> { return this._page.evaluate(([term, column, row, length]) => term.select(column, row, length), [await this.getHandle(), column, row, length] as const); }
  public async paste(data: string): Promise<void> { return this._page.evaluate(([term, data]) => term.paste(data), [await this.getHandle(), data] as const); }
  public async refresh(start: number, end: number): Promise<void> { return this._page.evaluate(([term, start, end]) => term.refresh(start, end), [await this.getHandle(), start, end] as const); }
  public async getOption<T extends keyof ITerminalOptions>(key: T): Promise<ITerminalOptions[T]> { return this._page.evaluate(([term, key]) => term.options[key as T], [await this.getHandle(), key] as const); }
  public async setOption<T extends keyof ITerminalOptions>(key: T, value: ITerminalOptions[T]): Promise<any> { return this._page.evaluate(([term, key, value]) => term.options[key as T] = (value as ITerminalOptions[T]), [await this.getHandle(), key, value] as const); }
  public async setOptions(value: Partial<ITerminalOptions>): Promise<any> {
    return this._page.evaluate(([term, value]) => {
      term.options = value;
    }, [await this.getHandle(), value] as const);
  }
  public async scrollToTop(): Promise<void> { return this.evaluate(([term]) => term.scrollToTop()); }
  public async scrollToBottom(): Promise<void> { return this.evaluate(([term]) => term.scrollToBottom()); }
  public async scrollPages(pageCount: number): Promise<void> { return this._page.evaluate(([term, pageCount]) => term.scrollPages(pageCount), [await this.getHandle(), pageCount] as const); }
  public async scrollToLine(line: number): Promise<void> { return this._page.evaluate(([term, line]) => term.scrollToLine(line), [await this.getHandle(), line] as const); }
  public async scrollLines(amount: number): Promise<void> { return this._page.evaluate(([term, amount]) => term.scrollLines(amount), [await this.getHandle(), amount] as const); }
  public async write(data: string | Uint8Array): Promise<void> {
    return this._page.evaluate(([term, data]) => {
      return new Promise(r => term.write(typeof data === 'string' ? data : new Uint8Array(data), r));
    }, [await this.getHandle(), typeof data === 'string' ? data : Array.from(data)] as const);
  }
  public async writeln(data: string | Uint8Array): Promise<void> {
    return this._page.evaluate(([term, data]) => {
      return new Promise(r => term.writeln(typeof data === 'string' ? data : new Uint8Array(data), r));
    }, [await this.getHandle(), typeof data === 'string' ? data : Array.from(data)] as const);
  }
  public async input(data: string, wasUserInput: boolean = true): Promise<void> { return this.evaluate(([term]) => term.input(data, wasUserInput)); }
  public async resize(cols: number, rows: number): Promise<void> { return this._page.evaluate(([term, cols, rows]) => term.resize(cols, rows), [await this.getHandle(), cols, rows] as const); }
  public async registerMarker(y?: number | undefined): Promise<IMarker> { return this._page.evaluate(([term, y]) => term.registerMarker(y), [await this.getHandle(), y] as const); }
  public async registerDecoration(decorationOptions: IDecorationOptions): Promise<IDecoration | undefined> { return this._page.evaluate(([term, decorationOptions]) => term.registerDecoration(decorationOptions), [await this.getHandle(), decorationOptions] as const); }
  public async clearTextureAtlas(): Promise<void> { return this.evaluate(([term]) => term.clearTextureAtlas()); }
  // #endregion

  public async evaluate<T>(pageFunction: PageFunction<JSHandle<Terminal>[], T>): Promise<T> {
    return this._page.evaluate(pageFunction, [await this.getHandle()]);
  }

  public async evaluateHandle<T>(pageFunction: PageFunction<JSHandle<Terminal>[], T>): Promise<JSHandle<T>> {
    return this._page.evaluateHandle(pageFunction, [await this.getHandle()]);
  }

  public async getHandle(): Promise<JSHandle<Terminal>> {
    // This is async because it must be evaluated each time it is called since term may have changed
    return this._page.evaluateHandle('window.term');
  }
}

class TerminalBufferNamespaceProxy implements PlaywrightApiProxy<IBufferNamespace, never, never, 'active' | 'normal' | 'alternate'> {
  private _onBufferChange = new EventEmitter<IBuffer>();
  public readonly onBufferChange = this._onBufferChange.event;

  constructor(
    private readonly _page: Page,
    private readonly _proxy: TerminalProxy
  ) {

  }

  public get active(): TerminalBufferProxy { return new TerminalBufferProxy(this._page, this._proxy, this._proxy.evaluateHandle(([term]) => term.buffer.active)); }
  public get normal(): TerminalBufferProxy { return new TerminalBufferProxy(this._page, this._proxy, this._proxy.evaluateHandle(([term]) => term.buffer.normal)); }
  public get alternate(): TerminalBufferProxy { return new TerminalBufferProxy(this._page, this._proxy, this._proxy.evaluateHandle(([term]) => term.buffer.alternate)); }
}

// TODO: Adopt PlaywrightApiProxy
class TerminalBufferProxy /* implements EnsureAsyncProperties<IBuffer>*/ {
  constructor(
    private readonly _page: Page,
    private readonly _proxy: TerminalProxy,
    private readonly _handle: Promise<JSHandle<IBuffer>>
  ) {
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

// TODO: Adopt PlaywrightApiProxy
class TerminalBufferLine {
  constructor(
    private readonly _page: Page,
    private readonly _handle: JSHandle<IBufferLine>
  ) {
  }

  public get length(): Promise<number> { return this.evaluate(([bufferLine]) => bufferLine.length); }
  public get isWrapped(): Promise<boolean> { return this.evaluate(([bufferLine]) => bufferLine.isWrapped); }

  public translateToString(trimRight?: boolean, startColumn?: number, endColumn?: number): Promise<string> {
    return this._page.evaluate(([bufferLine, trimRight, startColumn, endColumn]) => {
      return bufferLine.translateToString(trimRight, startColumn, endColumn);
    }, [this._handle, trimRight, startColumn, endColumn] as const);
  }

  public async getCell(x: number): Promise<TerminalBufferCell | undefined> {
    const cellHandle = await this._page.evaluateHandle(([bufferLine, x]) => bufferLine.getCell(x), [this._handle, x] as const);
    const value = await cellHandle.jsonValue();
    if (value) {
      return new TerminalBufferCell(this._page, cellHandle as JSHandle<IBufferCell>);
    }
    return undefined;
  }

  public async evaluate<T>(pageFunction: PageFunction<JSHandle<IBufferLine>[], T>): Promise<T> {
    return this._page.evaluate(pageFunction, [this._handle]);
  }
}

// TODO: Adopt PlaywrightApiProxy
class TerminalBufferCell {
  constructor(
    private readonly _page: Page,
    private readonly _handle: JSHandle<IBufferCell>
  ) {
  }

  public getWidth(): Promise<number> { return this.evaluate(([line]) => line.getWidth()); }
  public getChars(): Promise<string> { return this.evaluate(([line]) => line.getChars()); }

  public async evaluate<T>(pageFunction: PageFunction<JSHandle<IBufferCell>[], T>): Promise<T> {
    return this._page.evaluate(pageFunction, [this._handle]);
  }
}

class TerminalCoreProxy {
  constructor(
    private readonly _page: Page,
    private readonly _proxy: TerminalProxy
  ) {
  }

  public get isDisposed(): Promise<boolean> { return this.evaluate(([core]) => (core as any)._isDisposed); }
  public get renderDimensions(): Promise<IRenderDimensions> { return this.evaluate(([core]) => ((core as any)._renderService as IRenderService).dimensions); }

  public async triggerBinaryEvent(data: string): Promise<void> {
    return this._page.evaluate(([core, data]) => core.coreService.triggerBinaryEvent(data), [await this._getCoreHandle(), data] as const);
  }


  private async _getCoreHandle(): Promise<JSHandle<ICoreTerminal>> {
    return this._proxy.evaluateHandle(([term]) => (term as any)._core as ICoreTerminal);
  }

  public async evaluate<T>(pageFunction: PageFunction<JSHandle<ICoreTerminal>[], T>): Promise<T> {
    return this._page.evaluate(pageFunction, [await this._getCoreHandle()]);
  }
}

export async function openTerminal(ctx: ITestContext, options: ITerminalOptions | ITerminalInitOnlyOptions = {}, testOptions: { loadUnicodeGraphemesAddon: boolean } = { loadUnicodeGraphemesAddon: true }): Promise<void> {
  await ctx.page.evaluate(`
  if ('term' in window) {
    try {
      window.term.dispose();
    } catch {}
  }
  `);
  // HACK: Tests may have side effects that could cause the terminal not to be removed. This
  //       assertion catches this case early.
  strictEqual(await ctx.page.evaluate(`document.querySelector('#terminal-container').children.length`), 0, 'there must be no terminals on the page');
  await ctx.page.evaluate(`
    window.term = new window.Terminal(${JSON.stringify({ allowProposedApi: true, ...options })});
    window.term.open(document.querySelector('#terminal-container'));
  `);
  // HACK: This is a soft layer breaker that's temporarily included until unicode graphemes have
  // more complete integration tests. See https://github.com/xtermjs/xterm.js/pull/4519#discussion_r1285234453
  if (testOptions.loadUnicodeGraphemesAddon) {
    await ctx.page.evaluate(`
      window.unicode = new UnicodeGraphemesAddon();
      window.term.loadAddon(window.unicode);
      window.term.unicode.activeVersion = '15-graphemes';
    `);
  }
  await ctx.page.waitForSelector('.xterm-rows');
  ctx.termHandle = await ctx.page.evaluateHandle('window.term');
  await ctx.proxy.initTerm();
}


export type MaybeAsync<T> = Promise<T> | T;

interface IPollForOptions<T> {
  equalityFn?: (a: T, b: T) => boolean;
  maxDuration?: number;
  stack?: string;
}

export async function pollFor<T>(page: playwright.Page, evalOrFn: string | (() => MaybeAsync<T>), val: T, preFn?: () => Promise<void>, options?: IPollForOptions<T>): Promise<void> {
  if (!options) {
    options = {};
  }
  options.stack ??= new Error().stack;
  if (preFn) {
    await preFn();
  }
  const result = typeof evalOrFn === 'string' ? await page.evaluate(evalOrFn) : await evalOrFn();

  if (process.env.DEBUG) {
    console.log('pollFor\n  actual: ', JSON.stringify(result), '  expected: ', JSON.stringify(val));
  }

  let equalityCheck: boolean;
  if (options.equalityFn) {
    equalityCheck = options.equalityFn(result as T, val);
  } else {
    equalityCheck = true;
    try {
      deepStrictEqual(result, val);
    } catch (e) {
      equalityCheck = false;
    }
  }

  if (!equalityCheck) {
    if (options.maxDuration === undefined) {
      options.maxDuration = 2000;
    }
    if (options.maxDuration <= 0) {
      deepStrictEqual(result, val, ([
        `pollFor max duration exceeded.`,
        (`Last comparison: ` +
          `${typeof result === 'object' ? JSON.stringify(result) : result} (actual) !== ` +
          `${typeof val === 'object' ? JSON.stringify(val) : val} (expected)`),
        `Stack: ${options.stack}`
      ].join('\n')));
    }
    return new Promise<void>(r => {
      setTimeout(() => r(pollFor(page, evalOrFn, val, preFn, {
        ...options,
        maxDuration: options!.maxDuration! - 10,
        stack: options!.stack
      })), 10);
    });
  }
}

export async function pollForApproximate<T>(page: playwright.Page, marginOfError: number, evalOrFn: string | (() => MaybeAsync<T>), val: T, preFn?: () => Promise<void>, maxDuration?: number, stack?: string): Promise<void> {
  await pollFor(page, evalOrFn, val, preFn, {
    maxDuration,
    stack,
    equalityFn: (a, b) => {
      if (a === b) {
        return true;
      }
      if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
        let success = true;
        for (let i = 0 ; i < a.length; i++) {
          if (Math.abs(a[i] - b[i]) > marginOfError) {
            success = false;
            break;
          }
        }
        if (success) {
          return true;
        }
      }
      return false;
    }
  });
}

export async function writeSync(page: playwright.Page, data: string): Promise<void> {
  await page.evaluate(`
    window.ready = false;
    window.term.write('${data}', () => window.ready = true);
  `);
  await pollFor(page, 'window.ready', true);
}

export async function timeout(ms: number): Promise<void> {
  return new Promise<void>(r => setTimeout(r, ms));
}

export function getBrowserType(): playwright.BrowserType<playwright.WebKitBrowser> | playwright.BrowserType<playwright.ChromiumBrowser> | playwright.BrowserType<playwright.FirefoxBrowser> {
  // Default to chromium
  let browserType: playwright.BrowserType<playwright.WebKitBrowser> | playwright.BrowserType<playwright.ChromiumBrowser> | playwright.BrowserType<playwright.FirefoxBrowser> = playwright['chromium'];

  const index = process.argv.indexOf('--browser');
  if (index !== -1 && process.argv.length > index + 1 && typeof process.argv[index + 1] === 'string') {
    const string = process.argv[index + 1];
    if (string === 'firefox' || string === 'webkit') {
      browserType = playwright[string];
    }
  }

  return browserType;
}

export function launchBrowser(opts?: playwright.LaunchOptions): Promise<playwright.Browser> {
  const browserType = getBrowserType();
  const options: playwright.LaunchOptions = {
    ...opts,
    headless: process.argv.includes('--headless')
  };

  const index = process.argv.indexOf('--executablePath');
  if (index > 0 && process.argv.length > index + 1 && typeof process.argv[index + 1] === 'string') {
    options.executablePath = process.argv[index + 1];
  }

  return browserType.launch(options);
}
