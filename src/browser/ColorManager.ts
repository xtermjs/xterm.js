/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IColorManager, IColor, IColorSet, IColorContrastCache } from 'browser/Types';
import { ITheme } from 'common/services/Services';
import { fromCss, toCss, blend, toRgba, toPaddedHex } from 'browser/Color';
import { ColorContrastCache } from 'browser/ColorContrastCache';

const DEFAULT_FOREGROUND = fromCss('#ffffff');
const DEFAULT_BACKGROUND = fromCss('#000000');
const DEFAULT_CURSOR = fromCss('#ffffff');
const DEFAULT_CURSOR_ACCENT = fromCss('#000000');
const DEFAULT_SELECTION = {
  css: 'rgba(255, 255, 255, 0.3)',
  rgba: 0xFFFFFF4D
};

// An IIFE to generate DEFAULT_ANSI_COLORS. Do not mutate DEFAULT_ANSI_COLORS, instead make a copy
// and mutate that.
export const DEFAULT_ANSI_COLORS = (() => {
  const colors = [
    // dark:
    fromCss('#2e3436'),
    fromCss('#cc0000'),
    fromCss('#4e9a06'),
    fromCss('#c4a000'),
    fromCss('#3465a4'),
    fromCss('#75507b'),
    fromCss('#06989a'),
    fromCss('#d3d7cf'),
    // bright:
    fromCss('#555753'),
    fromCss('#ef2929'),
    fromCss('#8ae234'),
    fromCss('#fce94f'),
    fromCss('#729fcf'),
    fromCss('#ad7fa8'),
    fromCss('#34e2e2'),
    fromCss('#eeeeec')
  ];

  // Fill in the remaining 240 ANSI colors.
  // Generate colors (16-231)
  const v = [0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff];
  for (let i = 0; i < 216; i++) {
    const r = v[(i / 36) % 6 | 0];
    const g = v[(i / 6) % 6 | 0];
    const b = v[i % 6];
    colors.push({
      css: toCss(r, g, b),
      rgba: toRgba(r, g, b)
    });
  }

  // Generate greys (232-255)
  for (let i = 0; i < 24; i++) {
    const c = 8 + i * 10;
    colors.push({
      css: toCss(c, c, c),
      rgba: toRgba(c, c, c)
    });
  }

  return colors;
})();

/**
 * Manages the source of truth for a terminal's colors.
 */
export class ColorManager implements IColorManager {
  public colors: IColorSet;
  private _ctx: CanvasRenderingContext2D;
  private _litmusColor: CanvasGradient;
  private _contrastCache: IColorContrastCache;

  constructor(document: Document, public allowTransparency: boolean) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get rendering context');
    }
    this._ctx = ctx;
    this._ctx.globalCompositeOperation = 'copy';
    this._litmusColor = this._ctx.createLinearGradient(0, 0, 1, 1);
    this._contrastCache = new ColorContrastCache();
    this.colors = {
      foreground: DEFAULT_FOREGROUND,
      background: DEFAULT_BACKGROUND,
      cursor: DEFAULT_CURSOR,
      cursorAccent: DEFAULT_CURSOR_ACCENT,
      selection: DEFAULT_SELECTION,
      selectionOpaque: blend(DEFAULT_BACKGROUND, DEFAULT_SELECTION),
      ansi: DEFAULT_ANSI_COLORS.slice(),
      contrastCache: this._contrastCache
    };
  }

  public onOptionsChange(key: string): void {
    if (key === 'minimumContrastRatio') {
      this._contrastCache.clear();
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
    this.colors.cursor = this._parseColor(theme.cursor, DEFAULT_CURSOR, true);
    this.colors.cursorAccent = this._parseColor(theme.cursorAccent, DEFAULT_CURSOR_ACCENT, true);
    this.colors.selection = this._parseColor(theme.selection, DEFAULT_SELECTION, true);
    this.colors.selectionOpaque = blend(this.colors.background, this.colors.selection);
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
    // Clear our the cache
    this._contrastCache.clear();
  }

  private _parseColor(
    css: string | undefined,
    fallback: IColor,
    allowTransparency: boolean = this.allowTransparency
  ): IColor {
    if (css === undefined) {
      return fallback;
    }

    // If parsing the value results in failure, then it must be ignored, and the attribute must
    // retain its previous value.
    // -- https://html.spec.whatwg.org/multipage/canvas.html#fill-and-stroke-styles
    this._ctx.fillStyle = this._litmusColor;
    this._ctx.fillStyle = css;
    if (typeof this._ctx.fillStyle !== 'string') {
      console.warn(`Color: ${css} is invalid using fallback ${fallback.css}`);
      return fallback;
    }

    this._ctx.fillRect(0, 0, 1, 1);
    const data = this._ctx.getImageData(0, 0, 1, 1).data;

    // Check if the printed color was transparent
    if (data[3] !== 0xFF) {
      if (!allowTransparency) {
        // Ideally we'd just ignore the alpha channel, but...
        //
        // Browsers may not give back exactly the same RGB values we put in, because most/all
        // convert the color to a pre-multiplied representation. getImageData converts that back to
        // a un-premultipled representation, but the precision loss may make the RGB channels unuable
        // on their own.
        //
        // E.g. In Chrome #12345610 turns into #10305010, and in the extreme case, 0xFFFFFF00 turns
        // into 0x00000000.
        //
        // "Note: Due to the lossy nature of converting to and from premultiplied alpha color values,
        // pixels that have just been set using putImageData() might be returned to an equivalent
        // getImageData() as different values."
        // -- https://html.spec.whatwg.org/multipage/canvas.html#pixel-manipulation
        //
        // So let's just use the fallback color in this case instead.
        console.warn(
          `Color: ${css} is using transparency, but allowTransparency is false. ` +
          `Using fallback ${fallback.css}.`
        );
        return fallback;
      }
      let r: number;
      let g: number;
      let b: number;
      let a: number;
      let rgba: number;
      if (css.length === 5) {
        const num = parseInt(css.substr(1), 16);
        r = ((num >> 12) & 0xF) * 16;
        g = ((num >> 8) & 0xF) * 16;
        b = ((num >> 4) & 0xF) * 16;
        a = (num & 0xF) * 16;
        rgba = toRgba(r, g, b, a);
      } else {
        rgba = parseInt(css.substr(1), 16);
        r = (rgba >> 24) & 0xFF;
        g = (rgba >> 16) & 0xFF;
        b = (rgba >>  8) & 0xFF;
        a = (rgba      ) & 0xFF;
      }

      return {
        rgba,
        css: toCss(r, g, b, a)
      };
    }

    return {
      css,
      rgba: toRgba(data[0], data[1], data[2], data[3])
    };
  }
}
