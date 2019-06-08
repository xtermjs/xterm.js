/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IEvent } from 'common/EventEmitter2';

export interface IBufferService {
  readonly cols: number;
  readonly rows: number;

  // TODO: Move resize event here

  resize(cols: number, rows: number): void;
}

export interface IOptionsService {
  readonly options: ITerminalOptions;

  readonly onOptionChange: IEvent<string>;

  setOption<T>(key: string, value: T): void;
  getOption<T>(key: string): T | undefined;
}

export type FontWeight = 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';

export type RendererType = 'dom' | 'canvas';

export interface IPartialTerminalOptions {
  allowTransparency?: boolean;
  bellSound?: string;
  bellStyle?: 'none' /*| 'visual'*/ | 'sound' /*| 'both'*/;
  cols?: number;
  cursorBlink?: boolean;
  cursorStyle?: 'block' | 'underline' | 'bar';
  disableStdin?: boolean;
  drawBoldTextInBrightColors?: boolean;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: FontWeight;
  fontWeightBold?: FontWeight;
  letterSpacing?: number;
  lineHeight?: number;
  macOptionIsMeta?: boolean;
  macOptionClickForcesSelection?: boolean;
  rendererType?: RendererType;
  rightClickSelectsWord?: boolean;
  rows?: number;
  screenReaderMode?: boolean;
  scrollback?: number;
  tabStopWidth?: number;
  theme?: ITheme;
  windowsMode?: boolean;
}

export interface ITerminalOptions {
  allowTransparency: boolean;
  bellSound: string;
  bellStyle: 'none' /*| 'visual'*/ | 'sound' /*| 'both'*/;
  cols: number;
  cursorBlink: boolean;
  cursorStyle: 'block' | 'underline' | 'bar';
  disableStdin: boolean;
  drawBoldTextInBrightColors: boolean;
  fontSize: number;
  fontFamily: string;
  fontWeight: FontWeight;
  fontWeightBold: FontWeight;
  letterSpacing: number;
  lineHeight: number;
  macOptionIsMeta: boolean;
  macOptionClickForcesSelection: boolean;
  rendererType: RendererType;
  rightClickSelectsWord: boolean;
  rows: number;
  screenReaderMode: boolean;
  scrollback: number;
  tabStopWidth: number;
  theme: ITheme;
  windowsMode: boolean;

  [key: string]: any;
  cancelEvents: boolean;
  convertEol: boolean;
  debug: boolean;
  screenKeys: boolean;
  termName: string;
  useFlowControl: boolean;
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
