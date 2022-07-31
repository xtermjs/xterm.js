/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICharAtlasConfig } from './Types';
import { Attributes } from 'common/buffer/Constants';
import { Terminal, FontWeight } from 'xterm';
import { IColorSet } from 'browser/Types';
import { IColor } from 'common/Types';

const NULL_COLOR: IColor = {
  css: '',
  rgba: 0
};

export function generateConfig(scaledCellWidth: number, scaledCellHeight: number, scaledCharWidth: number, scaledCharHeight: number, terminal: Terminal, colors: IColorSet): ICharAtlasConfig {
  // null out some fields that don't matter
  const clonedColors: IColorSet = {
    foreground: colors.foreground,
    background: colors.background,
    cursor: NULL_COLOR,
    cursorAccent: NULL_COLOR,
    selectionForeground: NULL_COLOR,
    selectionBackgroundTransparent: NULL_COLOR,
    selectionBackgroundOpaque: NULL_COLOR,
    selectionInactiveBackgroundTransparent: NULL_COLOR,
    selectionInactiveBackgroundOpaque: NULL_COLOR,
    // For the static char atlas, we only use the first 16 colors, but we need all 256 for the
    // dynamic character atlas.
    ansi: colors.ansi.slice(),
    contrastCache: colors.contrastCache
  };
  return {
    customGlyphs: terminal.options.customGlyphs,
    devicePixelRatio: window.devicePixelRatio,
    letterSpacing: terminal.options.letterSpacing,
    lineHeight: terminal.options.lineHeight,
    scaledCellWidth,
    scaledCellHeight,
    scaledCharWidth,
    scaledCharHeight,
    fontFamily: terminal.options.fontFamily,
    fontSize: terminal.options.fontSize,
    fontWeight: terminal.options.fontWeight,
    fontWeightBold: terminal.options.fontWeightBold,
    allowTransparency: terminal.options.allowTransparency,
    drawBoldTextInBrightColors: terminal.options.drawBoldTextInBrightColors,
    minimumContrastRatio: terminal.options.minimumContrastRatio,
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
      a.customGlyphs === b.customGlyphs &&
      a.lineHeight === b.lineHeight &&
      a.letterSpacing === b.letterSpacing &&
      a.fontFamily === b.fontFamily &&
      a.fontSize === b.fontSize &&
      a.fontWeight === b.fontWeight &&
      a.fontWeightBold === b.fontWeightBold &&
      a.allowTransparency === b.allowTransparency &&
      a.scaledCharWidth === b.scaledCharWidth &&
      a.scaledCharHeight === b.scaledCharHeight &&
      a.drawBoldTextInBrightColors === b.drawBoldTextInBrightColors &&
      a.minimumContrastRatio === b.minimumContrastRatio &&
      a.colors.foreground === b.colors.foreground &&
      a.colors.background === b.colors.background;
}

export function is256Color(colorCode: number): boolean {
  return (colorCode & Attributes.CM_MASK) === Attributes.CM_P16 || (colorCode & Attributes.CM_MASK) === Attributes.CM_P256;
}
