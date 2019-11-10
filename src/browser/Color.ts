/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IColor } from './Types';

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
  const css = toCss(r, g, b);
  const rgba = toRgba(r, g, b);
  return { css, rgba };
}

export function fromCss(css: string): IColor {
  return {
    css,
    rgba: (parseInt(css.slice(1), 16) << 8 | 0xFF) >>> 0
  };
}

export function toPaddedHex(c: number): string {
  const s = c.toString(16);
  return s.length < 2 ? '0' + s : s;
}

export function toCss(r: number, g: number, b: number): string {
  return `#${toPaddedHex(r)}${toPaddedHex(g)}${toPaddedHex(b)}`;
}

export function toRgba(r: number, g: number, b: number, a: number = 0xFF): number {
  // >>> 0 forces an unsigned int
  return (r << 24 | g << 16 | b << 8 | a) >>> 0;
}
