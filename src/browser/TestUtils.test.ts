/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable, IMarker, ILinkProvider, IDecorationOptions, IDecoration } from '@xterm/xterm';
import { IEvent, EventEmitter } from 'common/EventEmitter';
import { ICharacterJoinerService, ICharSizeService, ICoreBrowserService, IMouseService, IRenderService, ISelectionService, IThemeService } from 'browser/services/Services';
import { IRenderDimensions, IRenderer, IRequestRedrawEvent } from 'browser/renderer/shared/Types';
import { IColorSet, ITerminal, ILinkifier2, IBrowser, IViewport, ICompositionHelper, CharacterJoinerHandler, IBufferRange, ReadonlyColorSet, IBufferElementProvider } from 'browser/Types';
import { IBuffer, IBufferSet } from 'common/buffer/Types';
import { IBufferLine, ICellData, IAttributeData, ICircularList, XtermListener, ICharset, ITerminalOptions, ColorIndex } from 'common/Types';
import { Buffer } from 'common/buffer/Buffer';
import * as Browser from 'common/Platform';
import { Terminal } from 'browser/Terminal';
import { IUnicodeService, IOptionsService, ICoreService, ICoreMouseService } from 'common/services/Services';
import { IFunctionIdentifier, IParams } from 'common/parser/Types';
import { AttributeData } from 'common/buffer/AttributeData';
import { ISelectionRedrawRequestEvent, ISelectionRequestScrollLinesEvent } from 'browser/selection/Types';
import { css } from 'common/Color';
import { createRenderDimensions } from 'browser/renderer/shared/RendererUtils';

export class TestTerminal extends Terminal {
  public get curAttrData(): IAttributeData { return (this as any)._inputHandler._curAttrData; }
  public keyDown(ev: any): boolean | undefined { return this._keyDown(ev); }
  public keyPress(ev: any): boolean { return this._keyPress(ev); }
  public writeP(data: string | Uint8Array): Promise<void> {
    return new Promise(r => this.write(data, r));
  }
}

export class MockTerminal implements ITerminal {
  public onBlur!: IEvent<void>;
  public onFocus!: IEvent<void>;
  public onA11yChar!: IEvent<string>;
  public onWriteParsed!: IEvent<void>;
  public onA11yTab!: IEvent<number>;
  public onCursorMove!: IEvent<void>;
  public onLineFeed!: IEvent<void>;
  public onSelectionChange!: IEvent<void>;
  public onData!: IEvent<string>;
  public onBinary!: IEvent<string>;
  public onTitleChange!: IEvent<string>;
  public onBell!: IEvent<void>;
  public onScroll!: IEvent<number>;
  public onWillOpen!: IEvent<HTMLElement>;
  public onKey!: IEvent<{ key: string, domEvent: KeyboardEvent }>;
  public onRender!: IEvent<{ start: number, end: number }>;
  public onResize!: IEvent<{ cols: number, rows: number }>;
  public markers!: IMarker[];
  public linkifier: ILinkifier2 | undefined;
  public coreMouseService!: ICoreMouseService;
  public coreService!: ICoreService;
  public optionsService!: IOptionsService;
  public unicodeService!: IUnicodeService;
  public registerMarker(cursorYOffset: number): IMarker {
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
  public input(data: string, wasUserInput: boolean = true): void {
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
  public attachCustomWheelEventHandler(customWheelEventHandler: (event: WheelEvent) => boolean): void {
    throw new Error('Method not implemented.');
  }
  public registerCsiHandler(id: IFunctionIdentifier, callback: (params: IParams) => boolean | Promise<boolean>): IDisposable {
    throw new Error('Method not implemented.');
  }
  public registerDcsHandler(id: IFunctionIdentifier, callback: (data: string, param: IParams) => boolean | Promise<boolean>): IDisposable {
    throw new Error('Method not implemented.');
  }
  public registerEscHandler(id: IFunctionIdentifier, handler: () => boolean | Promise<boolean>): IDisposable {
    throw new Error('Method not implemented.');
  }
  public registerOscHandler(ident: number, callback: (data: string) => boolean | Promise<boolean>): IDisposable {
    throw new Error('Method not implemented.');
  }
  public registerLinkProvider(linkProvider: ILinkProvider): IDisposable {
    throw new Error('Method not implemented.');
  }
  public registerDecoration(decorationOptions: IDecorationOptions): IDecoration | undefined {
    throw new Error('Method not implemented.');
  }
  public hasSelection(): boolean {
    throw new Error('Method not implemented.');
  }
  public getSelection(): string {
    throw new Error('Method not implemented.');
  }
  public getSelectionPosition(): IBufferRange | undefined {
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
  public getBufferElements(startLine: number, endLine?: number | undefined): { bufferElements: HTMLElement[], cursorElement?: HTMLElement | undefined } {
    throw new Error('Method not implemented.');
  }
  public registerBufferElementProvider(bufferProvider: IBufferElementProvider): IDisposable {
    throw new Error('Method not implemented.');
  }
  public bracketedPasteMode!: boolean;
  public renderer!: IRenderer;
  public isFocused!: boolean;
  public options!: Required<ITerminalOptions>;
  public element!: HTMLElement;
  public screenElement!: HTMLElement;
  public rowContainer!: HTMLElement;
  public selectionContainer!: HTMLElement;
  public selectionService!: ISelectionService;
  public textarea!: HTMLTextAreaElement;
  public rows!: number;
  public cols!: number;
  public browser: IBrowser = Browser as any;
  public writeBuffer!: string[];
  public children!: HTMLElement[];
  public cursorHidden!: boolean;
  public cursorState!: number;
  public scrollback!: number;
  public buffers!: IBufferSet;
  public buffer!: IBuffer;
  public viewport!: IViewport;
  public applicationCursor!: boolean;
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
  public clearTextureAtlas(): void {
    throw new Error('Method not implemented.');
  }
  public refresh(start: number, end: number): void {
    throw new Error('Method not implemented.');
  }
  public registerCharacterJoiner(handler: CharacterJoinerHandler): number { return 0; }
  public deregisterCharacterJoiner(joinerId: number): void { }
}

export class MockBuffer implements IBuffer {
  public markers!: IMarker[];
  public addMarker(y: number): IMarker {
    throw new Error('Method not implemented.');
  }
  public isCursorInViewport!: boolean;
  public lines!: ICircularList<IBufferLine>;
  public ydisp!: number;
  public ybase!: number;
  public hasScrollback!: boolean;
  public y!: number;
  public x!: number;
  public tabs: any;
  public scrollBottom!: number;
  public scrollTop!: number;
  public savedY!: number;
  public savedX!: number;
  public savedCharset: ICharset | undefined;
  public savedCurAttrData = new AttributeData();
  public translateBufferLineToString(lineIndex: number, trimRight: boolean, startCol?: number, endCol?: number): string {
    return Buffer.prototype.translateBufferLineToString.apply(this, arguments as any);
  }
  public getWrappedRangeForLine(y: number): { first: number, last: number } {
    return Buffer.prototype.getWrappedRangeForLine.apply(this, arguments as any);
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
    return Buffer.prototype.getBlankLine.apply(this, arguments as any);
  }
  public getNullCell(attr?: IAttributeData): ICellData {
    throw new Error('Method not implemented.');
  }
  public getWhitespaceCell(attr?: IAttributeData): ICellData {
    throw new Error('Method not implemented.');
  }
  public clearMarkers(y: number): void {
    throw new Error('Method not implemented.');
  }
  public clearAllMarkers(): void {
    throw new Error('Method not implemented.');
  }
}

export class MockRenderer implements IRenderer {
  public onRequestRedraw!: IEvent<IRequestRedrawEvent>;
  public onCanvasResize!: IEvent<{ width: number, height: number }>;
  public onRender!: IEvent<{ start: number, end: number }>;
  public dispose(): void {
    throw new Error('Method not implemented.');
  }
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
  public dimensions!: IRenderDimensions;
  public registerDecoration(decorationOptions: IDecorationOptions): IDecoration {
    throw new Error('Method not implemented.');
  }
  public handleResize(cols: number, rows: number): void { }
  public handleCharSizeChanged(): void { }
  public handleBlur(): void { }
  public handleFocus(): void { }
  public handleSelectionChanged(start: [number, number], end: [number, number]): void { }
  public handleCursorMove(): void { }
  public handleOptionsChanged(): void { }
  public handleDevicePixelRatioChange(): void { }
  public clear(): void { }
  public renderRows(start: number, end: number): void { }
}

export class MockViewport implements IViewport {
  private readonly _onRequestScrollLines = new EventEmitter<{ amount: number, suppressScrollEvent: boolean }>();
  public readonly onRequestScrollLines = this._onRequestScrollLines.event;
  public dispose(): void {
    throw new Error('Method not implemented.');
  }
  public scrollBarWidth: number = 0;
  public handleThemeChange(colors: IColorSet): void {
    throw new Error('Method not implemented.');
  }
  public handleWheel(ev: WheelEvent): boolean {
    throw new Error('Method not implemented.');
  }
  public handleTouchStart(ev: TouchEvent): void {
    throw new Error('Method not implemented.');
  }
  public handleTouchMove(ev: TouchEvent): boolean {
    throw new Error('Method not implemented.');
  }
  public syncScrollArea(): void { }
  public getLinesScrolled(ev: WheelEvent): number {
    throw new Error('Method not implemented.');
  }
  public getBufferElements(startLine: number, endLine?: number | undefined): { bufferElements: HTMLElement[], cursorElement?: HTMLElement | undefined } {
    throw new Error('Method not implemented.');
  }
  public scrollLines(disp: number): void {
    this._onRequestScrollLines.fire({ amount: disp, suppressScrollEvent: false });
  }
  public reset(): void {
  }
}

export class MockCompositionHelper implements ICompositionHelper {
  public get isComposing(): boolean {
    return false;
  }
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

export class MockCoreBrowserService implements ICoreBrowserService {
  public onDprChange = new EventEmitter<number>().event;
  public onWindowChange = new EventEmitter<Window & typeof globalThis, void>().event;
  public serviceBrand: undefined;
  public isFocused: boolean = true;
  public get window(): Window & typeof globalThis {
    throw Error('Window object not available in tests');
  }
  public get mainDocument(): Document {
    throw Error('Document object not available in tests');
  }
  public dpr: number = 1;
}

export class MockCharSizeService implements ICharSizeService {
  public serviceBrand: undefined;
  public get hasValidSize(): boolean { return this.width > 0 && this.height > 0; }
  public onCharSizeChange: IEvent<void> = new EventEmitter<void>().event;
  constructor(public width: number, public height: number) {}
  public measure(): void {}
}

export class MockMouseService implements IMouseService {
  public serviceBrand: undefined;
  public getCoords(event: {clientX: number, clientY: number}, element: HTMLElement, colCount: number, rowCount: number, isSelection?: boolean): [number, number] | undefined {
    throw new Error('Not implemented');
  }

  public getMouseReportCoords(event: MouseEvent, element: HTMLElement): { col: number, row: number, x: number, y: number } | undefined {
    throw new Error('Not implemented');
  }
}

export class MockRenderService implements IRenderService {
  public serviceBrand: undefined;
  public onDimensionsChange: IEvent<IRenderDimensions> = new EventEmitter<IRenderDimensions>().event;
  public onRenderedViewportChange: IEvent<{ start: number, end: number }, void> = new EventEmitter<{ start: number, end: number }>().event;
  public onRender: IEvent<{ start: number, end: number }, void> = new EventEmitter<{ start: number, end: number }>().event;
  public onRefreshRequest: IEvent<{ start: number, end: number}, void> = new EventEmitter<{ start: number, end: number }>().event;
  public dimensions: IRenderDimensions = createRenderDimensions();
  public refreshRows(start: number, end: number): void {
    throw new Error('Method not implemented.');
  }
  public addRefreshCallback(callback: FrameRequestCallback): number {
    throw new Error('Method not implemented.');
  }
  public clearTextureAtlas(): void {
    throw new Error('Method not implemented.');
  }
  public resize(cols: number, rows: number): void {
    throw new Error('Method not implemented.');
  }
  public hasRenderer(): boolean {
    throw new Error('Method not implemented.');
  }
  public setRenderer(renderer: IRenderer): void {
    throw new Error('Method not implemented.');
  }
  public handleDevicePixelRatioChange(): void {
    throw new Error('Method not implemented.');
  }
  public handleResize(cols: number, rows: number): void {
    throw new Error('Method not implemented.');
  }
  public handleCharSizeChanged(): void {
    throw new Error('Method not implemented.');
  }
  public handleBlur(): void {
    throw new Error('Method not implemented.');
  }
  public handleFocus(): void {
    throw new Error('Method not implemented.');
  }
  public handleSelectionChanged(start: [number, number], end: [number, number], columnSelectMode: boolean): void {
    throw new Error('Method not implemented.');
  }
  public handleCursorMove(): void {
    throw new Error('Method not implemented.');
  }
  public clear(): void {
    throw new Error('Method not implemented.');
  }
  public dispose(): void {
    throw new Error('Method not implemented.');
  }
  public registerDecoration(decorationOptions: IDecorationOptions): IDecoration {
    throw new Error('Method not implemented.');
  }
}

export class MockCharacterJoinerService implements ICharacterJoinerService {
  public serviceBrand: undefined;
  public register(handler: (text: string) => [number, number][]): number {
    return 0;
  }
  public deregister(joinerId: number): boolean {
    return true;
  }
  public getJoinedCharacters(row: number): [number, number][] {
    return [];
  }
}

export class MockSelectionService implements ISelectionService {
  public serviceBrand: undefined;
  public selectionText: string = '';
  public hasSelection: boolean = false;
  public selectionStart: [number, number] | undefined;
  public selectionEnd: [number, number] | undefined;
  public onLinuxMouseSelection = new EventEmitter<string>().event;
  public onRequestRedraw = new EventEmitter<ISelectionRedrawRequestEvent>().event;
  public onRequestScrollLines = new EventEmitter<ISelectionRequestScrollLinesEvent>().event;
  public onSelectionChange = new EventEmitter<void>().event;
  public disable(): void {
    throw new Error('Method not implemented.');
  }
  public enable(): void {
    throw new Error('Method not implemented.');
  }
  public reset(): void {
    throw new Error('Method not implemented.');
  }
  public setSelection(row: number, col: number, length: number): void {
    throw new Error('Method not implemented.');
  }
  public selectAll(): void {
    throw new Error('Method not implemented.');
  }
  public selectLines(start: number, end: number): void {
    throw new Error('Method not implemented.');
  }
  public clearSelection(): void {
    throw new Error('Method not implemented.');
  }
  public rightClickSelect(event: MouseEvent): void {
    throw new Error('Method not implemented.');
  }
  public shouldColumnSelect(event: MouseEvent | KeyboardEvent): boolean {
    throw new Error('Method not implemented.');
  }
  public shouldForceSelection(event: MouseEvent): boolean {
    throw new Error('Method not implemented.');
  }
  public refresh(isLinuxMouseSelection?: boolean): void {
    throw new Error('Method not implemented.');
  }
  public handleMouseDown(event: MouseEvent): void {
    throw new Error('Method not implemented.');
  }
  public isCellInSelection(x: number, y: number): boolean {
    return false;
  }
}

export class MockThemeService implements IThemeService{
  public serviceBrand: undefined;
  public onChangeColors = new EventEmitter<ReadonlyColorSet>().event;
  public restoreColor(slot?: ColorIndex | undefined): void {
    throw new Error('Method not implemented.');
  }
  public modifyColors(callback: (colors: IColorSet) => void): void {
    throw new Error('Method not implemented.');
  }
  public colors: ReadonlyColorSet = {
    background: css.toColor('#010101'),
    foreground: css.toColor('#020202'),
    ansi: [
      // dark:
      css.toColor('#2e3436'),
      css.toColor('#cc0000'),
      css.toColor('#4e9a06'),
      css.toColor('#c4a000'),
      css.toColor('#3465a4'),
      css.toColor('#75507b'),
      css.toColor('#06989a'),
      css.toColor('#d3d7cf'),
      // bright:
      css.toColor('#555753'),
      css.toColor('#ef2929'),
      css.toColor('#8ae234'),
      css.toColor('#fce94f'),
      css.toColor('#729fcf'),
      css.toColor('#ad7fa8'),
      css.toColor('#34e2e2'),
      css.toColor('#eeeeec')
    ],
    selectionBackgroundOpaque: css.toColor('#ff0000'),
    selectionInactiveBackgroundOpaque: css.toColor('#00ff00')
  } as any;
}
