/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable, IMarker, ISelectionPosition, ILinkProvider } from 'xterm';
import { IAttributeData, CharData, ITerminalOptions } from 'common/Types';
import { IEvent } from 'common/EventEmitter';
import { ILinkifier, ILinkMatcherOptions, IViewport, ILinkifier2 } from 'browser/Types';
import { IOptionsService, IUnicodeService } from 'common/services/Services';
import { IBuffer, IBufferSet } from 'common/buffer/Types';
import { IParams, IFunctionIdentifier } from 'common/parser/Types';

export type CustomKeyEventHandler = (event: KeyboardEvent) => boolean;

export type LineData = CharData[];

export interface ICompositionHelper {
  compositionstart(): void;
  compositionupdate(ev: CompositionEvent): void;
  compositionend(): void;
  updateCompositionElements(dontRecurse?: boolean): void;
  keydown(ev: KeyboardEvent): boolean;
}

export interface ITerminal extends IPublicTerminal, IElementAccessor, IBufferAccessor, ILinkifierAccessor {
  screenElement: HTMLElement;
  browser: IBrowser;
  buffer: IBuffer;
  buffers: IBufferSet;
  viewport: IViewport;
  optionsService: IOptionsService;
  // TODO: We should remove options once components adopt optionsService
  options: ITerminalOptions;
  unicodeService: IUnicodeService;

  onBlur: IEvent<void>;
  onFocus: IEvent<void>;
  onA11yChar: IEvent<string>;
  onA11yTab: IEvent<number>;

  scrollLines(disp: number, suppressScrollEvent?: boolean): void;
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
  onTitleChange: IEvent<string>;
  blur(): void;
  focus(): void;
  resize(columns: number, rows: number): void;
  open(parent: HTMLElement): void;
  attachCustomKeyEventHandler(customKeyEventHandler: (event: KeyboardEvent) => boolean): void;
  addCsiHandler(id: IFunctionIdentifier, callback: (params: IParams) => boolean): IDisposable;
  addDcsHandler(id: IFunctionIdentifier, callback: (data: string, param: IParams) => boolean): IDisposable;
  addEscHandler(id: IFunctionIdentifier, callback: () => boolean): IDisposable;
  addOscHandler(ident: number, callback: (data: string) => boolean): IDisposable;
  registerLinkMatcher(regex: RegExp, handler: (event: MouseEvent, uri: string) => void, options?: ILinkMatcherOptions): number;
  deregisterLinkMatcher(matcherId: number): void;
  registerLinkProvider(linkProvider: ILinkProvider): IDisposable;
  registerCharacterJoiner(handler: (text: string) => [number, number][]): number;
  deregisterCharacterJoiner(joinerId: number): void;
  addMarker(cursorYOffset: number): IMarker;
  hasSelection(): boolean;
  getSelection(): string;
  getSelectionPosition(): ISelectionPosition | undefined;
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
  reset(): void;
}

export interface IBufferAccessor {
  buffer: IBuffer;
}

export interface IElementAccessor {
  readonly element: HTMLElement | undefined;
}

export interface ILinkifierAccessor {
  linkifier: ILinkifier;
  linkifier2: ILinkifier2;
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
