/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IOptionsService, ITerminalOptions, IPartialTerminalOptions } from 'common/services/Services';
import { EventEmitter, IEvent } from 'common/EventEmitter';
import { isMac } from 'common/Platform';
import { clone } from 'common/Clone';

// Source: https://freesound.org/people/altemark/sounds/45759/
// This sound is released under the Creative Commons Attribution 3.0 Unported
// (CC BY 3.0) license. It was created by 'altemark'. No modifications have been
// made, apart from the conversion to base64.
export const DEFAULT_BELL_SOUND = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjMyLjEwNAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYqc9ae9XFz280948NMBWInljyzsNRFLPWdnZGWrddDsjK1unuSrVN9jJsK8KuQtQCtMBjCEtImISdNKJOopIpBFpNSMbIHCSRpRR5iakjTiyzLhchUUBwCgyKiweBv/7UsQbg8isVNoMPMjAAAA0gAAABEVFGmgqK////9bP/6XCykxBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';

// TODO: Freeze?
export const DEFAULT_OPTIONS: ITerminalOptions = Object.freeze({
  cols: 80,
  rows: 24,
  cursorBlink: false,
  cursorStyle: 'block',
  cursorWidth: 1,
  bellSound:  DEFAULT_BELL_SOUND,
  bellStyle: 'none',
  drawBoldTextInBrightColors: true,
  fastScrollModifier: 'alt',
  fastScrollSensitivity: 5,
  fontFamily: 'courier-new, courier, monospace',
  fontSize: 15,
  fontWeight: 'normal',
  fontWeightBold: 'bold',
  lineHeight: 1.0,
  linkTooltipHoverDuration: 500,
  letterSpacing: 0,
  logLevel: 'info',
  scrollback: 1000,
  scrollSensitivity: 1,
  screenReaderMode: false,
  macOptionIsMeta: false,
  macOptionClickForcesSelection: false,
  minimumContrastRatio: 1,
  disableStdin: false,
  allowProposedApi: true,
  allowTransparency: false,
  tabStopWidth: 8,
  theme: {},
  rightClickSelectsWord: isMac,
  rendererType: 'canvas',
  windowOptions: {},
  windowsMode: false,
  wordSeparator: ' ()[]{}\',"`',

  convertEol: false,
  termName: 'xterm',
  cancelEvents: false
});

/**
 * The set of options that only have an effect when set in the Terminal constructor.
 */
const CONSTRUCTOR_ONLY_OPTIONS = ['cols', 'rows'];

export class OptionsService implements IOptionsService {
  public serviceBrand: any;

  public options: ITerminalOptions;

  private _onOptionChange = new EventEmitter<string>();
  public get onOptionChange(): IEvent<string> { return this._onOptionChange.event; }

  constructor(options: IPartialTerminalOptions) {
    this.options = clone(DEFAULT_OPTIONS);
    for (const k of Object.keys(options)) {
      if (k in this.options) {
        const newValue = options[k as keyof IPartialTerminalOptions] as any;
        this.options[k] = newValue;
      }
    }
  }

  public setOption(key: string, value: any): void {
    if (!(key in DEFAULT_OPTIONS)) {
      throw new Error('No option with key "' + key + '"');
    }
    if (CONSTRUCTOR_ONLY_OPTIONS.indexOf(key) !== -1) {
      throw new Error(`Option "${key}" can only be set in the constructor`);
    }
    if (this.options[key] === value) {
      return;
    }

    value = this._sanitizeAndValidateOption(key, value);

    // Don't fire an option change event if they didn't change
    if (this.options[key] === value) {
      return;
    }

    this.options[key] = value;
    this._onOptionChange.fire(key);
  }

  private _sanitizeAndValidateOption(key: string, value: any): any {
    switch (key) {
      case 'bellStyle':
      case 'cursorStyle':
      case 'fontWeight':
      case 'fontWeightBold':
      case 'rendererType':
      case 'wordSeparator':
        if (!value) {
          value = DEFAULT_OPTIONS[key];
        }
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
        break;
    }
    return value;
  }

  public getOption(key: string): any {
    if (!(key in DEFAULT_OPTIONS)) {
      throw new Error(`No option with key "${key}"`);
    }
    return this.options[key];
  }
}
