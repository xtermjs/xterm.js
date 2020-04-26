/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IRenderer, IRenderDimensions, CharacterJoinerHandler, IRequestRedrawEvent } from 'browser/renderer/Types';
import { ICompositionHelper, ITerminal, IBrowser } from './Types';
import { IBuffer, IBufferStringIterator, IBufferSet } from 'common/buffer/Types';
import { IBufferLine, ICellData, IAttributeData, ICircularList, XtermListener, ICharset, ITerminalOptions } from 'common/Types';
import { Buffer } from 'common/buffer/Buffer';
import * as Browser from 'common/Platform';
import { IDisposable, IMarker, IEvent, ISelectionPosition, ILinkProvider } from 'xterm';
import { Terminal } from './Terminal';
import { AttributeData } from 'common/buffer/AttributeData';
import { IColorManager, IColorSet, ILinkMatcherOptions, ILinkifier, IViewport, ILinkifier2 } from 'browser/Types';
import { IOptionsService, IUnicodeService } from 'common/services/Services';
import { IParams, IFunctionIdentifier } from 'common/parser/Types';
import { ISelectionService } from 'browser/services/Services';

export class TestTerminal extends Terminal {
  public get curAttrData(): IAttributeData { return (this as any)._inputHandler._curAttrData; }
  public keyDown(ev: any): boolean { return this._keyDown(ev); }
  public keyPress(ev: any): boolean { return this._keyPress(ev); }
}

export class MockTerminal implements ITerminal {
  public onBlur: IEvent<void>;
  public onFocus: IEvent<void>;
  public onA11yChar: IEvent<string>;
  public onA11yTab: IEvent<number>;
  public onCursorMove: IEvent<void>;
  public onLineFeed: IEvent<void>;
  public onSelectionChange: IEvent<void>;
  public onData: IEvent<string>;
  public onBinary: IEvent<string>;
  public onTitleChange: IEvent<string>;
  public onScroll: IEvent<number>;
  public onKey: IEvent<{ key: string, domEvent: KeyboardEvent }>;
  public onRender: IEvent<{ start: number, end: number }>;
  public onResize: IEvent<{ cols: number, rows: number }>;
  public markers: IMarker[];
  public optionsService: IOptionsService;
  public unicodeService: IUnicodeService;
  public addMarker(cursorYOffset: number): IMarker {
    throw new Error('Method not implemented.');
  }
  public selectLines(start: number, end: number): void {
    throw new Error('Method not implemented.');
  }
  public scrollToLine(line: number): void {
    throw new Error('Method not implemented.');
  }
  public static string: any;
  public setOption(key: any, value: any): void {
    throw new Error('Method not implemented.');
  }
  public blur(): void {
    throw new Error('Method not implemented.');
  }
  public focus(): void {
    throw new Error('Method not implemented.');
  }
  public resize(columns: number, rows: number): void {
    throw new Error('Method not implemented.');
  }
  public writeln(data: string): void {
    throw new Error('Method not implemented.');
  }
  public paste(data: string): void {
    throw new Error('Method not implemented.');
  }
  public open(parent: HTMLElement): void {
    throw new Error('Method not implemented.');
  }
  public attachCustomKeyEventHandler(customKeyEventHandler: (event: KeyboardEvent) => boolean): void {
    throw new Error('Method not implemented.');
  }
  public addCsiHandler(id: IFunctionIdentifier, callback: (params: IParams) => boolean): IDisposable {
    throw new Error('Method not implemented.');
  }
  public addDcsHandler(id: IFunctionIdentifier, callback: (data: string, param: IParams) => boolean): IDisposable {
    throw new Error('Method not implemented.');
  }
  public addEscHandler(id: IFunctionIdentifier, handler: () => boolean): IDisposable {
    throw new Error('Method not implemented.');
  }
  public addOscHandler(ident: number, callback: (data: string) => boolean): IDisposable {
    throw new Error('Method not implemented.');
  }
  public registerLinkMatcher(regex: RegExp, handler: (event: MouseEvent, uri: string) => boolean | void, options?: ILinkMatcherOptions): number {
    throw new Error('Method not implemented.');
  }
  public deregisterLinkMatcher(matcherId: number): void {
    throw new Error('Method not implemented.');
  }
  public registerLinkProvider(linkProvider: ILinkProvider): IDisposable {
    throw new Error('Method not implemented.');
  }
  public hasSelection(): boolean {
    throw new Error('Method not implemented.');
  }
  public getSelection(): string {
    throw new Error('Method not implemented.');
  }
  public getSelectionPosition(): ISelectionPosition | undefined {
    throw new Error('Method not implemented.');
  }
  public clearSelection(): void {
    throw new Error('Method not implemented.');
  }
  public select(column: number, row: number, length: number): void {
    throw new Error('Method not implemented.');
  }
  public selectAll(): void {
    throw new Error('Method not implemented.');
  }
  public dispose(): void {
    throw new Error('Method not implemented.');
  }
  public scrollPages(pageCount: number): void {
    throw new Error('Method not implemented.');
  }
  public scrollToTop(): void {
    throw new Error('Method not implemented.');
  }
  public scrollToBottom(): void {
    throw new Error('Method not implemented.');
  }
  public clear(): void {
    throw new Error('Method not implemented.');
  }
  public write(data: string): void {
    throw new Error('Method not implemented.');
  }
  public writeUtf8(data: Uint8Array): void {
    throw new Error('Method not implemented.');
  }
  public bracketedPasteMode: boolean;
  public renderer: IRenderer;
  public linkifier: ILinkifier;
  public linkifier2: ILinkifier2;
  public isFocused: boolean;
  public options: ITerminalOptions = {};
  public element: HTMLElement;
  public screenElement: HTMLElement;
  public rowContainer: HTMLElement;
  public selectionContainer: HTMLElement;
  public selectionService: ISelectionService;
  public textarea: HTMLTextAreaElement;
  public rows: number;
  public cols: number;
  public browser: IBrowser = <any>Browser;
  public writeBuffer: string[];
  public children: HTMLElement[];
  public cursorHidden: boolean;
  public cursorState: number;
  public scrollback: number;
  public buffers: IBufferSet;
  public buffer: IBuffer;
  public viewport: IViewport;
  public applicationCursor: boolean;
  public handler(data: string): void {
    throw new Error('Method not implemented.');
  }
  public on(event: string, callback: (...args: any[]) => void): void {
    throw new Error('Method not implemented.');
  }
  public off(type: string, listener: XtermListener): void {
    throw new Error('Method not implemented.');
  }
  public addDisposableListener(type: string, handler: XtermListener): IDisposable {
    throw new Error('Method not implemented.');
  }
  public scrollLines(disp: number): void {
    throw new Error('Method not implemented.');
  }
  public scrollToRow(absoluteRow: number): number {
    throw new Error('Method not implemented.');
  }
  public cancel(ev: Event, force?: boolean): void {
    throw new Error('Method not implemented.');
  }
  public log(text: string): void {
    throw new Error('Method not implemented.');
  }
  public emit(event: string, data: any): void {
    throw new Error('Method not implemented.');
  }
  public reset(): void {
    throw new Error('Method not implemented.');
  }
  public refresh(start: number, end: number): void {
    throw new Error('Method not implemented.');
  }
  public registerCharacterJoiner(handler: CharacterJoinerHandler): number { return 0; }
  public deregisterCharacterJoiner(joinerId: number): void { }
}

export class MockBuffer implements IBuffer {
  public markers: IMarker[];
  public addMarker(y: number): IMarker {
    throw new Error('Method not implemented.');
  }
  public isCursorInViewport: boolean;
  public lines: ICircularList<IBufferLine>;
  public ydisp: number;
  public ybase: number;
  public hasScrollback: boolean;
  public y: number;
  public x: number;
  public tabs: any;
  public scrollBottom: number;
  public scrollTop: number;
  public savedY: number;
  public savedX: number;
  public savedCharset: ICharset | null;
  public savedCurAttrData = new AttributeData();
  public translateBufferLineToString(lineIndex: number, trimRight: boolean, startCol?: number, endCol?: number): string {
    return Buffer.prototype.translateBufferLineToString.apply(this, arguments);
  }
  public getWrappedRangeForLine(y: number): { first: number, last: number } {
    return Buffer.prototype.getWrappedRangeForLine.apply(this, arguments);
  }
  public nextStop(x?: number): number {
    throw new Error('Method not implemented.');
  }
  public prevStop(x?: number): number {
    throw new Error('Method not implemented.');
  }
  public setLines(lines: ICircularList<IBufferLine>): void {
    this.lines = lines;
  }
  public getBlankLine(attr: IAttributeData, isWrapped?: boolean): IBufferLine {
    return Buffer.prototype.getBlankLine.apply(this, arguments);
  }
  public stringIndexToBufferIndex(lineIndex: number, stringIndex: number): number[] {
    return Buffer.prototype.stringIndexToBufferIndex.apply(this, arguments);
  }
  public iterator(trimRight: boolean, startIndex?: number, endIndex?: number): IBufferStringIterator {
    return Buffer.prototype.iterator.apply(this, arguments);
  }
  public getNullCell(attr?: IAttributeData): ICellData {
    throw new Error('Method not implemented.');
  }
  public getWhitespaceCell(attr?: IAttributeData): ICellData {
    throw new Error('Method not implemented.');
  }
}

export class MockRenderer implements IRenderer {
  public onRequestRedraw: IEvent<IRequestRedrawEvent>;
  public onCanvasResize: IEvent<{ width: number, height: number }>;
  public onRender: IEvent<{ start: number, end: number }>;
  public dispose(): void {
    throw new Error('Method not implemented.');
  }
  public colorManager: IColorManager;
  public on(type: string, listener: XtermListener): void {
    throw new Error('Method not implemented.');
  }
  public off(type: string, listener: XtermListener): void {
    throw new Error('Method not implemented.');
  }
  public emit(type: string, data?: any): void {
    throw new Error('Method not implemented.');
  }
  public addDisposableListener(type: string, handler: XtermListener): IDisposable {
    throw new Error('Method not implemented.');
  }
  public dimensions: IRenderDimensions;
  public setColors(colors: IColorSet): void {
    throw new Error('Method not implemented.');
  }
  public onResize(cols: number, rows: number): void { }
  public onCharSizeChanged(): void { }
  public onBlur(): void { }
  public onFocus(): void { }
  public onSelectionChanged(start: [number, number], end: [number, number]): void { }
  public onCursorMove(): void { }
  public onOptionsChanged(): void { }
  public onDevicePixelRatioChange(): void { }
  public clear(): void { }
  public renderRows(start: number, end: number): void { }
  public registerCharacterJoiner(handler: CharacterJoinerHandler): number { return 0; }
  public deregisterCharacterJoiner(): boolean { return true; }
}

export class MockViewport implements IViewport {
  public dispose(): void {
    throw new Error('Method not implemented.');
  }
  public scrollBarWidth: number = 0;
  public onThemeChange(colors: IColorSet): void {
    throw new Error('Method not implemented.');
  }
  public onWheel(ev: WheelEvent): boolean {
    throw new Error('Method not implemented.');
  }
  public onTouchStart(ev: TouchEvent): void {
    throw new Error('Method not implemented.');
  }
  public onTouchMove(ev: TouchEvent): boolean {
    throw new Error('Method not implemented.');
  }
  public syncScrollArea(): void { }
  public getLinesScrolled(ev: WheelEvent): number {
    throw new Error('Method not implemented.');
  }
}

export class MockCompositionHelper implements ICompositionHelper {
  public compositionstart(): void {
    throw new Error('Method not implemented.');
  }
  public compositionupdate(ev: CompositionEvent): void {
    throw new Error('Method not implemented.');
  }
  public compositionend(): void {
    throw new Error('Method not implemented.');
  }
  public updateCompositionElements(dontRecurse?: boolean): void {
    throw new Error('Method not implemented.');
  }
  public keydown(ev: KeyboardEvent): boolean {
    return true;
  }
}
