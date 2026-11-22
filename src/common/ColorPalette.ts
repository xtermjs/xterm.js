/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { channels, color, css } from './Color';
import { ITheme } from './services/Services';
import { AllColorIndex, IColor, SpecialColorIndex } from './Types';

export interface IColorPalette {
  foreground: IColor;
  background: IColor;
  cursor: IColor;
  ansi: IColor[];
}

export interface IColorPaletteService {
  readonly colors: Readonly<Omit<IColorPalette, 'ansi'>> & { ansi: ReadonlyArray<IColor> };
  modifyColors(callback: (colors: IColorPalette) => void): void;
  restoreColor(slot?: AllColorIndex): void;
}

export const DEFAULT_FOREGROUND = css.toColor('#ffffff');
export const DEFAULT_BACKGROUND = css.toColor('#000000');
const DEFAULT_CURSOR = css.toColor('#ffffff');

// An IIFE to generate DEFAULT_ANSI_COLORS.
export const DEFAULT_ANSI_COLORS = Object.freeze((() => {
  const colors = [
    // dark:
    css.toColor('#2e3436'),
    css.toColor('#cc0000'),
    css.toColor('#4e9a06'),
    css.toColor('#c4a000'),
    css.toColor('#3465a4'),
    css.toColor('#75507b'),
    css.toColor('#06989a'),
    css.toColor('#d3d7cf'),
    // bright:
    css.toColor('#555753'),
    css.toColor('#ef2929'),
    css.toColor('#8ae234'),
    css.toColor('#fce94f'),
    css.toColor('#729fcf'),
    css.toColor('#ad7fa8'),
    css.toColor('#34e2e2'),
    css.toColor('#eeeeec')
  ];

  // Fill in the remaining 240 ANSI colors.
  // Generate colors (16-231)
  const v = [0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff];
  for (let i = 0; i < 216; i++) {
    const r = v[(i / 36) % 6 | 0];
    const g = v[(i / 6) % 6 | 0];
    const b = v[i % 6];
    colors.push({
      css: channels.toCss(r, g, b),
      rgba: channels.toRgba(r, g, b)
    });
  }

  // Generate greys (232-255)
  for (let i = 0; i < 24; i++) {
    const c = 8 + i * 10;
    colors.push({
      css: channels.toCss(c, c, c),
      rgba: channels.toRgba(c, c, c)
    });
  }

  return colors;
})());

export class ColorPalette implements IColorPaletteService {
  public readonly colors: IColorPalette = {
    foreground: DEFAULT_FOREGROUND,
    background: DEFAULT_BACKGROUND,
    cursor: DEFAULT_CURSOR,
    ansi: DEFAULT_ANSI_COLORS.slice()
  };
  private _restoreColors!: IColorPalette;

  constructor(theme?: ITheme) {
    this.setTheme(theme);
  }

  public setTheme(theme: ITheme = {}): void {
    const colors = this.colors;
    colors.foreground = parseColor(theme.foreground, DEFAULT_FOREGROUND);
    colors.background = parseColor(theme.background, DEFAULT_BACKGROUND);
    colors.cursor = color.blend(colors.background, parseColor(theme.cursor, DEFAULT_CURSOR));
    colors.ansi = DEFAULT_ANSI_COLORS.slice();
    colors.ansi[0] = parseColor(theme.black, DEFAULT_ANSI_COLORS[0]);
    colors.ansi[1] = parseColor(theme.red, DEFAULT_ANSI_COLORS[1]);
    colors.ansi[2] = parseColor(theme.green, DEFAULT_ANSI_COLORS[2]);
    colors.ansi[3] = parseColor(theme.yellow, DEFAULT_ANSI_COLORS[3]);
    colors.ansi[4] = parseColor(theme.blue, DEFAULT_ANSI_COLORS[4]);
    colors.ansi[5] = parseColor(theme.magenta, DEFAULT_ANSI_COLORS[5]);
    colors.ansi[6] = parseColor(theme.cyan, DEFAULT_ANSI_COLORS[6]);
    colors.ansi[7] = parseColor(theme.white, DEFAULT_ANSI_COLORS[7]);
    colors.ansi[8] = parseColor(theme.brightBlack, DEFAULT_ANSI_COLORS[8]);
    colors.ansi[9] = parseColor(theme.brightRed, DEFAULT_ANSI_COLORS[9]);
    colors.ansi[10] = parseColor(theme.brightGreen, DEFAULT_ANSI_COLORS[10]);
    colors.ansi[11] = parseColor(theme.brightYellow, DEFAULT_ANSI_COLORS[11]);
    colors.ansi[12] = parseColor(theme.brightBlue, DEFAULT_ANSI_COLORS[12]);
    colors.ansi[13] = parseColor(theme.brightMagenta, DEFAULT_ANSI_COLORS[13]);
    colors.ansi[14] = parseColor(theme.brightCyan, DEFAULT_ANSI_COLORS[14]);
    colors.ansi[15] = parseColor(theme.brightWhite, DEFAULT_ANSI_COLORS[15]);
    if (theme.extendedAnsi) {
      const colorCount = Math.min(colors.ansi.length - 16, theme.extendedAnsi.length);
      for (let i = 0; i < colorCount; i++) {
        colors.ansi[i + 16] = parseColor(theme.extendedAnsi[i], DEFAULT_ANSI_COLORS[i + 16]);
      }
    }
    this._restoreColors = {
      foreground: colors.foreground,
      background: colors.background,
      cursor: colors.cursor,
      ansi: colors.ansi.slice()
    };
  }

  public restoreColor(slot?: AllColorIndex): void {
    // unset slot restores all ansi colors
    if (slot === undefined) {
      for (let i = 0; i < this._restoreColors.ansi.length; ++i) {
        this.colors.ansi[i] = this._restoreColors.ansi[i];
      }
      return;
    }
    switch (slot) {
      case SpecialColorIndex.FOREGROUND:
        this.colors.foreground = this._restoreColors.foreground;
        break;
      case SpecialColorIndex.BACKGROUND:
        this.colors.background = this._restoreColors.background;
        break;
      case SpecialColorIndex.CURSOR:
        this.colors.cursor = this._restoreColors.cursor;
        break;
      default:
        this.colors.ansi[slot] = this._restoreColors.ansi[slot];
    }
  }

  public modifyColors(callback: (colors: IColorPalette) => void): void {
    callback(this.colors);
  }
}

export function parseColor(
  cssString: string | undefined,
  fallback: IColor
): IColor {
  if (cssString !== undefined) {
    try {
      return css.toColor(cssString);
    } catch {
      // no-op
    }
  }
  return fallback;
}
