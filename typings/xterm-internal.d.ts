/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/// <reference path="./xterm.d.ts"/>

import { Terminal as PublicTerminal, ITerminalOptions as IPublicTerminalOptions, IEventEmitter } from 'xterm';

export type CharData = [number, string, number, number];
export type LineData = CharData[];

export type LinkMatcherHandler = (event: MouseEvent, uri: string) => boolean | void;
export type LinkMatcherValidationCallback = (uri: string, callback: (isValid: boolean) => void) => void;

export interface ITerminal extends PublicTerminal, IElementAccessor, IBufferAccessor, ILinkifierAccessor {
  selectionManager: ISelectionManager;
  charMeasure: ICharMeasure;
  renderer: IRenderer;
  browser: IBrowser;
  writeBuffer: string[];
  cursorHidden: boolean;
  cursorState: number;
  defAttr: number;
  options: ITerminalOptions;
  buffer: IBuffer;
  buffers: IBufferSet;
  isFocused: boolean;
  mouseHelper: IMouseHelper;
  bracketedPasteMode: boolean;

  /**
   * Emit the 'data' event and populate the given data.
   * @param data The data to populate in the event.
   */
  handler(data: string): void;
  scrollLines(disp: number, suppressScrollEvent?: boolean): void;
  cancel(ev: Event, force?: boolean): boolean | void;
  log(text: string): void;
  showCursor(): void;
  blankLine(cur?: boolean, isWrapped?: boolean, cols?: number): LineData;
}

export interface IBufferAccessor {
  buffer: IBuffer;
}

export interface IElementAccessor {
  element: HTMLElement;
}

export interface ILinkifierAccessor {
  linkifier: ILinkifier;
}

export interface IMouseHelper {
  getCoords(event: {pageX: number, pageY: number}, element: HTMLElement, charMeasure: ICharMeasure, lineHeight: number, colCount: number, rowCount: number, isSelection?: boolean): [number, number];
  getRawByteCoords(event: MouseEvent, element: HTMLElement, charMeasure: ICharMeasure, lineHeight: number, colCount: number, rowCount: number): { x: number, y: number };
}

export interface ICharMeasure {
  width: number;
  height: number;
  measure(options: ITerminalOptions): void;
}

// TODO: The options that are not in the public API should be reviewed
export interface ITerminalOptions extends IPublicTerminalOptions {
  cancelEvents?: boolean;
  convertEol?: boolean;
  debug?: boolean;
  handler?: (data: string) => void;
  screenKeys?: boolean;
  termName?: string;
  useFlowControl?: boolean;
}

export interface IBuffer {
  lines: ICircularList<LineData>;
  ydisp: number;
  ybase: number;
  y: number;
  x: number;
  tabs: any;
  scrollBottom: number;
  scrollTop: number;
  savedY: number;
  savedX: number;
  isCursorInViewport: boolean;
  translateBufferLineToString(lineIndex: number, trimRight: boolean, startCol?: number, endCol?: number): string;
  nextStop(x?: number): number;
  prevStop(x?: number): number;
}

export interface IBufferSet {
  alt: IBuffer;
  normal: IBuffer;
  active: IBuffer;

  activateNormalBuffer(): void;
  activateAltBuffer(): void;
}

export interface ICircularList<T> extends IEventEmitter {
  length: number;
  maxLength: number;
  forEach: (callbackfn: (value: T, index: number) => void) => void;

  get(index: number): T;
  set(index: number, value: T): void;
  push(value: T): void;
  pop(): T;
  splice(start: number, deleteCount: number, ...items: T[]): void;
  trimStart(count: number): void;
  shiftElements(start: number, count: number, offset: number): void;
}

export interface ISelectionManager {
  selectionText: string;
  selectionStart: [number, number];
  selectionEnd: [number, number];

  disable(): void;
  enable(): void;
  setBuffer(buffer: IBuffer): void;
  setSelection(row: number, col: number, length: number): void;
}

export interface ILinkifier extends IEventEmitter {
  attachToDom(mouseZoneManager: IMouseZoneManager): void;
  linkifyRows(start: number, end: number): void;
  setHypertextLinkHandler(handler: LinkMatcherHandler): void;
  setHypertextValidationCallback(callback: LinkMatcherValidationCallback): void;
  registerLinkMatcher(regex: RegExp, handler: LinkMatcherHandler, options?: ILinkMatcherOptions): number;
  deregisterLinkMatcher(matcherId: number): boolean;
}

export interface ILinkMatcherOptions {
  /**
   * The index of the link from the regex.match(text) call. This defaults to 0
   * (for regular expressions without capture groups).
   */
  matchIndex?: number;
  /**
   * A callback that validates an individual link, returning true if valid and
   * false if invalid.
   */
  validationCallback?: LinkMatcherValidationCallback;
  /**
   * A callback that fires when the mouse hovers over a link.
   */
  tooltipCallback?: LinkMatcherHandler;
  /**
   * A callback that fires when the mouse leaves a link that was hovered.
   */
  leaveCallback?: () => void;
  /**
   * The priority of the link matcher, this defines the order in which the link
   * matcher is evaluated relative to others, from highest to lowest. The
   * default value is 0.
   */
  priority?: number;
}

export interface IBrowser {
  isNode: boolean;
  userAgent: string;
  platform: string;
  isFirefox: boolean;
  isMSIE: boolean;
  isMac: boolean;
  isIpad: boolean;
  isIphone: boolean;
  isMSWindows: boolean;
}

export interface IMouseZoneManager {
  add(zone: IMouseZone): void;
  clearAll(start?: number, end?: number): void;
}

export interface IMouseZone {
  x1: number;
  x2: number;
  y: number;
  clickCallback: (e: MouseEvent) => any;
  hoverCallback?: (e: MouseEvent) => any;
  tooltipCallback?: (e: MouseEvent) => any;
  leaveCallback?: () => any;
}

export interface IRenderer extends IEventEmitter {
  dimensions: IRenderDimensions;
  colorManager: IColorManager;

  setTheme(theme: ITheme): IColorSet;
  onWindowResize(devicePixelRatio: number): void;
  onResize(cols: number, rows: number, didCharSizeChange: boolean): void;
  onCharSizeChanged(): void;
  onBlur(): void;
  onFocus(): void;
  onSelectionChanged(start: [number, number], end: [number, number]): void;
  onCursorMove(): void;
  onOptionsChanged(): void;
  clear(): void;
  queueRefresh(start: number, end: number): void;
}

export interface IColorManager {
  colors: IColorSet;
}

export interface IColorSet {
  foreground: string;
  background: string;
  cursor: string;
  cursorAccent: string;
  selection: string;
  ansi: string[];
}

export interface IRenderDimensions {
  scaledCharWidth: number;
  scaledCharHeight: number;
  scaledCellWidth: number;
  scaledCellHeight: number;
  scaledCharLeft: number;
  scaledCharTop: number;
  scaledCanvasWidth: number;
  scaledCanvasHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  actualCellWidth: number;
  actualCellHeight: number;
}

export interface ITheme {
  foreground?: string;
  background?: string;
  cursor?: string;
  cursorAccent?: string;
  selection?: string;
  black?: string;
  red?: string;
  green?: string;
  yellow?: string;
  blue?: string;
  magenta?: string;
  cyan?: string;
  white?: string;
  brightBlack?: string;
  brightRed?: string;
  brightGreen?: string;
  brightYellow?: string;
  brightBlue?: string;
  brightMagenta?: string;
  brightCyan?: string;
  brightWhite?: string;
}
