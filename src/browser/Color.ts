/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IColor } from 'browser/Types';
import { IColorRGB } from 'common/Types';

/**
 * Helper functions where the source type is "channels" (individual color channels as numbers).
 */
export namespace channels {
  export function toCss(r: number, g: number, b: number, a?: number): string {
    if (a !== undefined) {
      return `#${toPaddedHex(r)}${toPaddedHex(g)}${toPaddedHex(b)}${toPaddedHex(a)}`;
    }
    return `#${toPaddedHex(r)}${toPaddedHex(g)}${toPaddedHex(b)}`;
  }

  export function toRgba(r: number, g: number, b: number, a: number = 0xFF): number {
    // Note: The aggregated number is RGBA32 (BE), thus needs to be converted to ABGR32
    // on LE systems, before it can be used for direct 32-bit buffer writes.
    // >>> 0 forces an unsigned int
    return (r << 24 | g << 16 | b << 8 | a) >>> 0;
  }
}

/**
 * Helper functions where the source type is `IColor`.
 */
export namespace color {
  export function blend(bg: IColor, fg: IColor): IColor {
    const a = (fg.rgba & 0xFF) / 255;
    if (a === 1) {
      return {
        css: fg.css,
        rgba: fg.rgba
      };
    }
    const fgR = (fg.rgba >> 24) & 0xFF;
    const fgG = (fg.rgba >> 16) & 0xFF;
    const fgB = (fg.rgba >> 8) & 0xFF;
    const bgR = (bg.rgba >> 24) & 0xFF;
    const bgG = (bg.rgba >> 16) & 0xFF;
    const bgB = (bg.rgba >> 8) & 0xFF;
    const r = bgR + Math.round((fgR - bgR) * a);
    const g = bgG + Math.round((fgG - bgG) * a);
    const b = bgB + Math.round((fgB - bgB) * a);
    const css = channels.toCss(r, g, b);
    const rgba = channels.toRgba(r, g, b);
    return { css, rgba };
  }

  export function isOpaque(color: IColor): boolean {
    return (color.rgba & 0xFF) === 0xFF;
  }

  export function ensureContrastRatio(bg: IColor, fg: IColor, ratio: number): IColor | undefined {
    const result = rgba.ensureContrastRatio(bg.rgba, fg.rgba, ratio);
    if (!result) {
      return undefined;
    }
    return rgba.toColor(
      (result >> 24 & 0xFF),
      (result >> 16 & 0xFF),
      (result >> 8  & 0xFF)
    );
  }

  export function opaque(color: IColor): IColor {
    const rgbaColor = (color.rgba | 0xFF) >>> 0;
    const [r, g, b] = rgba.toChannels(rgbaColor);
    return {
      css: channels.toCss(r, g, b),
      rgba: rgbaColor
    };
  }

  export function opacity(color: IColor, opacity: number): IColor {
    const a = Math.round(opacity * 0xFF);
    const [r, g, b] = rgba.toChannels(color.rgba);
    return {
      css: channels.toCss(r, g, b, a),
      rgba: channels.toRgba(r, g, b, a)
    };
  }

  export function toColorRGB(color: IColor): IColorRGB {
    return [(color.rgba >> 24) & 0xFF, (color.rgba >> 16) & 0xFF, (color.rgba >> 8) & 0xFF];
  }
}

/**
 * Helper functions where the source type is "css" (string: '#rgb', '#rgba', '#rrggbb', '#rrggbbaa').
 */
export namespace css {
  export function toColor(css: string): IColor {
    switch (css.length) {
      case 7: // #rrggbb
        return {
          css,
          rgba: (parseInt(css.slice(1), 16) << 8 | 0xFF) >>> 0
        };
      case 9: // #rrggbbaa
        return {
          css,
          rgba: parseInt(css.slice(1), 16) >>> 0
        };
    }
    throw new Error('css.toColor: Unsupported css format');
  }
}

/**
 * Helper functions where the source type is "rgb" (number: 0xrrggbb).
 */
export namespace rgb {
  /**
   * Gets the relative luminance of an RGB color, this is useful in determining the contrast ratio
   * between two colors.
   * @param rgb The color to use.
   * @see https://www.w3.org/TR/WCAG20/#relativeluminancedef
   */
  export function relativeLuminance(rgb: number): number {
    return relativeLuminance2(
      (rgb >> 16) & 0xFF,
      (rgb >> 8 ) & 0xFF,
      (rgb      ) & 0xFF);
  }

  /**
   * Gets the relative luminance of an RGB color, this is useful in determining the contrast ratio
   * between two colors.
   * @param r The red channel (0x00 to 0xFF).
   * @param g The green channel (0x00 to 0xFF).
   * @param b The blue channel (0x00 to 0xFF).
   * @see https://www.w3.org/TR/WCAG20/#relativeluminancedef
   */
  export function relativeLuminance2(r: number, g: number, b: number): number {
    const rs = r / 255;
    const gs = g / 255;
    const bs = b / 255;
    const rr = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
    const rg = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
    const rb = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);
    return rr * 0.2126 + rg * 0.7152 + rb * 0.0722;
  }
}

/**
 * Helper functions where the source type is "rgba" (number: 0xrrggbbaa).
 */
export namespace rgba {
  export function ensureContrastRatio(bgRgba: number, fgRgba: number, ratio: number): number | undefined {
    const bgL = rgb.relativeLuminance(bgRgba >> 8);
    const fgL = rgb.relativeLuminance(fgRgba >> 8);
    const cr = contrastRatio(bgL, fgL);
    if (cr < ratio) {
      if (fgL < bgL) {
        return reduceLuminance(bgRgba, fgRgba, ratio);
      }
      return increaseLuminance(bgRgba, fgRgba, ratio);
    }
    return undefined;
  }

  export function reduceLuminance(bgRgba: number, fgRgba: number, ratio: number): number {
    // This is a naive but fast approach to reducing luminance as converting to
    // HSL and back is expensive
    const bgR = (bgRgba >> 24) & 0xFF;
    const bgG = (bgRgba >> 16) & 0xFF;
    const bgB = (bgRgba >>  8) & 0xFF;
    let fgR = (fgRgba >> 24) & 0xFF;
    let fgG = (fgRgba >> 16) & 0xFF;
    let fgB = (fgRgba >>  8) & 0xFF;
    let cr = contrastRatio(rgb.relativeLuminance2(fgR, fgB, fgG), rgb.relativeLuminance2(bgR, bgG, bgB));
    while (cr < ratio && (fgR > 0 || fgG > 0 || fgB > 0)) {
      // Reduce by 10% until the ratio is hit
      fgR -= Math.max(0, Math.ceil(fgR * 0.1));
      fgG -= Math.max(0, Math.ceil(fgG * 0.1));
      fgB -= Math.max(0, Math.ceil(fgB * 0.1));
      cr = contrastRatio(rgb.relativeLuminance2(fgR, fgB, fgG), rgb.relativeLuminance2(bgR, bgG, bgB));
    }
    return (fgR << 24 | fgG << 16 | fgB << 8 | 0xFF) >>> 0;
  }

  export function increaseLuminance(bgRgba: number, fgRgba: number, ratio: number): number {
    // This is a naive but fast approach to increasing luminance as converting to
    // HSL and back is expensive
    const bgR = (bgRgba >> 24) & 0xFF;
    const bgG = (bgRgba >> 16) & 0xFF;
    const bgB = (bgRgba >>  8) & 0xFF;
    let fgR = (fgRgba >> 24) & 0xFF;
    let fgG = (fgRgba >> 16) & 0xFF;
    let fgB = (fgRgba >>  8) & 0xFF;
    let cr = contrastRatio(rgb.relativeLuminance2(fgR, fgB, fgG), rgb.relativeLuminance2(bgR, bgG, bgB));
    while (cr < ratio && (fgR < 0xFF || fgG < 0xFF || fgB < 0xFF)) {
      // Increase by 10% until the ratio is hit
      fgR = Math.min(0xFF, fgR + Math.ceil((255 - fgR) * 0.1));
      fgG = Math.min(0xFF, fgG + Math.ceil((255 - fgG) * 0.1));
      fgB = Math.min(0xFF, fgB + Math.ceil((255 - fgB) * 0.1));
      cr = contrastRatio(rgb.relativeLuminance2(fgR, fgB, fgG), rgb.relativeLuminance2(bgR, bgG, bgB));
    }
    return (fgR << 24 | fgG << 16 | fgB << 8 | 0xFF) >>> 0;
  }

  // FIXME: Move this to channels NS?
  export function toChannels(value: number): [number, number, number, number] {
    return [(value >> 24) & 0xFF, (value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF];
  }

  export function toColor(r: number, g: number, b: number): IColor {
    return {
      css: channels.toCss(r, g, b),
      rgba: channels.toRgba(r, g, b)
    };
  }
}

export function toPaddedHex(c: number): string {
  const s = c.toString(16);
  return s.length < 2 ? '0' + s : s;
}

/**
 * Gets the contrast ratio between two relative luminance values.
 * @param l1 The first relative luminance.
 * @param l2 The first relative luminance.
 * @see https://www.w3.org/TR/WCAG20/#contrast-ratiodef
 */
export function contrastRatio(l1: number, l2: number): number {
  if (l1 < l2) {
    return (l2 + 0.05) / (l1 + 0.05);
  }
  return (l1 + 0.05) / (l2 + 0.05);
}
