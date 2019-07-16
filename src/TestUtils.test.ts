/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IRenderer, IRenderDimensions, CharacterJoinerHandler } from 'browser/renderer/Types';
import { IInputHandlingTerminal, ICompositionHelper, ITerminal, IBrowser, ITerminalOptions } from './Types';
import { IBuffer, IBufferStringIterator, IBufferSet } from 'common/buffer/Types';
import { IBufferLine, ICellData, IAttributeData, ICircularList, XtermListener, ICharset } from 'common/Types';
import { Buffer } from 'common/buffer/Buffer';
import * as Browser from 'common/Platform';
import { IDisposable, IMarker, IEvent, ISelectionPosition } from 'xterm';
import { Terminal } from './Terminal';
import { AttributeData } from 'common/buffer/AttributeData';
import { IColorManager, IColorSet, ILinkMatcherOptions, ILinkifier, IViewport } from 'browser/Types';
import { IOptionsService } from 'common/services/Services';
import { EventEmitter } from 'common/EventEmitter';
import { IParams } from 'common/parser/Types';
import { ISelectionService } from 'browser/services/Services';

export class TestTerminal extends Terminal {
  writeSync(data: string): void {
    this.writeBuffer.push(data);
    this._innerWrite();
  }
  keyDown(ev: any): boolean { return this._keyDown(ev); }
  keyPress(ev: any): boolean { return this._keyPress(ev); }
}

export class MockTerminal implements ITerminal {
  onBlur: IEvent<void>;
  onFocus: IEvent<void>;
  onA11yChar: IEvent<string>;
  onA11yTab: IEvent<number>;
  onCursorMove: IEvent<void>;
  onLineFeed: IEvent<void>;
  onSelectionChange: IEvent<void>;
  onData: IEvent<string>;
  onTitleChange: IEvent<string>;
  onScroll: IEvent<number>;
  onKey: IEvent<{ key: string; domEvent: KeyboardEvent; }>;
  onRender: IEvent<{ start: number; end: number; }>;
  onResize: IEvent<{ cols: number; rows: number; }>;
  markers: IMarker[];
  optionsService: IOptionsService;
  addMarker(cursorYOffset: number): IMarker {
    throw new Error('Method not implemented.');
  }
  selectLines(start: number, end: number): void {
    throw new Error('Method not implemented.');
  }
  scrollToLine(line: number): void {
    throw new Error('Method not implemented.');
  }
  static string: any;
  setOption(key: any, value: any): void {
    throw new Error('Method not implemented.');
  }
  blur(): void {
    throw new Error('Method not implemented.');
  }
  focus(): void {
    throw new Error('Method not implemented.');
  }
  resize(columns: number, rows: number): void {
    throw new Error('Method not implemented.');
  }
  writeln(data: string): void {
    throw new Error('Method not implemented.');
  }
  open(parent: HTMLElement): void {
    throw new Error('Method not implemented.');
  }
  attachCustomKeyEventHandler(customKeyEventHandler: (event: KeyboardEvent) => boolean): void {
    throw new Error('Method not implemented.');
  }
  addCsiHandler(flag: string, callback: (params: IParams, collect: string) => boolean): IDisposable {
      throw new Error('Method not implemented.');
  }
  addOscHandler(ident: number, callback: (data: string) => boolean): IDisposable {
      throw new Error('Method not implemented.');
  }
  registerLinkMatcher(regex: RegExp, handler: (event: MouseEvent, uri: string) => boolean | void, options?: ILinkMatcherOptions): number {
    throw new Error('Method not implemented.');
  }
  deregisterLinkMatcher(matcherId: number): void {
    throw new Error('Method not implemented.');
  }
  hasSelection(): boolean {
    throw new Error('Method not implemented.');
  }
  getSelection(): string {
    throw new Error('Method not implemented.');
  }
  getSelectionPosition(): ISelectionPosition | undefined {
    throw new Error('Method not implemented.');
  }
  clearSelection(): void {
    throw new Error('Method not implemented.');
  }
  select(column: number, row: number, length: number): void {
    throw new Error('Method not implemented.');
  }
  selectAll(): void {
    throw new Error('Method not implemented.');
  }
  dispose(): void {
    throw new Error('Method not implemented.');
  }
  scrollPages(pageCount: number): void {
    throw new Error('Method not implemented.');
  }
  scrollToTop(): void {
    throw new Error('Method not implemented.');
  }
  scrollToBottom(): void {
    throw new Error('Method not implemented.');
  }
  clear(): void {
    throw new Error('Method not implemented.');
  }
  write(data: string): void {
    throw new Error('Method not implemented.');
  }
  writeUtf8(data: Uint8Array): void {
    throw new Error('Method not implemented.');
  }
  bracketedPasteMode: boolean;
  renderer: IRenderer;
  linkifier: ILinkifier;
  isFocused: boolean;
  options: ITerminalOptions = {};
  element: HTMLElement;
  screenElement: HTMLElement;
  rowContainer: HTMLElement;
  selectionContainer: HTMLElement;
  selectionService: ISelectionService;
  textarea: HTMLTextAreaElement;
  rows: number;
  cols: number;
  browser: IBrowser = <any>Browser;
  writeBuffer: string[];
  children: HTMLElement[];
  cursorHidden: boolean;
  cursorState: number;
  scrollback: number;
  buffers: IBufferSet;
  buffer: IBuffer;
  viewport: IViewport;
  applicationCursor: boolean;
  handler(data: string): void {
    throw new Error('Method not implemented.');
  }
  on(event: string, callback: (...args: any[]) => void): void {
    throw new Error('Method not implemented.');
  }
  off(type: string, listener: XtermListener): void {
    throw new Error('Method not implemented.');
  }
  addDisposableListener(type: string, handler: XtermListener): IDisposable {
    throw new Error('Method not implemented.');
  }
  scrollLines(disp: number, suppressScrollEvent: boolean): void {
    throw new Error('Method not implemented.');
  }
  scrollToRow(absoluteRow: number): number {
    throw new Error('Method not implemented.');
  }
  cancel(ev: Event, force?: boolean): void {
    throw new Error('Method not implemented.');
  }
  log(text: string): void {
    throw new Error('Method not implemented.');
  }
  emit(event: string, data: any): void {
    throw new Error('Method not implemented.');
  }
  reset(): void {
    throw new Error('Method not implemented.');
  }
  showCursor(): void {
    throw new Error('Method not implemented.');
  }
  refresh(start: number, end: number): void {
    throw new Error('Method not implemented.');
  }
  registerCharacterJoiner(handler: CharacterJoinerHandler): number { return 0; }
  deregisterCharacterJoiner(joinerId: number): void { }
}

export class MockInputHandlingTerminal implements IInputHandlingTerminal {
  onA11yCharEmitter: EventEmitter<string>;
  onA11yTabEmitter: EventEmitter<number>;
  element: HTMLElement;
  options: ITerminalOptions = {};
  cols: number;
  rows: number;
  charset: { [key: string]: string; };
  gcharset: number;
  glevel: number;
  charsets: { [key: string]: string; }[];
  applicationKeypad: boolean;
  applicationCursor: boolean;
  originMode: boolean;
  insertMode: boolean;
  wraparoundMode: boolean;
  bracketedPasteMode: boolean;
  curAttrData = new AttributeData();
  savedCols: number;
  x10Mouse: boolean;
  vt200Mouse: boolean;
  normalMouse: boolean;
  mouseEvents: boolean;
  sendFocus: boolean;
  utfMouse: boolean;
  sgrMouse: boolean;
  urxvtMouse: boolean;
  cursorHidden: boolean;
  buffers: IBufferSet;
  buffer: IBuffer = new MockBuffer();
  viewport: IViewport;
  selectionService: ISelectionService;
  focus(): void {
    throw new Error('Method not implemented.');
  }
  convertEol: boolean;
  bell(): void {
    throw new Error('Method not implemented.');
  }

  updateRange(y: number): void {
    throw new Error('Method not implemented.');
  }
  scroll(isWrapped?: boolean): void {
    throw new Error('Method not implemented.');
  }
  nextStop(x?: number): number {
    throw new Error('Method not implemented.');
  }
  setgLevel(g: number): void {
    throw new Error('Method not implemented.');
  }
  eraseAttrData(): IAttributeData {
    throw new Error('Method not implemented.');
  }
  eraseRight(x: number, y: number): void {
    throw new Error('Method not implemented.');
  }
  eraseLine(y: number): void {
    throw new Error('Method not implemented.');
  }
  eraseLeft(x: number, y: number): void {
    throw new Error('Method not implemented.');
  }
  prevStop(x?: number): number {
    throw new Error('Method not implemented.');
  }
  is(term: string): boolean {
    throw new Error('Method not implemented.');
  }
  setgCharset(g: number, charset: { [key: string]: string; }): void {
    throw new Error('Method not implemented.');
  }
  resize(x: number, y: number): void {
    throw new Error('Method not implemented.');
  }
  log(text: string, data?: any): void {
    throw new Error('Method not implemented.');
  }
  reset(): void {
    throw new Error('Method not implemented.');
  }
  showCursor(): void {
    throw new Error('Method not implemented.');
  }
  refresh(start: number, end: number): void {
    throw new Error('Method not implemented.');
  }
  matchColor(r1: number, g1: number, b1: number): number {
    throw new Error('Method not implemented.');
  }
  error(text: string, data?: any): void {
    throw new Error('Method not implemented.');
  }
  setOption(key: string, value: any): void {
    (<any>this.options)[key] = value;
  }
  on(type: string, listener: XtermListener): void {
    throw new Error('Method not implemented.');
  }
  off(type: string, listener: XtermListener): void {
    throw new Error('Method not implemented.');
  }
  emit(type: string, data?: any): void {
    throw new Error('Method not implemented.');
  }
  addDisposableListener(type: string, handler: XtermListener): IDisposable {
    throw new Error('Method not implemented.');
  }
  handler(data: string): void {
    throw new Error('Method not implemented.');
  }
  handleTitle(title: string): void {
    throw new Error('Method not implemented.');
  }
}

export class MockBuffer implements IBuffer {
  markers: IMarker[];
  addMarker(y: number): IMarker {
    throw new Error('Method not implemented.');
  }
  isCursorInViewport: boolean;
  lines: ICircularList<IBufferLine>;
  ydisp: number;
  ybase: number;
  hasScrollback: boolean;
  y: number;
  x: number;
  tabs: any;
  scrollBottom: number;
  scrollTop: number;
  savedY: number;
  savedX: number;
  savedCharset: ICharset | null;
  savedCurAttrData = new AttributeData();
  translateBufferLineToString(lineIndex: number, trimRight: boolean, startCol?: number, endCol?: number): string {
    return Buffer.prototype.translateBufferLineToString.apply(this, arguments);
  }
  getWrappedRangeForLine(y: number): { first: number; last: number; } {
    return Buffer.prototype.getWrappedRangeForLine.apply(this, arguments);
  }
  nextStop(x?: number): number {
    throw new Error('Method not implemented.');
  }
  prevStop(x?: number): number {
    throw new Error('Method not implemented.');
  }
  setLines(lines: ICircularList<IBufferLine>): void {
    this.lines = lines;
  }
  getBlankLine(attr: IAttributeData, isWrapped?: boolean): IBufferLine {
    return Buffer.prototype.getBlankLine.apply(this, arguments);
  }
  stringIndexToBufferIndex(lineIndex: number, stringIndex: number): number[] {
    return Buffer.prototype.stringIndexToBufferIndex.apply(this, arguments);
  }
  iterator(trimRight: boolean, startIndex?: number, endIndex?: number): IBufferStringIterator {
    return Buffer.prototype.iterator.apply(this, arguments);
  }
  getNullCell(attr?: IAttributeData): ICellData {
    throw new Error('Method not implemented.');
  }
  getWhitespaceCell(attr?: IAttributeData): ICellData {
    throw new Error('Method not implemented.');
  }
}

export class MockRenderer implements IRenderer {
  onCanvasResize: IEvent<{ width: number; height: number; }>;
  onRender: IEvent<{ start: number; end: number; }>;
  dispose(): void {
    throw new Error('Method not implemented.');
  }
  colorManager: IColorManager;
  on(type: string, listener: XtermListener): void {
    throw new Error('Method not implemented.');
  }
  off(type: string, listener: XtermListener): void {
    throw new Error('Method not implemented.');
  }
  emit(type: string, data?: any): void {
    throw new Error('Method not implemented.');
  }
  addDisposableListener(type: string, handler: XtermListener): IDisposable {
    throw new Error('Method not implemented.');
  }
  dimensions: IRenderDimensions;
  setColors(colors: IColorSet): void {
    throw new Error('Method not implemented.');
  }
  onResize(cols: number, rows: number): void {}
  onCharSizeChanged(): void {}
  onBlur(): void {}
  onFocus(): void {}
  onSelectionChanged(start: [number, number], end: [number, number]): void {}
  onCursorMove(): void {}
  onOptionsChanged(): void {}
  onDevicePixelRatioChange(): void {}
  clear(): void {}
  renderRows(start: number, end: number): void {}
  registerCharacterJoiner(handler: CharacterJoinerHandler): number { return 0; }
  deregisterCharacterJoiner(): boolean { return true; }
}

export class MockViewport implements IViewport {
  dispose(): void {
    throw new Error('Method not implemented.');
  }
  scrollBarWidth: number = 0;
  onThemeChange(colors: IColorSet): void {
    throw new Error('Method not implemented.');
  }
  onWheel(ev: WheelEvent): void {
    throw new Error('Method not implemented.');
  }
  onTouchStart(ev: TouchEvent): void {
    throw new Error('Method not implemented.');
  }
  onTouchMove(ev: TouchEvent): void {
    throw new Error('Method not implemented.');
  }
  syncScrollArea(): void { }
  getLinesScrolled(ev: WheelEvent): number {
    throw new Error('Method not implemented.');
  }
}

export class MockCompositionHelper implements ICompositionHelper {
  compositionstart(): void {
    throw new Error('Method not implemented.');
  }
  compositionupdate(ev: CompositionEvent): void {
    throw new Error('Method not implemented.');
  }
  compositionend(): void {
    throw new Error('Method not implemented.');
  }
  updateCompositionElements(dontRecurse?: boolean): void {
    throw new Error('Method not implemented.');
  }
  keydown(ev: KeyboardEvent): boolean {
    return true;
  }
}
