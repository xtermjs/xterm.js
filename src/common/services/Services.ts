/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IEvent } from 'common/EventEmitter';
import { IBuffer, IBufferSet } from 'common/buffer/Types';
import { IDecPrivateModes, ICoreMouseEvent, CoreMouseEncoding, ICoreMouseProtocol, CoreMouseEventType, ICharset, IWindowOptions, IModes, IAttributeData, ScrollSource } from 'common/Types';
import { createDecorator } from 'common/services/ServiceRegistry';

export const IBufferService = createDecorator<IBufferService>('BufferService');
export interface IBufferService {
  serviceBrand: undefined;

  readonly cols: number;
  readonly rows: number;
  readonly buffer: IBuffer;
  readonly buffers: IBufferSet;
  isUserScrolling: boolean;
  onResize: IEvent<{ cols: number, rows: number }>;
  onScroll: IEvent<number>;
  scroll(eraseAttr: IAttributeData, isWrapped?: boolean): void;
  scrollToBottom(): void;
  scrollToTop(): void;
  scrollToLine(line: number): void;
  scrollLines(disp: number, suppressScrollEvent?: boolean, source?: ScrollSource): void;
  scrollPages(pageCount: number): void;
  resize(cols: number, rows: number): void;
  reset(): void;
}

export const ICoreMouseService = createDecorator<ICoreMouseService>('CoreMouseService');
export interface ICoreMouseService {
  activeProtocol: string;
  activeEncoding: string;
  areMouseEventsActive: boolean;
  addProtocol(name: string, protocol: ICoreMouseProtocol): void;
  addEncoding(name: string, encoding: CoreMouseEncoding): void;
  reset(): void;

  /**
   * Triggers a mouse event to be sent.
   *
   * Returns true if the event passed all protocol restrictions and a report
   * was sent, otherwise false. The return value may be used to decide whether
   * the default event action in the bowser component should be omitted.
   *
   * Note: The method will change values of the given event object
   * to fullfill protocol and encoding restrictions.
   */
  triggerMouseEvent(event: ICoreMouseEvent): boolean;

  /**
   * Event to announce changes in mouse tracking.
   */
  onProtocolChange: IEvent<CoreMouseEventType>;

  /**
   * Human readable version of mouse events.
   */
  explainEvents(events: CoreMouseEventType): { [event: string]: boolean };
}

export const ICoreService = createDecorator<ICoreService>('CoreService');
export interface ICoreService {
  serviceBrand: undefined;

  /**
   * Initially the cursor will not be visible until the first time the terminal
   * is focused.
   */
  isCursorInitialized: boolean;
  isCursorHidden: boolean;

  readonly modes: IModes;
  readonly decPrivateModes: IDecPrivateModes;

  readonly onData: IEvent<string>;
  readonly onUserInput: IEvent<void>;
  readonly onBinary: IEvent<string>;

  reset(): void;

  /**
   * Triggers the onData event in the public API.
   * @param data The data that is being emitted.
   * @param wasFromUser Whether the data originated from the user (as opposed to
   * resulting from parsing incoming data). When true this will also:
   * - Scroll to the bottom of the buffer.s
   * - Fire the `onUserInput` event (so selection can be cleared).
   */
  triggerDataEvent(data: string, wasUserInput?: boolean): void;

  /**
   * Triggers the onBinary event in the public API.
   * @param data The data that is being emitted.
   */
  triggerBinaryEvent(data: string): void;
}

export const ICharsetService = createDecorator<ICharsetService>('CharsetService');
export interface ICharsetService {
  serviceBrand: undefined;

  charset: ICharset | undefined;
  readonly glevel: number;

  reset(): void;

  /**
   * Set the G level of the terminal.
   * @param g
   */
  setgLevel(g: number): void;

  /**
   * Set the charset for the given G level of the terminal.
   * @param g
   * @param charset
   */
  setgCharset(g: number, charset: ICharset | undefined): void;
}

export const IDirtyRowService = createDecorator<IDirtyRowService>('DirtyRowService');
export interface IDirtyRowService {
  serviceBrand: undefined;

  readonly start: number;
  readonly end: number;

  clearRange(): void;
  markDirty(y: number): void;
  markRangeDirty(y1: number, y2: number): void;
  markAllDirty(): void;
}

export interface IServiceIdentifier<T> {
  (...args: any[]): void;
  type: T;
}

export interface IBrandedService {
  serviceBrand: undefined;
}

type GetLeadingNonServiceArgs<Args> =
  Args extends [...IBrandedService[]] ? []
    : Args extends [infer A1, ...IBrandedService[]] ? [A1]
      : Args extends [infer A1, infer A2, ...IBrandedService[]] ? [A1, A2]
        : Args extends [infer A1, infer A2, infer A3, ...IBrandedService[]] ? [A1, A2, A3]
          : Args extends [infer A1, infer A2, infer A3, infer A4, ...IBrandedService[]] ? [A1, A2, A3, A4]
            : Args extends [infer A1, infer A2, infer A3, infer A4, infer A5, ...IBrandedService[]] ? [A1, A2, A3, A4, A5]
              : Args extends [infer A1, infer A2, infer A3, infer A4, infer A5, infer A6, ...IBrandedService[]] ? [A1, A2, A3, A4, A5, A6]
                : Args extends [infer A1, infer A2, infer A3, infer A4, infer A5, infer A6, infer A7, ...IBrandedService[]] ? [A1, A2, A3, A4, A5, A6, A7]
                  : Args extends [infer A1, infer A2, infer A3, infer A4, infer A5, infer A6, infer A7, infer A8, ...IBrandedService[]] ? [A1, A2, A3, A4, A5, A6, A7, A8]
                    : never;

export const IInstantiationService = createDecorator<IInstantiationService>('InstantiationService');
export interface IInstantiationService {
  serviceBrand: undefined;

  setService<T>(id: IServiceIdentifier<T>, instance: T): void;
  getService<T>(id: IServiceIdentifier<T>): T | undefined;
  createInstance<Ctor extends new (...args: any[]) => any, R extends InstanceType<Ctor>>(t: Ctor, ...args: GetLeadingNonServiceArgs<ConstructorParameters<Ctor>>): R;
}

export const ILogService = createDecorator<ILogService>('LogService');
export interface ILogService {
  serviceBrand: undefined;

  logLevel: LogLevelEnum;

  debug(message: any, ...optionalParams: any[]): void;
  info(message: any, ...optionalParams: any[]): void;
  warn(message: any, ...optionalParams: any[]): void;
  error(message: any, ...optionalParams: any[]): void;
}

export const IOptionsService = createDecorator<IOptionsService>('OptionsService');
export interface IOptionsService {
  serviceBrand: undefined;

  readonly options: ITerminalOptions;

  readonly onOptionChange: IEvent<string>;

  setOption<T>(key: string, value: T): void;
  getOption<T>(key: string): T | undefined;
}

export type FontWeight = 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | number;
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'off';
export enum LogLevelEnum {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  OFF = 4
}
export type RendererType = 'dom' | 'canvas';

export interface IPartialTerminalOptions {
  altClickMovesCursor?: boolean;
  allowTransparency?: boolean;
  bellSound?: string;
  bellStyle?: 'none' | 'sound' /* | 'visual' | 'both' */;
  cols?: number;
  cursorBlink?: boolean;
  cursorStyle?: 'block' | 'underline' | 'bar';
  cursorWidth?: number;
  disableStdin?: boolean;
  drawBoldTextInBrightColors?: boolean;
  fastScrollModifier?: 'alt' | 'ctrl' | 'shift';
  fastScrollSensitivity?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: FontWeight;
  fontWeightBold?: FontWeight;
  letterSpacing?: number;
  lineHeight?: number;
  logLevel?: LogLevel;
  macOptionIsMeta?: boolean;
  macOptionClickForcesSelection?: boolean;
  rendererType?: RendererType;
  rightClickSelectsWord?: boolean;
  rows?: number;
  screenReaderMode?: boolean;
  scrollback?: number;
  scrollSensitivity?: number;
  tabStopWidth?: number;
  theme?: ITheme;
  windowsMode?: boolean;
  wordSeparator?: string;
  windowOptions?: IWindowOptions;
}

export interface ITerminalOptions {
  allowProposedApi: boolean;
  allowTransparency: boolean;
  altClickMovesCursor: boolean;
  bellSound: string;
  bellStyle: 'none' | 'sound' /* | 'visual' | 'both' */;
  cols: number;
  cursorBlink: boolean;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorWidth: number;
  disableStdin: boolean;
  drawBoldTextInBrightColors: boolean;
  fastScrollModifier: 'alt' | 'ctrl' | 'shift' | undefined;
  fastScrollSensitivity: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: FontWeight;
  fontWeightBold: FontWeight;
  letterSpacing: number;
  lineHeight: number;
  linkTooltipHoverDuration: number;
  logLevel: LogLevel;
  macOptionIsMeta: boolean;
  macOptionClickForcesSelection: boolean;
  minimumContrastRatio: number;
  rendererType: RendererType;
  rightClickSelectsWord: boolean;
  rows: number;
  screenReaderMode: boolean;
  scrollback: number;
  scrollSensitivity: number;
  tabStopWidth: number;
  theme: ITheme;
  windowsMode: boolean;
  windowOptions: IWindowOptions;
  wordSeparator: string;

  [key: string]: any;
  cancelEvents: boolean;
  convertEol: boolean;
  termName: string;
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

export const IUnicodeService = createDecorator<IUnicodeService>('UnicodeService');
export interface IUnicodeService {
  serviceBrand: undefined;
  /** Register an Unicode version provider. */
  register(provider: IUnicodeVersionProvider): void;
  /** Registered Unicode versions. */
  readonly versions: string[];
  /** Currently active version. */
  activeVersion: string;
  /** Event triggered, when activate version changed. */
  readonly onChange: IEvent<string>;

  /**
   * Unicode version dependent
   */
  wcwidth(codepoint: number): number;
  getStringCellWidth(s: string): number;
}

export interface IUnicodeVersionProvider {
  readonly version: string;
  wcwidth(ucs: number): 0 | 1 | 2;
}
