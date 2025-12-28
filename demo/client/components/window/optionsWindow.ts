/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { BaseWindow } from './baseWindow';
import type { Terminal, ITheme } from '@xterm/xterm';
import type { IControlWindow } from '../controlBar';
import type { AddonCollection } from 'types';

const xtermjsTheme: ITheme = {
  foreground: '#F8F8F8',
  background: '#2D2E2C',
  selectionBackground: '#5DA5D533',
  selectionInactiveBackground: '#555555AA',
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
  brightWhite: '#FFFFFF'
};

export class OptionsWindow extends BaseWindow implements IControlWindow {
  public readonly id = 'options';
  public readonly label = 'Options';

  private _container: HTMLElement;
  private _optionsContainer: HTMLElement;
  private _autoResize: boolean = true;

  constructor(
    terminal: Terminal,
    addons: AddonCollection,
    private readonly _handlers: {
      updateTerminalSize: () => void,
      updateTerminalContainerBackground: () => void
    },
  ) {
    super(terminal, addons)
  }

  public build(container: HTMLElement): void {
    this._container = container;

    const description = document.createElement('p');
    description.innerHTML = 'These options can be set in the <code>Terminal</code> constructor or by using the <code>Terminal.options</code> property.';
    container.appendChild(description);

    this._optionsContainer = document.createElement('div');
    this._optionsContainer.id = 'options-container';
    container.appendChild(this._optionsContainer);
  }

  public initOptions(addDomListener: (el: HTMLElement, type: string, handler: (...args: any[]) => any) => void): void {
    const blacklistedOptions = [
      'cancelEvents',
      'convertEol',
      'termName',
      'cols', 'rows',
      'documentOverride',
      'linkHandler',
      'logger',
      'overviewRuler',
      'quirks',
      'theme',
      'windowOptions',
      'windowsPty',
    ];
    const stringOptions: { [key: string]: string[] | null } = {
      cursorStyle: ['block', 'underline', 'bar'],
      cursorInactiveStyle: ['outline', 'block', 'bar', 'underline', 'none'],
      fontFamily: null,
      fontWeight: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
      fontWeightBold: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
      logLevel: ['trace', 'debug', 'info', 'warn', 'error', 'off'],
      theme: ['default', 'xtermjs', 'sapphire', 'light'],
      wordSeparator: null,
      colsRows: null
    };
    const options = Object.getOwnPropertyNames(this._terminal.options);
    const booleanOptions: string[] = [];
    const numberOptions: string[] = [];
    options.filter(o => blacklistedOptions.indexOf(o) === -1).forEach(o => {
      switch (typeof this._terminal.options[o]) {
        case 'boolean':
          booleanOptions.push(o);
          break;
        case 'number':
          numberOptions.push(o);
          break;
        default:
          if (Object.keys(stringOptions).indexOf(o) === -1 && numberOptions.indexOf(o) === -1 && booleanOptions.indexOf(o) === -1) {
            console.warn(`Unrecognized option: "${o}"`);
          }
      }
    });

    let html = '';
    html += '<div class="option-group">';
    booleanOptions.forEach(o => {
      html += `<div class="option"><label><input id="opt-${o}" type="checkbox" ${this._terminal.options[o] ? 'checked' : ''}/> ${o}</label></div>`;
    });
    html += '</div><div class="option-group">';
    numberOptions.forEach(o => {
      html += `<div class="option"><label>${o} <input id="opt-${o}" type="number" value="${this._terminal.options[o] ?? ''}" step="${o === 'lineHeight' || o === 'scrollSensitivity' ? '0.1' : '1'}"/></label></div>`;
    });
    html += '</div><div class="option-group">';
    Object.keys(stringOptions).forEach(o => {
      if (o === 'colsRows') {
        html += `<div class="option"><label>size (<var>cols</var><code>x</code><var>rows</var> or <code>auto</code>) <input id="opt-${o}" type="text" value="auto"/></label></div>`;
      } else if (stringOptions[o]) {
        const selectedOption = o === 'theme' ? 'xtermjs' : this._terminal.options[o];
        html += `<div class="option"><label>${o} <select id="opt-${o}">${stringOptions[o]!.map(v => `<option ${v === selectedOption ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>`;
      } else {
        html += `<div class="option"><label>${o} <input id="opt-${o}" type="text" value="${this._terminal.options[o]}"/></label></div>`;
      }
    });
    html += '</div>';

    this._optionsContainer.innerHTML = html;

    // Attach listeners
    booleanOptions.forEach(o => {
      const input = document.getElementById(`opt-${o}`) as HTMLInputElement;
      addDomListener(input, 'change', () => {
        console.log('change', o, input.checked);
        this._terminal.options[o] = input.checked;
      });
    });
    numberOptions.forEach(o => {
      const input = document.getElementById(`opt-${o}`) as HTMLInputElement;
      addDomListener(input, 'change', () => {
        console.log('change', o, input.value);
        if (o === 'lineHeight') {
          this._terminal.options.lineHeight = parseFloat(input.value);
        } else if (o === 'scrollSensitivity') {
          this._terminal.options.scrollSensitivity = parseFloat(input.value);
        } else if (o === 'scrollback') {
          this._terminal.options.scrollback = parseInt(input.value);
          setTimeout(() => this._handlers.updateTerminalSize(), 5);
        } else {
          this._terminal.options[o] = parseInt(input.value);
        }
        this._handlers.updateTerminalSize();
      });
    });
    Object.keys(stringOptions).forEach(o => {
      const input = document.getElementById(`opt-${o}`) as HTMLInputElement;
      addDomListener(input, 'change', () => {
        console.log('change', o, input.value);
        let value: any = input.value;
        if (o === 'colsRows') {
          const m = input.value.match(/^([0-9]+)x([0-9]+)$/);
          if (m) {
            this._autoResize = false;
            this._terminal.resize(parseInt(m[1]), parseInt(m[2]));
          } else {
            this._autoResize = true;
            input.value = 'auto';
            this._handlers.updateTerminalSize();
          }
        } else if (o === 'theme') {
          switch (input.value) {
            case 'default':
              value = undefined;
              break;
            case 'xtermjs':
              value = xtermjsTheme;
              break;
            case 'sapphire':
              value = {
                background: '#1c2431',
                foreground: '#cccccc',
                selectionBackground: '#399ef440',
                black: '#666666',
                blue: '#399ef4',
                brightBlack: '#666666',
                brightBlue: '#399ef4',
                brightCyan: '#21c5c7',
                brightGreen: '#4eb071',
                brightMagenta: '#b168df',
                brightRed: '#da6771',
                brightWhite: '#efefef',
                brightYellow: '#fff099',
                cyan: '#21c5c7',
                green: '#4eb071',
                magenta: '#b168df',
                red: '#da6771',
                white: '#efefef',
                yellow: '#fff099'
              };
              break;
            case 'light':
              value = {
                background: '#ffffff',
                foreground: '#333333',
                cursor: '#333333',
                cursorAccent: '#ffffff',
                selectionBackground: '#add6ff',
                overviewRulerBorder: '#aaaaaa',
                black: '#000000',
                blue: '#0451a5',
                brightBlack: '#666666',
                brightBlue: '#0451a5',
                brightCyan: '#0598bc',
                brightGreen: '#14ce14',
                brightMagenta: '#bc05bc',
                brightRed: '#cd3131',
                brightWhite: '#a5a5a5',
                brightYellow: '#b5ba00',
                cyan: '#0598bc',
                green: '#00bc00',
                magenta: '#bc05bc',
                red: '#cd3131',
                white: '#555555',
                yellow: '#949800'
              };
              break;
          }
        }
        this._terminal.options[o] = value;
        if (o === 'theme') {
          this._handlers.updateTerminalContainerBackground();
        }
      });
    });
  }

  public get autoResize(): boolean {
    return this._autoResize;
  }

  public set autoResize(value: boolean) {
    this._autoResize = value;
  }
}
