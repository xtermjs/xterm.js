/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ILinkMatcherOptions } from './Interfaces';
import { LinkMatcherHandler, LinkMatcherValidationCallback, Charset, LineData } from './Types';
import { IColorSet, IRenderer } from './renderer/Interfaces';
import { IMouseZoneManager } from './input/Interfaces';

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

export interface IBufferAccessor {
  buffer: IBuffer;
}

export interface IElementAccessor {
  element: HTMLElement;
}

export interface ILinkifierAccessor {
  linkifier: ILinkifier;
}

export interface ITerminal extends ILinkifierAccessor, IBufferAccessor, IElementAccessor, IEventEmitter {
  selectionManager: ISelectionManager;
  charMeasure: ICharMeasure;
  textarea: HTMLTextAreaElement;
  renderer: IRenderer;
  rows: number;
  cols: number;
  browser: IBrowser;
  writeBuffer: string[];
  cursorHidden: boolean;
  cursorState: number;
  defAttr: number;
  options: ITerminalOptions;
  buffers: IBufferSet;
  isFocused: boolean;
  mouseHelper: IMouseHelper;

  /**
   * Emit the 'data' event and populate the given data.
   * @param data The data to populate in the event.
   */
  handler(data: string): void;
  scrollDisp(disp: number, suppressScrollEvent?: boolean): void;
  cancel(ev: Event, force?: boolean): boolean | void;
  log(text: string): void;
  reset(): void;
  showCursor(): void;
  blankLine(cur?: boolean, isWrapped?: boolean, cols?: number): LineData;
  refresh(start: number, end: number): void;
}

/**
 * This interface encapsulates everything needed from the Terminal by the
 * InputHandler. This cleanly separates the large amount of methods needed by
 * InputHandler cleanly from the ITerminal interface.
 */
export interface IInputHandlingTerminal extends IEventEmitter {
  element: HTMLElement;
  options: ITerminalOptions;
  cols: number;
  rows: number;
  charset: Charset;
  gcharset: number;
  glevel: number;
  charsets: Charset[];
  applicationKeypad: boolean;
  applicationCursor: boolean;
  originMode: boolean;
  insertMode: boolean;
  wraparoundMode: boolean;
  defAttr: number;
  curAttr: number;
  prefix: string;
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
  buffer: IBuffer;
  viewport: IViewport;
  selectionManager: ISelectionManager;

  bell(): void;
  focus(): void;
  convertEol: boolean;
  updateRange(y: number): void;
  scroll(isWrapped?: boolean): void;
  setgLevel(g: number): void;
  eraseAttr(): number;
  eraseRight(x: number, y: number): void;
  eraseLine(y: number): void;
  eraseLeft(x: number, y: number): void;
  blankLine(cur?: boolean, isWrapped?: boolean): LineData;
  is(term: string): boolean;
  send(data: string): void;
  setgCharset(g: number, charset: Charset): void;
  resize(x: number, y: number): void;
  log(text: string, data?: any): void;
  reset(): void;
  showCursor(): void;
  refresh(start: number, end: number): void;
  matchColor(r1: number, g1: number, b1: number): number;
  error(text: string, data?: any): void;
  setOption(key: string, value: any): void;
}

export interface ITerminalOptions {
  bellSound?: string;
  bellStyle?: string;
  cancelEvents?: boolean;
  cols?: number;
  convertEol?: boolean;
  cursorBlink?: boolean;
  cursorStyle?: string;
  debug?: boolean;
  disableStdin?: boolean;
  enableBold?: boolean;
  fontSize?: number;
  fontFamily?: string;
  geometry?: [number, number];
  handler?: (data: string) => void;
  letterSpacing?: number;
  lineHeight?: number;
  rows?: number;
  screenKeys?: boolean;
  scrollback?: number;
  tabStopWidth?: number;
  termName?: string;
  theme?: ITheme;
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

export interface IMouseHelper {
  getCoords(event: {pageX: number, pageY: number}, element: HTMLElement, charMeasure: ICharMeasure, lineHeight: number, colCount: number, rowCount: number, isSelection?: boolean): [number, number];
  getRawByteCoords(event: MouseEvent, element: HTMLElement, charMeasure: ICharMeasure, lineHeight: number, colCount: number, rowCount: number): { x: number, y: number };
}

export interface IViewport {
  syncScrollArea(): void;
  onWheel(ev: WheelEvent): void;
  onTouchStart(ev: TouchEvent): void;
  onTouchMove(ev: TouchEvent): void;
  onThemeChanged(colors: IColorSet): void;
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

export interface ICompositionHelper {
  compositionstart(): void;
  compositionupdate(ev: CompositionEvent): void;
  compositionend(): void;
  updateCompositionElements(dontRecurse?: boolean): void;
  keydown(ev: KeyboardEvent): boolean;
}

export interface ICharMeasure {
  width: number;
  height: number;
  measure(options: ITerminalOptions): void;
}

export interface ILinkifier extends IEventEmitter {
  attachToDom(mouseZoneManager: IMouseZoneManager): void;
  linkifyRows(start: number, end: number): void;
  setHypertextLinkHandler(handler: LinkMatcherHandler): void;
  setHypertextValidationCallback(callback: LinkMatcherValidationCallback): void;
  registerLinkMatcher(regex: RegExp, handler: LinkMatcherHandler, options?: ILinkMatcherOptions): number;
  deregisterLinkMatcher(matcherId: number): boolean;
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

export interface IEventEmitter {
  on(type: string, listener: IListenerType): void;
  off(type: string, listener: IListenerType): void;
  emit(type: string, data?: any): void;
}

export interface IListenerType {
    (data?: any): void;
    listener?: (data?: any) => void;
};

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

/**
 * Handles actions generated by the parser.
 */
export interface IInputHandler {
  addChar(char: string, code: number): void;

  /** C0 BEL */ bell(): void;
  /** C0 LF */ lineFeed(): void;
  /** C0 CR */ carriageReturn(): void;
  /** C0 BS */ backspace(): void;
  /** C0 HT */ tab(): void;
  /** C0 SO */ shiftOut(): void;
  /** C0 SI */ shiftIn(): void;

  /** CSI @ */ insertChars(params?: number[]): void;
  /** CSI A */ cursorUp(params?: number[]): void;
  /** CSI B */ cursorDown(params?: number[]): void;
  /** CSI C */ cursorForward(params?: number[]): void;
  /** CSI D */ cursorBackward(params?: number[]): void;
  /** CSI E */ cursorNextLine(params?: number[]): void;
  /** CSI F */ cursorPrecedingLine(params?: number[]): void;
  /** CSI G */ cursorCharAbsolute(params?: number[]): void;
  /** CSI H */ cursorPosition(params?: number[]): void;
  /** CSI I */ cursorForwardTab(params?: number[]): void;
  /** CSI J */ eraseInDisplay(params?: number[]): void;
  /** CSI K */ eraseInLine(params?: number[]): void;
  /** CSI L */ insertLines(params?: number[]): void;
  /** CSI M */ deleteLines(params?: number[]): void;
  /** CSI P */ deleteChars(params?: number[]): void;
  /** CSI S */ scrollUp(params?: number[]): void;
  /** CSI T */ scrollDown(params?: number[]): void;
  /** CSI X */ eraseChars(params?: number[]): void;
  /** CSI Z */ cursorBackwardTab(params?: number[]): void;
  /** CSI ` */ charPosAbsolute(params?: number[]): void;
  /** CSI a */ HPositionRelative(params?: number[]): void;
  /** CSI b */ repeatPrecedingCharacter(params?: number[]): void;
  /** CSI c */ sendDeviceAttributes(params?: number[]): void;
  /** CSI d */ linePosAbsolute(params?: number[]): void;
  /** CSI e */ VPositionRelative(params?: number[]): void;
  /** CSI f */ HVPosition(params?: number[]): void;
  /** CSI g */ tabClear(params?: number[]): void;
  /** CSI h */ setMode(params?: number[]): void;
  /** CSI l */ resetMode(params?: number[]): void;
  /** CSI m */ charAttributes(params?: number[]): void;
  /** CSI n */ deviceStatus(params?: number[]): void;
  /** CSI p */ softReset(params?: number[]): void;
  /** CSI q */ setCursorStyle(params?: number[]): void;
  /** CSI r */ setScrollRegion(params?: number[]): void;
  /** CSI s */ saveCursor(params?: number[]): void;
  /** CSI u */ restoreCursor(params?: number[]): void;
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
