/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IColorSet, IColorManager } from './Types';
import { ITheme } from 'xterm';

const DEFAULT_FOREGROUND = '#ffffff';
const DEFAULT_BACKGROUND = '#000000';
const DEFAULT_CURSOR = '#ffffff';
const DEFAULT_CURSOR_ACCENT = '#000000';
const DEFAULT_SELECTION = 'rgba(255, 255, 255, 0.3)';
export const DEFAULT_ANSI_COLORS = [
  // dark:
  '#2e3436',
  '#cc0000',
  '#4e9a06',
  '#c4a000',
  '#3465a4',
  '#75507b',
  '#06989a',
  '#d3d7cf',
  // bright:
  '#555753',
  '#ef2929',
  '#8ae234',
  '#fce94f',
  '#729fcf',
  '#ad7fa8',
  '#34e2e2',
  '#eeeeec'
];

/**
 * Fills an existing 16 length string with the remaining 240 ANSI colors.
 * @param first16Colors The first 16 ANSI colors.
 */
function generate256Colors(first16Colors: string[]): string[] {
  let colors = first16Colors.slice();

  // Generate colors (16-231)
  let v = [0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff];
  for (let i = 0; i < 216; i++) {
    const r = toPaddedHex(v[(i / 36) % 6 | 0]);
    const g = toPaddedHex(v[(i / 6) % 6 | 0]);
    const b = toPaddedHex(v[i % 6]);
    colors.push(`#${r}${g}${b}`);
  }

  // Generate greys (232-255)
  for (let i = 0; i < 24; i++) {
    const c = toPaddedHex(8 + i * 10);
    colors.push(`#${c}${c}${c}`);
  }

  return colors;
}

function toPaddedHex(c: number): string {
  let s = c.toString(16);
  return s.length < 2 ? '0' + s : s;
}

/**
 * Manages the source of truth for a terminal's colors.
 */
export class ColorManager implements IColorManager {
  public colors: IColorSet;
  private _document: Document;

  constructor(document: Document) {
    this._document = document;
    this.colors = {
      foreground: DEFAULT_FOREGROUND,
      background: DEFAULT_BACKGROUND,
      cursor: DEFAULT_CURSOR,
      cursorAccent: DEFAULT_CURSOR_ACCENT,
      selection: DEFAULT_SELECTION,
      ansi: generate256Colors(DEFAULT_ANSI_COLORS)
    };
  }

  /**
   * Sets the terminal's theme.
   * @param theme The  theme to use. If a partial theme is provided then default
   * colors will be used where colors are not defined.
   */
  public setTheme(theme: ITheme): void {
    this.colors.foreground = this._validateColor(theme.foreground, DEFAULT_FOREGROUND);
    this.colors.background = this._validateColor(theme.background, DEFAULT_BACKGROUND);
    this.colors.cursor = this._validateColor(theme.cursor, DEFAULT_CURSOR);
    this.colors.cursorAccent = this._validateColor(theme.cursorAccent, DEFAULT_CURSOR_ACCENT);
    this.colors.selection = this._validateColor(theme.selection, DEFAULT_SELECTION);
    this.colors.ansi[0] = this._validateColor(theme.black, DEFAULT_ANSI_COLORS[0]);
    this.colors.ansi[1] = this._validateColor(theme.red, DEFAULT_ANSI_COLORS[1]);
    this.colors.ansi[2] = this._validateColor(theme.green, DEFAULT_ANSI_COLORS[2]);
    this.colors.ansi[3] = this._validateColor(theme.yellow, DEFAULT_ANSI_COLORS[3]);
    this.colors.ansi[4] = this._validateColor(theme.blue, DEFAULT_ANSI_COLORS[4]);
    this.colors.ansi[5] = this._validateColor(theme.magenta, DEFAULT_ANSI_COLORS[5]);
    this.colors.ansi[6] = this._validateColor(theme.cyan, DEFAULT_ANSI_COLORS[6]);
    this.colors.ansi[7] = this._validateColor(theme.white, DEFAULT_ANSI_COLORS[7]);
    this.colors.ansi[8] = this._validateColor(theme.brightBlack, DEFAULT_ANSI_COLORS[8]);
    this.colors.ansi[9] = this._validateColor(theme.brightRed, DEFAULT_ANSI_COLORS[9]);
    this.colors.ansi[10] = this._validateColor(theme.brightGreen, DEFAULT_ANSI_COLORS[10]);
    this.colors.ansi[11] = this._validateColor(theme.brightYellow, DEFAULT_ANSI_COLORS[11]);
    this.colors.ansi[12] = this._validateColor(theme.brightBlue, DEFAULT_ANSI_COLORS[12]);
    this.colors.ansi[13] = this._validateColor(theme.brightMagenta, DEFAULT_ANSI_COLORS[13]);
    this.colors.ansi[14] = this._validateColor(theme.brightCyan, DEFAULT_ANSI_COLORS[14]);
    this.colors.ansi[15] = this._validateColor(theme.brightWhite, DEFAULT_ANSI_COLORS[15]);
  }

  private _validateColor(color: string, fallback: string): string {
    if (!color) {
      return fallback;
    }

    const isColorValid = this._isColorValid(color);

    if (!isColorValid) {
      console.warn(`Color: ${color} is invalid using fallback ${fallback}`);
    }

    return isColorValid ? color : fallback;
  }

  private _isColorValid(color: string): boolean {
    const litmus = 'red';
    const d = this._document.createElement('div');
    d.style.color = litmus;
    d.style.color = color;

    // Element's style.color will be reverted to litmus or set to '' if an invalid color is given
    if (color !== litmus && (d.style.color === litmus || d.style.color === '')) {
      return false;
    }

    return true;
  }
}
