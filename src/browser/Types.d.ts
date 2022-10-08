/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDecorationOptions, IDecoration, IDisposable, IMarker } from 'xterm';
import { IEvent } from 'common/EventEmitter';
import { ICoreTerminal, CharData, ITerminalOptions, IColor } from 'common/Types';
import { IMouseService, IRenderService } from './services/Services';
import { IBuffer } from 'common/buffer/Types';
import { IFunctionIdentifier, IParams } from 'common/parser/Types';

export interface ITerminal extends IPublicTerminal, ICoreTerminal {
  element: HTMLElement | undefined;
  screenElement: HTMLElement | undefined;
  browser: IBrowser;
  buffer: IBuffer;
  viewport: IViewport | undefined;
  options: Required<ITerminalOptions>;
  linkifier2: ILinkifier2;

  onBlur: IEvent<void>;
  onFocus: IEvent<void>;
  onA11yChar: IEvent<string>;
  onA11yTab: IEvent<number>;
  onWillOpen: IEvent<HTMLElement>;

  cancel(ev: Event, force?: boolean): boolean | void;
}

// Portions of the public API that are required by the internal Terminal
export interface IPublicTerminal extends IDisposable {
  textarea: HTMLTextAreaElement | undefined;
  rows: number;
  cols: number;
  buffer: IBuffer;
  markers: IMarker[];
  onCursorMove: IEvent<void>;
  onData: IEvent<string>;
  onBinary: IEvent<string>;
  onKey: IEvent<{ key: string, domEvent: KeyboardEvent }>;
  onLineFeed: IEvent<void>;
  onScroll: IEvent<number>;
  onSelectionChange: IEvent<void>;
  onRender: IEvent<{ start: number, end: number }>;
  onResize: IEvent<{ cols: number, rows: number }>;
  onWriteParsed: IEvent<void>;
  onTitleChange: IEvent<string>;
  onBell: IEvent<void>;
  blur(): void;
  focus(): void;
  resize(columns: number, rows: number): void;
  open(parent: HTMLElement): void;
  attachCustomKeyEventHandler(customKeyEventHandler: (event: KeyboardEvent) => boolean): void;
  registerCsiHandler(id: IFunctionIdentifier, callback: (params: IParams) => boolean | Promise<boolean>): IDisposable;
  registerDcsHandler(id: IFunctionIdentifier, callback: (data: string, param: IParams) => boolean | Promise<boolean>): IDisposable;
  registerEscHandler(id: IFunctionIdentifier, callback: () => boolean | Promise<boolean>): IDisposable;
  registerOscHandler(ident: number, callback: (data: string) => boolean | Promise<boolean>): IDisposable;
  registerLinkProvider(linkProvider: ILinkProvider): IDisposable;
  registerCharacterJoiner(handler: (text: string) => [number, number][]): number;
  deregisterCharacterJoiner(joinerId: number): void;
  addMarker(cursorYOffset: number): IMarker | undefined;
  registerDecoration(decorationOptions: IDecorationOptions): IDecoration | undefined;
  hasSelection(): boolean;
  getSelection(): string;
  getSelectionPosition(): IBufferRange | undefined;
  clearSelection(): void;
  select(column: number, row: number, length: number): void;
  selectAll(): void;
  selectLines(start: number, end: number): void;
  dispose(): void;
  scrollLines(amount: number): void;
  scrollPages(pageCount: number): void;
  scrollToTop(): void;
  scrollToBottom(): void;
  scrollToLine(line: number): void;
  clear(): void;
  write(data: string | Uint8Array, callback?: () => void): void;
  paste(data: string): void;
  refresh(start: number, end: number): void;
  clearTextureAtlas(): void;
  reset(): void;
}

export type CustomKeyEventHandler = (event: KeyboardEvent) => boolean;

export type LineData = CharData[];

export interface ICompositionHelper {
  readonly isComposing: boolean;
  compositionstart(): void;
  compositionupdate(ev: CompositionEvent): void;
  compositionend(): void;
  updateCompositionElements(dontRecurse?: boolean): void;
  keydown(ev: KeyboardEvent): boolean;
}

export interface IBrowser {
  isNode: boolean;
  userAgent: string;
  platform: string;
  isFirefox: boolean;
  isMac: boolean;
  isIpad: boolean;
  isIphone: boolean;
  isWindows: boolean;
}

export interface IColorSet {
  foreground: IColor;
  background: IColor;
  cursor: IColor;
  cursorAccent: IColor;
  selectionForeground: IColor | undefined;
  selectionBackgroundTransparent: IColor;
  /** The selection blended on top of background. */
  selectionBackgroundOpaque: IColor;
  selectionInactiveBackgroundTransparent: IColor;
  selectionInactiveBackgroundOpaque: IColor;
  ansi: IColor[];
  contrastCache: IColorContrastCache;
}

export type ReadonlyColorSet = Readonly<Omit<IColorSet, 'ansi'>> & { ansi: Readonly<Pick<IColorSet, 'ansi'>['ansi']> };

export interface IColorContrastCache {
  clear(): void;
  setCss(bg: number, fg: number, value: string | null): void;
  getCss(bg: number, fg: number): string | null | undefined;
  setColor(bg: number, fg: number, value: IColor | null): void;
  getColor(bg: number, fg: number): IColor | null | undefined;
}

export interface IPartialColorSet {
  foreground: IColor;
  background: IColor;
  cursor?: IColor;
  cursorAccent?: IColor;
  selectionBackground?: IColor;
  ansi: IColor[];
}

export interface IViewport extends IDisposable {
  scrollBarWidth: number;
  syncScrollArea(immediate?: boolean): void;
  getLinesScrolled(ev: WheelEvent): number;
  handleWheel(ev: WheelEvent): boolean;
  handleTouchStart(ev: TouchEvent): void;
  handleTouchMove(ev: TouchEvent): boolean;
}

export interface ILinkifierEvent {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cols: number;
  fg: number | undefined;
}

interface ILinkState {
  decorations: ILinkDecorations;
  isHovered: boolean;
}
export interface ILinkWithState {
  link: ILink;
  state?: ILinkState;
}

export interface ILinkifier2 extends IDisposable {
  onShowLinkUnderline: IEvent<ILinkifierEvent>;
  onHideLinkUnderline: IEvent<ILinkifierEvent>;
  readonly currentLink: ILinkWithState | undefined;

  attachToDom(element: HTMLElement, mouseService: IMouseService, renderService: IRenderService): void;
  registerLinkProvider(linkProvider: ILinkProvider): IDisposable;
}

interface ILinkProvider {
  provideLinks(y: number, callback: (links: ILink[] | undefined) => void): void;
}

interface ILink {
  range: IBufferRange;
  text: string;
  decorations?: ILinkDecorations;
  activate(event: MouseEvent, text: string): void;
  hover?(event: MouseEvent, text: string): void;
  leave?(event: MouseEvent, text: string): void;
  dispose?(): void;
}

interface ILinkDecorations {
  pointerCursor: boolean;
  underline: boolean;
}

interface IBufferRange {
  start: IBufferCellPosition;
  end: IBufferCellPosition;
}

interface IBufferCellPosition {
  x: number;
  y: number;
}

export type CharacterJoinerHandler = (text: string) => [number, number][];

export interface ICharacterJoiner {
  id: number;
  handler: CharacterJoinerHandler;
}

export interface IRenderDebouncer extends IDisposable {
  refresh(rowStart: number | undefined, rowEnd: number | undefined, rowCount: number): void;
}

export interface IRenderDebouncerWithCallback extends IRenderDebouncer {
  addRefreshCallback(callback: FrameRequestCallback): number;
}
