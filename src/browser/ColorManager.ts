/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IColorManager, IColorSet, IColorContrastCache } from 'browser/Types';
import { ITheme } from 'common/services/Services';
import { channels, color, css } from 'common/Color';
import { ColorContrastCache } from 'browser/ColorContrastCache';
import { ColorIndex, IColor } from 'common/Types';


interface IRestoreColorSet {
  foreground: IColor;
  background: IColor;
  cursor: IColor;
  ansi: IColor[];
}


const DEFAULT_FOREGROUND = css.toColor('#ffffff');
const DEFAULT_BACKGROUND = css.toColor('#000000');
const DEFAULT_CURSOR = css.toColor('#ffffff');
const DEFAULT_CURSOR_ACCENT = css.toColor('#000000');
const DEFAULT_SELECTION = {
  css: 'rgba(255, 255, 255, 0.3)',
  rgba: 0xFFFFFF4D
};

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

/**
 * Manages the source of truth for a terminal's colors.
 */
export class ColorManager implements IColorManager {
  public colors: IColorSet;

  private _contrastCache: IColorContrastCache;
  private _restoreColors!: IRestoreColorSet;

  constructor() {
    this._contrastCache = new ColorContrastCache();
    this.colors = {
      foreground: DEFAULT_FOREGROUND,
      background: DEFAULT_BACKGROUND,
      cursor: DEFAULT_CURSOR,
      cursorAccent: DEFAULT_CURSOR_ACCENT,
      selectionForeground: undefined,
      selectionBackgroundTransparent: DEFAULT_SELECTION,
      selectionBackgroundOpaque: color.blend(DEFAULT_BACKGROUND, DEFAULT_SELECTION),
      selectionInactiveBackgroundTransparent: DEFAULT_SELECTION,
      selectionInactiveBackgroundOpaque: color.blend(DEFAULT_BACKGROUND, DEFAULT_SELECTION),
      ansi: DEFAULT_ANSI_COLORS.slice(),
      contrastCache: this._contrastCache
    };
    this._updateRestoreColors();
  }

  public onOptionsChange(key: string, value: any): void {
    switch (key) {
      case 'minimumContrastRatio':
        this._contrastCache.clear();
        break;
    }
  }

  /**
   * Sets the terminal's theme.
   * @param theme The  theme to use. If a partial theme is provided then default
   * colors will be used where colors are not defined.
   */
  public setTheme(theme: ITheme = {}): void {
    this.colors.foreground = this._parseColor(theme.foreground, DEFAULT_FOREGROUND);
    this.colors.background = this._parseColor(theme.background, DEFAULT_BACKGROUND);
    this.colors.cursor = this._parseColor(theme.cursor, DEFAULT_CURSOR);
    this.colors.cursorAccent = this._parseColor(theme.cursorAccent, DEFAULT_CURSOR_ACCENT);
    this.colors.selectionBackgroundTransparent = this._parseColor(theme.selectionBackground, DEFAULT_SELECTION);
    this.colors.selectionBackgroundOpaque = color.blend(this.colors.background, this.colors.selectionBackgroundTransparent);
    this.colors.selectionInactiveBackgroundTransparent = this._parseColor(theme.selectionInactiveBackground, this.colors.selectionBackgroundTransparent);
    this.colors.selectionInactiveBackgroundOpaque = color.blend(this.colors.background, this.colors.selectionInactiveBackgroundTransparent);
    const nullColor: IColor = {
      css: '',
      rgba: 0
    };
    this.colors.selectionForeground = theme.selectionForeground ? this._parseColor(theme.selectionForeground, nullColor) : undefined;
    if (this.colors.selectionForeground === nullColor) {
      this.colors.selectionForeground = undefined;
    }

    /**
     * If selection color is opaque, blend it with background with 0.3 opacity
     * Issue #2737
     */
    if (color.isOpaque(this.colors.selectionBackgroundTransparent)) {
      const opacity = 0.3;
      this.colors.selectionBackgroundTransparent = color.opacity(this.colors.selectionBackgroundTransparent, opacity);
    }
    if (color.isOpaque(this.colors.selectionInactiveBackgroundTransparent)) {
      const opacity = 0.3;
      this.colors.selectionInactiveBackgroundTransparent = color.opacity(this.colors.selectionInactiveBackgroundTransparent, opacity);
    }
    this.colors.ansi = DEFAULT_ANSI_COLORS.slice();
    this.colors.ansi[0] = this._parseColor(theme.black, DEFAULT_ANSI_COLORS[0]);
    this.colors.ansi[1] = this._parseColor(theme.red, DEFAULT_ANSI_COLORS[1]);
    this.colors.ansi[2] = this._parseColor(theme.green, DEFAULT_ANSI_COLORS[2]);
    this.colors.ansi[3] = this._parseColor(theme.yellow, DEFAULT_ANSI_COLORS[3]);
    this.colors.ansi[4] = this._parseColor(theme.blue, DEFAULT_ANSI_COLORS[4]);
    this.colors.ansi[5] = this._parseColor(theme.magenta, DEFAULT_ANSI_COLORS[5]);
    this.colors.ansi[6] = this._parseColor(theme.cyan, DEFAULT_ANSI_COLORS[6]);
    this.colors.ansi[7] = this._parseColor(theme.white, DEFAULT_ANSI_COLORS[7]);
    this.colors.ansi[8] = this._parseColor(theme.brightBlack, DEFAULT_ANSI_COLORS[8]);
    this.colors.ansi[9] = this._parseColor(theme.brightRed, DEFAULT_ANSI_COLORS[9]);
    this.colors.ansi[10] = this._parseColor(theme.brightGreen, DEFAULT_ANSI_COLORS[10]);
    this.colors.ansi[11] = this._parseColor(theme.brightYellow, DEFAULT_ANSI_COLORS[11]);
    this.colors.ansi[12] = this._parseColor(theme.brightBlue, DEFAULT_ANSI_COLORS[12]);
    this.colors.ansi[13] = this._parseColor(theme.brightMagenta, DEFAULT_ANSI_COLORS[13]);
    this.colors.ansi[14] = this._parseColor(theme.brightCyan, DEFAULT_ANSI_COLORS[14]);
    this.colors.ansi[15] = this._parseColor(theme.brightWhite, DEFAULT_ANSI_COLORS[15]);
    if (theme.extendedAnsi) {
      const colorCount = Math.min(this.colors.ansi.length - 16, theme.extendedAnsi.length);
      for (let i = 0; i < colorCount; i++) {
        this.colors.ansi[i + 16] = this._parseColor(theme.extendedAnsi[i], DEFAULT_ANSI_COLORS[i + 16]);
      }
    }
    // Clear our the cache
    this._contrastCache.clear();
    this._updateRestoreColors();
  }

  public restoreColor(slot?: ColorIndex): void {
    // unset slot restores all ansi colors
    if (slot === undefined) {
      for (let i = 0; i < this._restoreColors.ansi.length; ++i) {
        this.colors.ansi[i] = this._restoreColors.ansi[i];
      }
      return;
    }
    switch (slot) {
      case ColorIndex.FOREGROUND:
        this.colors.foreground = this._restoreColors.foreground;
        break;
      case ColorIndex.BACKGROUND:
        this.colors.background = this._restoreColors.background;
        break;
      case ColorIndex.CURSOR:
        this.colors.cursor = this._restoreColors.cursor;
        break;
      default:
        this.colors.ansi[slot] = this._restoreColors.ansi[slot];
    }
  }

  private _updateRestoreColors(): void {
    this._restoreColors = {
      foreground: this.colors.foreground,
      background: this.colors.background,
      cursor: this.colors.cursor,
      ansi: this.colors.ansi.slice()
    };
  }

  private _parseColor(
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
}
