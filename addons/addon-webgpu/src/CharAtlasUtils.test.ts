/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { configEquals } from './CharAtlasUtils';
import { ICharAtlasConfig } from './Types';
import { NULL_COLOR } from 'common/Color';
import { IColor } from 'common/Types';

function createTestConfig(overrides: Partial<ICharAtlasConfig> = {}): ICharAtlasConfig {
  const color: IColor = { css: '#ffffff', rgba: 0xffffffff };
  const contrastCache = {
    clear: () => {},
    setCss: () => {},
    getCss: () => undefined,
    setColor: () => {},
    getColor: () => undefined
  };
  const colors = {
    foreground: color,
    background: color,
    cursor: NULL_COLOR,
    cursorAccent: NULL_COLOR,
    selectionForeground: undefined,
    selectionBackgroundTransparent: NULL_COLOR,
    selectionBackgroundOpaque: NULL_COLOR,
    selectionInactiveBackgroundTransparent: NULL_COLOR,
    selectionInactiveBackgroundOpaque: NULL_COLOR,
    overviewRulerBorder: NULL_COLOR,
    scrollbarSliderBackground: NULL_COLOR,
    scrollbarSliderHoverBackground: NULL_COLOR,
    scrollbarSliderActiveBackground: NULL_COLOR,
    ansi: new Array(256).fill(color),
    contrastCache,
    halfContrastCache: contrastCache
  };
  return {
    customGlyphs: true,
    devicePixelRatio: 1,
    deviceMaxTextureSize: 4096,
    letterSpacing: 0,
    lineHeight: 1,
    fontSize: 15,
    fontFamily: 'monospace',
    fontWeight: 'normal',
    fontWeightBold: 'bold',
    deviceCellWidth: 10,
    deviceCellHeight: 20,
    deviceCharWidth: 8,
    deviceCharHeight: 16,
    allowTransparency: false,
    drawBoldTextInBrightColors: true,
    minimumContrastRatio: 1,
    colors,
    ...overrides
  };
}

describe('CharAtlasUtils', () => {
  describe('configEquals', () => {
    it('should return true for identical configs', () => {
      const a = createTestConfig();
      const b = createTestConfig();
      assert.ok(configEquals(a, b));
    });

    it('should return false when deviceMaxTextureSize differs', () => {
      const a = createTestConfig();
      const b = createTestConfig({ deviceMaxTextureSize: 8192 });
      assert.ok(!configEquals(a, b));
    });

    it('should return false when deviceCellWidth differs', () => {
      const a = createTestConfig();
      const b = createTestConfig({ deviceCellWidth: 11 });
      assert.ok(!configEquals(a, b));
    });

    it('should return false when deviceCellHeight differs', () => {
      const a = createTestConfig();
      const b = createTestConfig({ deviceCellHeight: 21 });
      assert.ok(!configEquals(a, b));
    });
  });
});
