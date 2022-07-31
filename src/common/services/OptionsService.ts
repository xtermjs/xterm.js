/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IOptionsService, ITerminalOptions, FontWeight, ITheme } from 'common/services/Services';
import { EventEmitter, IEvent } from 'common/EventEmitter';
import { isMac } from 'common/Platform';
import { CursorStyle, IWindowOptions } from 'common/Types';

export const DEFAULT_WINDOW_OPTIONS: IWindowOptions = {
  restoreWin: false,
  minimizeWin: false,
  setWinPosition: false,
  setWinSizePixels: false,
  raiseWin: false,
  lowerWin: false,
  refreshWin: false,
  setWinSizeChars: false,
  maximizeWin: false,
  fullscreenWin: false,
  getWinState: false,
  getWinPosition: false,
  getWinSizePixels: false,
  getScreenSizePixels: false,
  getCellSizePixels: false,
  getWinSizeChars: false,
  getScreenSizeChars: false,
  getIconTitle: false,
  getWinTitle: false,
  pushTitle: false,
  popTitle: false,
  setWinLines: false
};

export const DEFAULT_THEME: ITheme = {
  foreground: '#FFFFFF',
  background: '#000000',
  cursor: '#000000',
  cursorAccent: '#FFFFFF',
  selectionForeground: '',
  selectionBackground: '#5DA5D533',
  selectionInactiveBackground: '',
  black: '#1E1E1D',
  brightBlack: '#262625',
  red: '#CE5C5C',
  brightRed: '#FF7272',
  green: '#5BCC5B',
  brightGreen: '#72FF72',
  yellow: '#CCCC5B',
  brightYellow: '#FFFF72',
  blue: '#5D5DD3',
  brightBlue: '#7279FF',
  magenta: '#BC5ED1',
  brightMagenta: '#E572FF',
  cyan: '#5DA5D5',
  brightCyan: '#72F0FF',
  white: '#F8F8F8',
  brightWhite: '#FFFFFF',
  extendedAnsi: []
};

export const DEFAULT_TERMINAL_OPTIONS: Readonly<ITerminalOptions> = {
  cols: 80,
  rows: 24,
  cursorBlink: false,
  cursorStyle: 'block',
  cursorWidth: 1,
  customGlyphs: true,
  drawBoldTextInBrightColors: true,
  fastScrollModifier: 'alt',
  fastScrollSensitivity: 5,
  fontFamily: 'courier-new, courier, monospace',
  fontSize: 15,
  fontWeight: 'normal',
  fontWeightBold: 'bold',
  lineHeight: 1.0,
  letterSpacing: 0,
  logLevel: 'info',
  scrollback: 1000,
  scrollSensitivity: 1,
  screenReaderMode: false,
  smoothScrollDuration: 0,
  macOptionIsMeta: false,
  macOptionClickForcesSelection: false,
  minimumContrastRatio: 1,
  disableStdin: false,
  allowProposedApi: false,
  allowTransparency: false,
  tabStopWidth: 8,
  theme: DEFAULT_THEME,
  rightClickSelectsWord: isMac,
  windowOptions: DEFAULT_WINDOW_OPTIONS,
  windowsMode: false,
  wordSeparator: ' ()[]{}\',"`',
  altClickMovesCursor: true,
  convertEol: false,
  termName: 'xterm',
  cancelEvents: false,
  overviewRulerWidth: 0
};

const FONT_WEIGHT_OPTIONS: Extract<FontWeight, string>[] = ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'];

export class OptionsService implements IOptionsService {
  public serviceBrand: any;

  public readonly rawOptions: ITerminalOptions;
  public options: ITerminalOptions;

  private _onOptionChange = new EventEmitter<string>();
  public get onOptionChange(): IEvent<string> { return this._onOptionChange.event; }

  constructor(options: Partial<ITerminalOptions>) {
    // set the default value of each option
    const defaultOptions = { ...DEFAULT_TERMINAL_OPTIONS };
    for (const key in options) {
      if (key in defaultOptions) {
        try {
          const newValue = options[key];
          defaultOptions[key] = this._sanitizeAndValidateOption(key, newValue);
        } catch (e) {
          console.error(e);
        }
      }
    }

    // set up getters and setters for each option
    this.rawOptions = defaultOptions;
    this.options = { ...defaultOptions };
    this._setupOptions();
  }

  private _setupOptions(): void {
    const getter = (propName: string): any => {
      if (!(propName in DEFAULT_TERMINAL_OPTIONS)) {
        throw new Error(`No option with key "${propName}"`);
      }
      return this.rawOptions[propName];
    };

    const setter = (propName: string, value: any): void => {
      if (!(propName in DEFAULT_TERMINAL_OPTIONS)) {
        throw new Error(`No option with key "${propName}"`);
      }

      value = this._sanitizeAndValidateOption(propName, value);
      // Don't fire an option change event if they didn't change
      if (this.rawOptions[propName] !== value) {
        this.rawOptions[propName] = value;
        this._onOptionChange.fire(propName);
      }
    };

    for (const propName in this.rawOptions) {
      const desc = {
        get: getter.bind(this, propName),
        set: setter.bind(this, propName)
      };
      Object.defineProperty(this.options, propName, desc);
    }
  }

  private _sanitizeAndValidateOption(key: string, value: any): any {
    switch (key) {
      case 'cursorStyle':
        if (!value) {
          value = DEFAULT_TERMINAL_OPTIONS[key];
        }
        if (!isCursorStyle(value)) {
          throw new Error(`"${value}" is not a valid value for ${key}`);
        }
        break;
      case 'cursorStyle':
      case 'wordSeparator':
        if (!value) {
          value = DEFAULT_TERMINAL_OPTIONS[key];
        }
        break;
      case 'fontWeight':
      case 'fontWeightBold':
        if (typeof value === 'number' && 1 <= value && value <= 1000) {
          // already valid numeric value
          break;
        }
        value = FONT_WEIGHT_OPTIONS.includes(value) ? value : DEFAULT_TERMINAL_OPTIONS[key];
        break;
      case 'cursorWidth':
        value = Math.floor(value);
      // Fall through for bounds check
      case 'lineHeight':
      case 'tabStopWidth':
        if (value < 1) {
          throw new Error(`${key} cannot be less than 1, value: ${value}`);
        }
        break;
      case 'minimumContrastRatio':
        value = Math.max(1, Math.min(21, Math.round(value * 10) / 10));
        break;
      case 'scrollback':
        value = Math.min(value, 4294967295);
        if (value < 0) {
          throw new Error(`${key} cannot be less than 0, value: ${value}`);
        }
        break;
      case 'fastScrollSensitivity':
      case 'scrollSensitivity':
        if (value <= 0) {
          throw new Error(`${key} cannot be less than or equal to 0, value: ${value}`);
        }
      case 'rows':
      case 'cols':
        if (!value && value !== 0) {
          throw new Error(`${key} must be numeric, value: ${value}`);
        }
        break;
    }
    return value;
  }
}

function isCursorStyle(value: unknown): value is CursorStyle {
  return value === 'block' || value === 'underline' || value === 'bar';
}
