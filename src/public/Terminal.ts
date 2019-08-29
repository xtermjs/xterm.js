/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal as ITerminalApi, ITerminalOptions, IMarker, IDisposable, ILinkMatcherOptions, ITheme, ILocalizableStrings, ITerminalAddon, ISelectionPosition, IBuffer as IBufferApi, IBufferLine as IBufferLineApi, IBufferCell as IBufferCellApi, IBufferCellColor as IBufferCellColorApi, IBufferCellFlags as IBufferCellFlagsApi } from 'xterm';
import { ITerminal } from '../Types';
import { IBufferLine } from 'common/Types';
import { IBuffer } from 'common/buffer/Types';
import { Attributes, FgFlags, BgFlags } from 'common/buffer/Constants';
import { CellData } from 'common/buffer/CellData';
import { Terminal as TerminalCore } from '../Terminal';
import * as Strings from '../browser/LocalizableStrings';
import { IEvent } from 'common/EventEmitter';
import { AddonManager } from './AddonManager';
import { IParams } from 'common/parser/Types';
import { AttributeData } from 'common/buffer/AttributeData';

export class Terminal implements ITerminalApi {
  private _core: ITerminal;
  private _addonManager: AddonManager;

  constructor(options?: ITerminalOptions) {
    this._core = new TerminalCore(options);
    this._addonManager = new AddonManager();
  }

  public get onCursorMove(): IEvent<void> { return this._core.onCursorMove; }
  public get onLineFeed(): IEvent<void> { return this._core.onLineFeed; }
  public get onSelectionChange(): IEvent<void> { return this._core.onSelectionChange; }
  public get onData(): IEvent<string> { return this._core.onData; }
  public get onTitleChange(): IEvent<string> { return this._core.onTitleChange; }
  public get onScroll(): IEvent<number> { return this._core.onScroll; }
  public get onKey(): IEvent<{ key: string, domEvent: KeyboardEvent }> { return this._core.onKey; }
  public get onRender(): IEvent<{ start: number, end: number }> { return this._core.onRender; }
  public get onResize(): IEvent<{ cols: number, rows: number }> { return this._core.onResize; }

  public get element(): HTMLElement { return this._core.element; }
  public get textarea(): HTMLTextAreaElement { return this._core.textarea; }
  public get rows(): number { return this._core.rows; }
  public get cols(): number { return this._core.cols; }
  public get buffer(): IBufferApi { return new BufferApiView(this._core.buffer); }
  public get markers(): ReadonlyArray<IMarker> { return this._core.markers; }
  public blur(): void {
    this._core.blur();
  }
  public focus(): void {
    this._core.focus();
  }
  public resize(columns: number, rows: number): void {
    this._verifyIntegers(columns, rows);
    this._core.resize(columns, rows);
  }
  public writeln(data: string): void {
    this._core.writeln(data);
  }
  public open(parent: HTMLElement): void {
    this._core.open(parent);
  }
  public attachCustomKeyEventHandler(customKeyEventHandler: (event: KeyboardEvent) => boolean): void {
    this._core.attachCustomKeyEventHandler(customKeyEventHandler);
  }
  public addCsiHandler(flag: string, callback: (params: (number | number[])[], collect: string) => boolean): IDisposable {
    return this._core.addCsiHandler(flag, (params: IParams, collect: string) => callback(params.toArray(), collect));
  }
  public addOscHandler(ident: number, callback: (data: string) => boolean): IDisposable {
    return this._core.addOscHandler(ident, callback);
  }
  public registerLinkMatcher(regex: RegExp, handler: (event: MouseEvent, uri: string) => void, options?: ILinkMatcherOptions): number {
    return this._core.registerLinkMatcher(regex, handler, options);
  }
  public deregisterLinkMatcher(matcherId: number): void {
    this._core.deregisterLinkMatcher(matcherId);
  }
  public registerCharacterJoiner(handler: (text: string) => [number, number][]): number {
    return this._core.registerCharacterJoiner(handler);
  }
  public deregisterCharacterJoiner(joinerId: number): void {
    this._core.deregisterCharacterJoiner(joinerId);
  }
  public addMarker(cursorYOffset: number): IMarker {
    this._verifyIntegers(cursorYOffset);
    return this._core.addMarker(cursorYOffset);
  }
  public hasSelection(): boolean {
    return this._core.hasSelection();
  }
  public select(column: number, row: number, length: number): void {
    this._verifyIntegers(column, row, length);
    this._core.select(column, row, length);
  }
  public getSelection(): string {
    return this._core.getSelection();
  }
  public getSelectionPosition(): ISelectionPosition | undefined {
    return this._core.getSelectionPosition();
  }
  public clearSelection(): void {
    this._core.clearSelection();
  }
  public selectAll(): void {
    this._core.selectAll();
  }
  public selectLines(start: number, end: number): void {
    this._verifyIntegers(start, end);
    this._core.selectLines(start, end);
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
  public write(data: string): void {
    this._core.write(data);
  }
  public writeUtf8(data: Uint8Array): void {
    this._core.writeUtf8(data);
  }
  public getOption(key: 'bellSound' | 'bellStyle' | 'cursorStyle' | 'fontFamily' | 'fontWeight' | 'fontWeightBold' | 'logLevel' | 'rendererType' | 'termName' | 'wordSeparator'): string;
  public getOption(key: 'allowTransparency' | 'cancelEvents' | 'convertEol' | 'cursorBlink' | 'disableStdin' | 'macOptionIsMeta' | 'rightClickSelectsWord' | 'popOnBell' | 'screenKeys' | 'useFlowControl' | 'visualBell'): boolean;
  public getOption(key: 'colors'): string[];
  public getOption(key: 'cols' | 'fontSize' | 'letterSpacing' | 'lineHeight' | 'rows' | 'tabStopWidth' | 'scrollback'): number;
  public getOption(key: 'handler'): (data: string) => void;
  public getOption(key: string): any;
  public getOption(key: any): any {
    return this._core.optionsService.getOption(key);
  }
  public setOption(key: 'bellSound' | 'fontFamily' | 'termName' | 'wordSeparator', value: string): void;
  public setOption(key: 'fontWeight' | 'fontWeightBold', value: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'): void;
  public setOption(key: 'logLevel', value: 'debug' | 'info' | 'warn' | 'error' | 'off'): void;
  public setOption(key: 'bellStyle', value: 'none' | 'visual' | 'sound' | 'both'): void;
  public setOption(key: 'cursorStyle', value: 'block' | 'underline' | 'bar'): void;
  public setOption(key: 'allowTransparency' | 'cancelEvents' | 'convertEol' | 'cursorBlink' | 'disableStdin' | 'macOptionIsMeta' | 'rightClickSelectsWord' | 'popOnBell' | 'screenKeys' | 'useFlowControl' | 'visualBell', value: boolean): void;
  public setOption(key: 'colors', value: string[]): void;
  public setOption(key: 'fontSize' | 'letterSpacing' | 'lineHeight' | 'tabStopWidth' | 'scrollback', value: number): void;
  public setOption(key: 'handler', value: (data: string) => void): void;
  public setOption(key: 'theme', value: ITheme): void;
  public setOption(key: 'cols' | 'rows', value: number): void;
  public setOption(key: string, value: any): void;
  public setOption(key: any, value: any): void {
    this._core.optionsService.setOption(key, value);
  }
  public refresh(start: number, end: number): void {
    this._verifyIntegers(start, end);
    this._core.refresh(start, end);
  }
  public reset(): void {
    this._core.reset();
  }
  public static applyAddon(addon: any): void {
    addon.apply(Terminal);
  }
  public loadAddon(addon: ITerminalAddon): void {
    return this._addonManager.loadAddon(this, addon);
  }
  public static get strings(): ILocalizableStrings {
    return Strings;
  }

  private _verifyIntegers(...values: number[]): void {
    values.forEach(value => {
      if (value % 1 !== 0) {
        throw new Error('This API does not accept floating point numbers');
      }
    });
  }
}

class BufferApiView implements IBufferApi {
  constructor(private _buffer: IBuffer) { }

  public get cursorY(): number { return this._buffer.y; }
  public get cursorX(): number { return this._buffer.x; }
  public get viewportY(): number { return this._buffer.ydisp; }
  public get baseY(): number { return this._buffer.ybase; }
  public get length(): number { return this._buffer.lines.length; }
  public getLine(y: number): IBufferLineApi | undefined {
    const line = this._buffer.lines.get(y);
    if (!line) {
      return undefined;
    }
    return new BufferLineApiView(line);
  }
  public getNullCell(): IBufferCellApi { return new BufferCellApiView(new CellData()); }
}

class BufferLineApiView implements IBufferLineApi {
  constructor(private _line: IBufferLine) { }

  public get isWrapped(): boolean { return this._line.isWrapped; }
  public get length(): number { return this._line.length; }
  public getCell(x: number, cell?: BufferCellApiView): IBufferCellApi | undefined {
    if (x < 0 || x >= this._line.length) {
      return undefined;
    }

    if (cell) {
      this._line.loadCell(x, cell.cell);
      return cell;
    }
    return new BufferCellApiView(this._line.loadCell(x, new CellData()));
  }
  public translateToString(trimRight?: boolean, startColumn?: number, endColumn?: number): string {
    return this._line.translateToString(trimRight, startColumn, endColumn);
  }
}

const fgFlagMask = FgFlags.BOLD | FgFlags.BLINK | FgFlags.INVERSE | FgFlags.INVISIBLE | FgFlags.UNDERLINE;
const bgFlagMask = BgFlags.DIM | BgFlags.ITALIC;
const colorMask = Attributes.CM_MASK | Attributes.RGB_MASK;

class BufferCellApiView implements IBufferCellApi {
  public flags: IBufferCellFlagsApi;
  public fg: IBufferCellColorApi;
  public bg: IBufferCellColorApi;
  constructor(public cell: CellData) {
    this.flags = {
      get bold(): boolean { return !!(cell.fg & FgFlags.BOLD); },
      get underline(): boolean { return !!(cell.fg & FgFlags.UNDERLINE); },
      get blink(): boolean { return !!(cell.fg & FgFlags.BLINK); },
      get inverse(): boolean { return !!(cell.fg & FgFlags.INVERSE); },
      get invisible(): boolean { return !!(cell.fg & FgFlags.INVISIBLE); },
      get italic(): boolean { return !!(cell.bg & BgFlags.ITALIC); },
      get dim(): boolean { return !!(cell.bg & BgFlags.DIM); }
    };
    this.fg = {
      get colorMode(): 'RGB' | 'P256' | 'P16' | 'DEFAULT' {
        switch (cell.getFgColorMode()) {
          case Attributes.CM_RGB: return 'RGB';
          case Attributes.CM_P256: return 'P256';
          case Attributes.CM_P16: return 'P16';
          default: return 'DEFAULT';
        }
      },
      get color(): number { return cell.getFgColor(); },
      get rgb(): [number, number, number] { return AttributeData.toColorRGB(cell.getFgColor()); }
    };
    this.bg = {
      get colorMode(): 'RGB' | 'P256' | 'P16' | 'DEFAULT' {
        switch (cell.getFgColorMode()) {
          case Attributes.CM_RGB: return 'RGB';
          case Attributes.CM_P256: return 'P256';
          case Attributes.CM_P16: return 'P16';
          default: return 'DEFAULT';
        }
      },
      get color(): number { return cell.getBgColor(); },
      get rgb(): [number, number, number] { return AttributeData.toColorRGB(cell.getBgColor()); }
    };
  }
  public get char(): string { return this.cell.getChars(); }
  public get width(): number { return this.cell.getWidth(); }
  public isDefaultAttibutes(): boolean {
    return this.cell.fg === 0 && this.cell.bg === 0;
  }
  public equalAttibutes(other: BufferCellApiView): boolean {
    return this.cell.fg === other.cell.fg && this.cell.bg === other.cell.bg;
  }
  public equalFlags(other: BufferCellApiView): boolean {
    return (this.cell.fg & fgFlagMask) === (other.cell.fg & fgFlagMask)
      && (this.cell.bg & bgFlagMask) === (other.cell.bg & bgFlagMask);
  }
  public equalFg(other: BufferCellApiView): boolean {
    return (this.cell.fg & colorMask) === (other.cell.fg & colorMask);
  }
  public equalBg(other: BufferCellApiView): boolean {
    return (this.cell.bg & colorMask) === (other.cell.bg & colorMask);
  }
}
