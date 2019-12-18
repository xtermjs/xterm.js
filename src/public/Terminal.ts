/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal as ITerminalApi, ITerminalOptions, IMarker, IDisposable, ILinkMatcherOptions, ITheme, ILocalizableStrings, ITerminalAddon, ISelectionPosition, IBuffer as IBufferApi, IBufferLine as IBufferLineApi, IBufferCell as IBufferCellApi, IParser, IFunctionIdentifier } from 'xterm';
import { ITerminal } from '../Types';
import { IBufferLine } from 'common/Types';
import { IBuffer } from 'common/buffer/Types';
import { Attributes } from 'common/buffer/Constants';
import { CellData } from 'common/buffer/CellData';
import { Terminal as TerminalCore } from '../Terminal';
import * as Strings from '../browser/LocalizableStrings';
import { IEvent } from 'common/EventEmitter';
import { AddonManager } from './AddonManager';
import { IParams } from 'common/parser/Types';

export class Terminal implements ITerminalApi {
  private _core: ITerminal;
  private _addonManager: AddonManager;
  private _parser: IParser;

  constructor(options?: ITerminalOptions) {
    this._core = new TerminalCore(options);
    this._addonManager = new AddonManager();
  }

  public get onCursorMove(): IEvent<void> { return this._core.onCursorMove; }
  public get onLineFeed(): IEvent<void> { return this._core.onLineFeed; }
  public get onSelectionChange(): IEvent<void> { return this._core.onSelectionChange; }
  public get onData(): IEvent<string> { return this._core.onData; }
  public get onBinary(): IEvent<string> { return this._core.onBinary; }
  public get onTitleChange(): IEvent<string> { return this._core.onTitleChange; }
  public get onScroll(): IEvent<number> { return this._core.onScroll; }
  public get onKey(): IEvent<{ key: string, domEvent: KeyboardEvent }> { return this._core.onKey; }
  public get onRender(): IEvent<{ start: number, end: number }> { return this._core.onRender; }
  public get onResize(): IEvent<{ cols: number, rows: number }> { return this._core.onResize; }

  public get element(): HTMLElement | undefined { return this._core.element; }
  public get parser(): IParser {
    if (!this._parser) {
      this._parser = new ParserApi(this._core);
    }
    return this._parser;
  }
  public get textarea(): HTMLTextAreaElement | undefined { return this._core.textarea; }
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
  public open(parent: HTMLElement): void {
    this._core.open(parent);
  }
  public attachCustomKeyEventHandler(customKeyEventHandler: (event: KeyboardEvent) => boolean): void {
    this._core.attachCustomKeyEventHandler(customKeyEventHandler);
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
  public write(data: string | Uint8Array, callback?: () => void): void {
    this._core.write(data, callback);
  }
  public writeUtf8(data: Uint8Array, callback?: () => void): void {
    this._core.write(data, callback);
  }
  public writeln(data: string | Uint8Array, callback?: () => void): void {
    this._core.write(data);
    this._core.write('\r\n', callback);
  }
  public paste(data: string): void {
    this._core.paste(data);
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
  public loadAddon(addon: ITerminalAddon): void {
    return this._addonManager.loadAddon(this, addon);
  }
  public static get strings(): ILocalizableStrings {
    return Strings;
  }

  private _verifyIntegers(...values: number[]): void {
    values.forEach(value => {
      if (value === Infinity || isNaN(value) || value % 1 !== 0) {
        throw new Error('This API only accepts integers');
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

class BufferCellApiView implements IBufferCellApi {
  constructor(public cell: CellData) {}

  public get char(): string { return this.cell.getChars(); }
  public get width(): number { return this.cell.getWidth(); }

  public getWidth(): number { return this.cell.getWidth(); }
  public getChars(): string { return this.cell.getChars(); }
  public getCode(): number { return this.cell.getCode(); }

  public isInverse(): number { return this.cell.isInverse(); }
  public isBold(): number { return this.cell.isBold(); }
  public isUnderline(): number { return this.cell.isUnderline(); }
  public isBlink(): number { return this.cell.isBlink(); }
  public isInvisible(): number { return this.cell.isInvisible(); }
  public isItalic(): number { return this.cell.isItalic(); }
  public isDim(): number { return this.cell.isDim(); }

  public getFgColorMode(): number { return this.cell.getFgColorMode(); }
  public getBgColorMode(): number { return this.cell.getBgColorMode(); }
  public isFgRGB(): boolean { return this.cell.isFgRGB(); }
  public isBgRGB(): boolean { return this.cell.isBgRGB(); }
  public isFgPalette(): boolean { return this.cell.isFgPalette(); }
  public isBgPalette(): boolean { return this.cell.isBgPalette(); }
  public isFgPalette16(): boolean { return this.cell.getFgColorMode() === Attributes.CM_P16; }
  public isBgPalette16(): boolean { return this.cell.getBgColorMode() === Attributes.CM_P16; }
  public isFgPalette256(): boolean { return this.cell.getFgColorMode() === Attributes.CM_P256; }
  public isBgPalette256(): boolean { return this.cell.getBgColorMode() === Attributes.CM_P256; }

  public isAttributeDefault(): boolean { return this.cell.fg === 0 && this.cell.bg === 0; }
  public isFgDefault(): boolean { return this.cell.isFgDefault(); }
  public isBgDefault(): boolean { return this.cell.isBgDefault(); }

  public getFgColor(): number { return this.cell.getFgColor(); }
  public getBgColor(): number { return this.cell.getBgColor(); }
}

class ParserApi implements IParser {
  constructor(private _core: ITerminal) {}

  public addCsiHandler(id: IFunctionIdentifier, callback: (params: (number | number[])[]) => boolean): IDisposable {
    return this._core.addCsiHandler(id, (params: IParams) => callback(params.toArray()));
  }
  public addDcsHandler(id: IFunctionIdentifier, callback: (data: string, param: (number | number[])[]) => boolean): IDisposable {
    return this._core.addDcsHandler(id, (data: string, params: IParams) => callback(data, params.toArray()));
  }
  public addEscHandler(id: IFunctionIdentifier, handler: () => boolean): IDisposable {
    return this._core.addEscHandler(id, handler);
  }
  public addOscHandler(ident: number, callback: (data: string) => boolean): IDisposable {
    return this._core.addOscHandler(ident, callback);
  }
}
