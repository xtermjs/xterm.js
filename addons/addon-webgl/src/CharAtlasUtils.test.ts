/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { cacheKeyBg, configEquals } from './CharAtlasUtils';
import { ICharAtlasConfig } from './Types';
import { Attributes, BgFlags, FgFlags } from 'common/buffer/Constants';
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

describe('cacheKeyBg', () => {
  const RGB_RED = Attributes.CM_RGB | 0xFF0000;
  const RGB_BLUE = Attributes.CM_RGB | 0x0000FF;
  const TRANSPARENT = { allowTransparency: true };

  it('should keep the background colour in the key by default', () => {
    // With an opaque atlas the tile is filled with the background and the
    // antialiased fringe is blended against it, so two backgrounds cannot
    // share a glyph.
    const config = createTestConfig();
    assert.notStrictEqual(
      cacheKeyBg(RGB_RED, 0, config),
      cacheKeyBg(RGB_BLUE, 0, config)
    );
    assert.strictEqual(cacheKeyBg(RGB_RED, 0, config), RGB_RED);
  });

  it('should collapse background colours when the tile cannot depend on them', () => {
    const config = createTestConfig(TRANSPARENT);
    assert.strictEqual(
      cacheKeyBg(RGB_RED, 0, config),
      cacheKeyBg(RGB_BLUE, 0, config)
    );
  });

  it('should collapse every colour mode onto the same key', () => {
    const config = createTestConfig(TRANSPARENT);
    const expected = cacheKeyBg(Attributes.CM_DEFAULT, 0, config);
    assert.strictEqual(cacheKeyBg(Attributes.CM_P16 | 3, 0, config), expected);
    assert.strictEqual(cacheKeyBg(Attributes.CM_P256 | 200, 0, config), expected);
    assert.strictEqual(cacheKeyBg(RGB_RED, 0, config), expected);
  });

  it('should keep the background flags that change what is rasterised', () => {
    // ITALIC, DIM and OVERLINE live in bg and each alters the tile, so they
    // must survive even when the colour is dropped.
    const config = createTestConfig(TRANSPARENT);
    for (const flag of [BgFlags.ITALIC, BgFlags.DIM, BgFlags.OVERLINE]) {
      assert.notStrictEqual(
        cacheKeyBg(RGB_RED | flag, 0, config),
        cacheKeyBg(RGB_RED, 0, config),
        `flag ${flag.toString(16)} was dropped from the key`
      );
      // The flag survives; only the colour is masked away.
      assert.strictEqual(cacheKeyBg(RGB_RED | flag, 0, config) & flag, flag);
      // ...and it still collapses across colours.
      assert.strictEqual(
        cacheKeyBg(RGB_RED | flag, 0, config),
        cacheKeyBg(RGB_BLUE | flag, 0, config)
      );
    }
  });

  it('should keep the background colour for inverse cells', () => {
    // Inverse promotes the background colour to the foreground, so the tile
    // depends on it after all. The flag is read from fg.
    const config = createTestConfig(TRANSPARENT);
    assert.notStrictEqual(
      cacheKeyBg(RGB_RED, FgFlags.INVERSE, config),
      cacheKeyBg(RGB_BLUE, FgFlags.INVERSE, config)
    );
    assert.strictEqual(cacheKeyBg(RGB_RED, FgFlags.INVERSE, config), RGB_RED);
  });

  it('should keep the background colour when a minimum contrast ratio is set', () => {
    // The foreground is then adjusted against the background.
    const config = createTestConfig({ ...TRANSPARENT, minimumContrastRatio: 4.5 });
    assert.notStrictEqual(
      cacheKeyBg(RGB_RED, 0, config),
      cacheKeyBg(RGB_BLUE, 0, config)
    );
  });

  it('should bound the number of keys over a background that changes per cell', () => {
    // The workload this exists for: an animated background walks the truecolor
    // space, and every glyph over it used to take its own atlas entry.
    const config = createTestConfig(TRANSPARENT);
    const keys = new Set<number>();
    for (let i = 0; i < 4096; i++) {
      keys.add(cacheKeyBg(Attributes.CM_RGB | i, 0, config));
    }
    assert.strictEqual(keys.size, 1);
  });
});
