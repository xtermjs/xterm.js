/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICharAtlasConfig } from 'browser/renderer/atlas/Types';
import { DEFAULT_COLOR } from 'common/buffer/Constants';
import { IColorSet, IPartialColorSet } from 'browser/Types';
import { ITerminalOptions } from 'common/services/Services';

export function generateConfig(scaledCharWidth: number, scaledCharHeight: number, options: ITerminalOptions, colors: IColorSet): ICharAtlasConfig {
  // null out some fields that don't matter
  const clonedColors = <IPartialColorSet>{
    foreground: colors.foreground,
    background: colors.background,
    cursor: undefined,
    cursorAccent: undefined,
    selection: undefined,
    ansi: colors.ansi
  };
  return {
    devicePixelRatio: window.devicePixelRatio,
    scaledCharWidth,
    scaledCharHeight,
    fontFamily: options.fontFamily,
    fontSize: options.fontSize,
    fontWeight: options.fontWeight,
    fontWeightBold: options.fontWeightBold,
    allowTransparency: options.allowTransparency,
    colors: clonedColors
  };
}

export function configEquals(a: ICharAtlasConfig, b: ICharAtlasConfig): boolean {
  for (let i = 0; i < a.colors.ansi.length; i++) {
    if (a.colors.ansi[i].rgba !== b.colors.ansi[i].rgba) {
      return false;
    }
  }
  return a.devicePixelRatio === b.devicePixelRatio &&
      a.fontFamily === b.fontFamily &&
      a.fontSize === b.fontSize &&
      a.fontWeight === b.fontWeight &&
      a.fontWeightBold === b.fontWeightBold &&
      a.allowTransparency === b.allowTransparency &&
      a.scaledCharWidth === b.scaledCharWidth &&
      a.scaledCharHeight === b.scaledCharHeight &&
      a.colors.foreground === b.colors.foreground &&
      a.colors.background === b.colors.background;
}

export function is256Color(colorCode: number): boolean {
  return colorCode < DEFAULT_COLOR;
}
