/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ColorContrastCache } from '../ColorContrastCache';
import { IThemeService } from './Services';
import { IColorContrastCache, IColorSet, ReadonlyColorSet } from '../Types';
import { color, NULL_COLOR } from '../../common/Color';
import { Disposable } from '../../common/Lifecycle';
import { IOptionsService, ITheme } from '../../common/services/Services';
import { AllColorIndex } from '../../common/Types';
import { ColorPalette, DEFAULT_FOREGROUND, DEFAULT_BACKGROUND, parseColor } from '../../common/ColorPalette';
import { Emitter } from '../../common/Event';

const DEFAULT_CURSOR_ACCENT = DEFAULT_BACKGROUND;
const DEFAULT_SELECTION = {
  css: 'rgba(255, 255, 255, 0.3)',
  rgba: 0xFFFFFF4D
};
const DEFAULT_OVERVIEW_RULER_BORDER = DEFAULT_FOREGROUND;

export class ThemeService extends Disposable implements IThemeService {
  public serviceBrand: undefined;

  private _colors: IColorSet;
  private _contrastCache: IColorContrastCache = new ColorContrastCache();
  private _halfContrastCache: IColorContrastCache = new ColorContrastCache();
  private readonly _palette = new ColorPalette();

  public get colors(): ReadonlyColorSet { return this._colors; }

  private readonly _onChangeColors = this._register(new Emitter<ReadonlyColorSet>());
  public readonly onChangeColors = this._onChangeColors.event;

  constructor(
    @IOptionsService private readonly _optionsService: IOptionsService
  ) {
    super();

    // Protocol updates and rendering must use the same mutable palette.
    this._colors = Object.assign(this._palette.colors, {
      cursorAccent: DEFAULT_CURSOR_ACCENT,
      selectionForeground: undefined,
      selectionBackgroundTransparent: DEFAULT_SELECTION,
      selectionBackgroundOpaque: color.blend(DEFAULT_BACKGROUND, DEFAULT_SELECTION),
      selectionInactiveBackgroundTransparent: DEFAULT_SELECTION,
      selectionInactiveBackgroundOpaque: color.blend(DEFAULT_BACKGROUND, DEFAULT_SELECTION),
      scrollbarSliderBackground: color.opacity(DEFAULT_FOREGROUND, 0.2),
      scrollbarSliderHoverBackground: color.opacity(DEFAULT_FOREGROUND, 0.4),
      scrollbarSliderActiveBackground: color.opacity(DEFAULT_FOREGROUND, 0.5),
      overviewRulerBorder: DEFAULT_FOREGROUND,
      contrastCache: this._contrastCache,
      halfContrastCache: this._halfContrastCache
    });
    this._setTheme(this._optionsService.rawOptions.theme);

    this._register(this._optionsService.onSpecificOptionChange('minimumContrastRatio', () => this._contrastCache.clear()));
    this._register(this._optionsService.onSpecificOptionChange('theme', () => this._setTheme(this._optionsService.rawOptions.theme)));
  }

  /**
   * Sets the terminal's theme.
   * @param theme The  theme to use. If a partial theme is provided then default
   * colors will be used where colors are not defined.
   */
  private _setTheme(theme: ITheme = {}): void {
    const colors = this._colors;
    this._palette.setTheme(theme);
    colors.cursorAccent = color.blend(colors.background, parseColor(theme.cursorAccent, DEFAULT_CURSOR_ACCENT));
    colors.selectionBackgroundTransparent = parseColor(theme.selectionBackground, DEFAULT_SELECTION);
    colors.selectionBackgroundOpaque = color.blend(colors.background, colors.selectionBackgroundTransparent);
    colors.selectionInactiveBackgroundTransparent = parseColor(theme.selectionInactiveBackground, colors.selectionBackgroundTransparent);
    colors.selectionInactiveBackgroundOpaque = color.blend(colors.background, colors.selectionInactiveBackgroundTransparent);
    colors.selectionForeground = theme.selectionForeground ? parseColor(theme.selectionForeground, NULL_COLOR) : undefined;
    if (colors.selectionForeground === NULL_COLOR) {
      colors.selectionForeground = undefined;
    }

    /**
     * If selection color is opaque, blend it with background with 0.3 opacity
     * Issue #2737
     */
    if (color.isOpaque(colors.selectionBackgroundTransparent)) {
      const opacity = 0.3;
      colors.selectionBackgroundTransparent = color.opacity(colors.selectionBackgroundTransparent, opacity);
    }
    if (color.isOpaque(colors.selectionInactiveBackgroundTransparent)) {
      const opacity = 0.3;
      colors.selectionInactiveBackgroundTransparent = color.opacity(colors.selectionInactiveBackgroundTransparent, opacity);
    }
    colors.scrollbarSliderBackground = parseColor(theme.scrollbarSliderBackground, color.opacity(colors.foreground, 0.2));
    colors.scrollbarSliderHoverBackground = parseColor(theme.scrollbarSliderHoverBackground, color.opacity(colors.foreground, 0.4));
    colors.scrollbarSliderActiveBackground = parseColor(theme.scrollbarSliderActiveBackground, color.opacity(colors.foreground, 0.5));
    colors.overviewRulerBorder = parseColor(theme.overviewRulerBorder, DEFAULT_OVERVIEW_RULER_BORDER);
    // Clear the cache
    this._contrastCache.clear();
    this._halfContrastCache.clear();
    this._onChangeColors.fire(this.colors);
  }

  public restoreColor(slot?: AllColorIndex): void {
    this._palette.restoreColor(slot);
    this._onChangeColors.fire(this.colors);
  }

  public modifyColors(callback: (colors: IColorSet) => void): void {
    callback(this._colors);
    // Assume the change happened
    this._onChangeColors.fire(this.colors);
  }
}
