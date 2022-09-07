/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IEvent } from 'common/EventEmitter';
import { BufferNamespaceApi } from 'common/public/BufferNamespaceApi';
import { ParserApi } from 'common/public/ParserApi';
import { UnicodeApi } from 'common/public/UnicodeApi';
import { IBufferNamespace as IBufferNamespaceApi, IMarker, IModes, IParser, ITerminalAddon, ITerminalInitOnlyOptions, IUnicodeHandling, Terminal as ITerminalApi } from 'xterm-headless';
import { Terminal as TerminalCore } from 'headless/Terminal';
import { AddonManager } from 'common/public/AddonManager';
import { ITerminalOptions } from 'common/Types';
/**
 * The set of options that only have an effect when set in the Terminal constructor.
 */
const CONSTRUCTOR_ONLY_OPTIONS = ['cols', 'rows'];

export class Terminal implements ITerminalApi {
  private _core: TerminalCore;
  private _addonManager: AddonManager;
  private _parser: IParser | undefined;
  private _buffer: BufferNamespaceApi | undefined;
  private _publicOptions: Required<ITerminalOptions>;

  constructor(options?: ITerminalOptions & ITerminalInitOnlyOptions) {
    this._core = new TerminalCore(options);
    this._addonManager = new AddonManager();

    this._publicOptions = { ... this._core.options };
    const getter = (propName: string): any => {
      return this._core.options[propName];
    };
    const setter = (propName: string, value: any): void => {
      this._checkReadonlyOptions(propName);
      this._core.options[propName] = value;
    };

    for (const propName in this._core.options) {
      Object.defineProperty(this._publicOptions, propName, {
        get: () => {
          return this._core.options[propName];
        },
        set: (value: any) => {
          this._checkReadonlyOptions(propName);
          this._core.options[propName] = value;
        }
      });
      const desc = {
        get: getter.bind(this, propName),
        set: setter.bind(this, propName)
      };
      Object.defineProperty(this._publicOptions, propName, desc);
    }
  }

  private _checkReadonlyOptions(propName: string): void {
    // Throw an error if any constructor only option is modified
    // from terminal.options
    // Modifications from anywhere else are allowed
    if (CONSTRUCTOR_ONLY_OPTIONS.includes(propName)) {
      throw new Error(`Option "${propName}" can only be set in the constructor`);
    }
  }

  private _checkProposedApi(): void {
    if (!this._core.optionsService.options.allowProposedApi) {
      throw new Error('You must set the allowProposedApi option to true to use proposed API');
    }
  }

  public get onBell(): IEvent<void> { return this._core.onBell; }
  public get onBinary(): IEvent<string> { return this._core.onBinary; }
  public get onCursorMove(): IEvent<void> { return this._core.onCursorMove; }
  public get onData(): IEvent<string> { return this._core.onData; }
  public get onLineFeed(): IEvent<void> { return this._core.onLineFeed; }
  public get onResize(): IEvent<{ cols: number, rows: number }> { return this._core.onResize; }
  public get onScroll(): IEvent<number> { return this._core.onScroll; }
  public get onTitleChange(): IEvent<string> { return this._core.onTitleChange; }

  public get parser(): IParser {
    this._checkProposedApi();
    if (!this._parser) {
      this._parser = new ParserApi(this._core);
    }
    return this._parser;
  }
  public get unicode(): IUnicodeHandling {
    this._checkProposedApi();
    return new UnicodeApi(this._core);
  }
  public get rows(): number { return this._core.rows; }
  public get cols(): number { return this._core.cols; }
  public get buffer(): IBufferNamespaceApi {
    this._checkProposedApi();
    if (!this._buffer) {
      this._buffer = new BufferNamespaceApi(this._core);
    }
    return this._buffer;
  }
  public get markers(): ReadonlyArray<IMarker> {
    this._checkProposedApi();
    return this._core.markers;
  }
  public get modes(): IModes {
    const m = this._core.coreService.decPrivateModes;
    let mouseTrackingMode: 'none' | 'x10' | 'vt200' | 'drag' | 'any' = 'none';
    switch (this._core.coreMouseService.activeProtocol) {
      case 'X10': mouseTrackingMode = 'x10'; break;
      case 'VT200': mouseTrackingMode = 'vt200'; break;
      case 'DRAG': mouseTrackingMode = 'drag'; break;
      case 'ANY': mouseTrackingMode = 'any'; break;
    }
    return {
      applicationCursorKeysMode: m.applicationCursorKeys,
      applicationKeypadMode: m.applicationKeypad,
      bracketedPasteMode: m.bracketedPasteMode,
      insertMode: this._core.coreService.modes.insertMode,
      mouseTrackingMode: mouseTrackingMode,
      originMode: m.origin,
      reverseWraparoundMode: m.reverseWraparound,
      sendFocusMode: m.sendFocus,
      wraparoundMode: m.wraparound
    };
  }
  public get options(): Required<ITerminalOptions> {
    return this._publicOptions;
  }
  public set options(options: ITerminalOptions) {
    for (const propName in options) {
      this._publicOptions[propName] = options[propName];
    }
  }
  public resize(columns: number, rows: number): void {
    this._verifyIntegers(columns, rows);
    this._core.resize(columns, rows);
  }
  public registerMarker(cursorYOffset: number = 0): IMarker | undefined {
    this._checkProposedApi();
    this._verifyIntegers(cursorYOffset);
    return this._core.addMarker(cursorYOffset);
  }
  public addMarker(cursorYOffset: number): IMarker | undefined {
    return this.registerMarker(cursorYOffset);
  }
  public dispose(): void {
    this._addonManager.dispose();
    this._core.dispose();
  }
  public scrollLines(amount: number): void {
    this._verifyIntegers(amount);
    this._core.scrollLines(amount);
  }
  public scrollPages(pageCount: number): void {
    this._verifyIntegers(pageCount);
    this._core.scrollPages(pageCount);
  }
  public scrollToTop(): void {
    this._core.scrollToTop();
  }
  public scrollToBottom(): void {
    this._core.scrollToBottom();
  }
  public scrollToLine(line: number): void {
    this._verifyIntegers(line);
    this._core.scrollToLine(line);
  }
  public clear(): void {
    this._core.clear();
  }
  public write(data: string | Uint8Array, callback?: () => void): void {
    this._core.write(data, callback);
  }
  public writeln(data: string | Uint8Array, callback?: () => void): void {
    this._core.write(data);
    this._core.write('\r\n', callback);
  }
  public reset(): void {
    this._core.reset();
  }
  public loadAddon(addon: ITerminalAddon): void {
    // TODO: This could cause issues if the addon calls renderer apis
    return this._addonManager.loadAddon(this as any, addon);
  }

  private _verifyIntegers(...values: number[]): void {
    for (const value of values) {
      if (value === Infinity || isNaN(value) || value % 1 !== 0) {
        throw new Error('This API only accepts integers');
      }
    }
  }
}
