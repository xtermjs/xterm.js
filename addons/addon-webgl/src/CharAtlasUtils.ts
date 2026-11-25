/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICharAtlasConfig } from './Types';
import { Attributes, FgFlags } from 'common/buffer/Constants';
import { ITerminalOptions } from '@xterm/xterm';
import { IColorSet, ReadonlyColorSet } from 'browser/Types';
import { NULL_COLOR } from 'common/Color';

export function generateConfig(deviceCellWidth: number, deviceCellHeight: number, deviceCharWidth: number, deviceCharHeight: number, options: Required<ITerminalOptions>, colors: ReadonlyColorSet, devicePixelRatio: number, deviceMaxTextureSize: number, customGlyphs: boolean = true): ICharAtlasConfig {
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
    overviewRulerBorder: NULL_COLOR,
    scrollbarSliderBackground: NULL_COLOR,
    scrollbarSliderHoverBackground: NULL_COLOR,
    scrollbarSliderActiveBackground: NULL_COLOR,
    // For the static char atlas, we only use the first 16 colors, but we need all 256 for the
    // dynamic character atlas.
    ansi: colors.ansi.slice(),
    contrastCache: colors.contrastCache,
    halfContrastCache: colors.halfContrastCache
  };
  return {
    customGlyphs,
    devicePixelRatio,
    deviceMaxTextureSize,
    letterSpacing: options.letterSpacing,
    lineHeight: options.lineHeight,
    deviceCellWidth: deviceCellWidth,
    deviceCellHeight: deviceCellHeight,
    deviceCharWidth: deviceCharWidth,
    deviceCharHeight: deviceCharHeight,
    fontFamily: options.fontFamily,
    fontSize: options.fontSize,
    fontWeight: options.fontWeight,
    fontWeightBold: options.fontWeightBold,
    allowTransparency: options.allowTransparency,
    drawBoldTextInBrightColors: options.drawBoldTextInBrightColors,
    minimumContrastRatio: options.minimumContrastRatio,
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
      a.deviceMaxTextureSize === b.deviceMaxTextureSize &&
      a.customGlyphs === b.customGlyphs &&
      a.lineHeight === b.lineHeight &&
      a.letterSpacing === b.letterSpacing &&
      a.fontFamily === b.fontFamily &&
      a.fontSize === b.fontSize &&
      a.fontWeight === b.fontWeight &&
      a.fontWeightBold === b.fontWeightBold &&
      a.allowTransparency === b.allowTransparency &&
      a.deviceCellWidth === b.deviceCellWidth &&
      a.deviceCellHeight === b.deviceCellHeight &&
      a.deviceCharWidth === b.deviceCharWidth &&
      a.deviceCharHeight === b.deviceCharHeight &&
      a.drawBoldTextInBrightColors === b.drawBoldTextInBrightColors &&
      a.minimumContrastRatio === b.minimumContrastRatio &&
      a.colors.foreground.rgba === b.colors.foreground.rgba &&
      a.colors.background.rgba === b.colors.background.rgba;
}

export function is256Color(colorCode: number): boolean {
  return (colorCode & Attributes.CM_MASK) === Attributes.CM_P16 || (colorCode & Attributes.CM_MASK) === Attributes.CM_P256;
}

/**
 * The `bg` component of a glyph's atlas cache key.
 *
 * `TextureAtlas._drawToCache` reads the *colour* held in `bg` in exactly three
 * places:
 *
 * - `_getBackgroundColor`, which fills the tile. It returns `NULL_COLOR` for
 *   every background when `allowTransparency` is set, because a translucent
 *   background must not be baked into the glyph.
 * - `_getMinimumContrastColor`, which adjusts the foreground against the
 *   background. It returns early when `minimumContrastRatio` is 1.
 * - the inverse swap, which promotes the background colour to the foreground.
 *
 * When none of the three apply, every background produces a pixel-identical
 * tile, and keying the cache on the background colour only multiplies the
 * atlas: one entry per glyph per colour it has ever been drawn over. Content
 * that varies the background per cell — an animated background, a heatmap, a
 * diff with highlighted regions, ANSI art — then misses on every cell of every
 * frame and grows the atlas without bound, since glyphs are never evicted.
 *
 * Only the colour bits are dropped. `bg` also carries `BgFlags`, and `ITALIC`,
 * `DIM` and `OVERLINE` each change what is rasterised, so they must stay part
 * of the key.
 *
 * `INVERSE` is read from `fg`: the flag lives there even though the swap it
 * describes is what makes the background colour matter.
 */
export function cacheKeyBg(bg: number, fg: number, config: ICharAtlasConfig): number {
  if (
    !config.allowTransparency ||
    config.minimumContrastRatio !== 1 ||
    (fg & FgFlags.INVERSE) !== 0
  ) {
    return bg;
  }
  return bg & ~(Attributes.CM_MASK | Attributes.RGB_MASK);
}
