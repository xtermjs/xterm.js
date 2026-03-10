/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { throwIfFalsy } from 'browser/renderer/shared/RendererUtils';
import { IDisposable } from 'common/Types';
import { FontWeight } from 'common/services/Services';


export const enum WidthCacheSettings {
  /** sentinel for unset values in flat cache */
  FLAT_UNSET = -9999,
  /** size of flat cache, size-1 equals highest codepoint handled by flat */
  FLAT_SIZE = 256,
  /** char repeat for measuring */
  REPEAT = 32
}


const enum FontVariant {
  REGULAR = 0,
  BOLD = 1,
  ITALIC = 2,
  BOLD_ITALIC = 3
}

export interface IWidthCacheFontVariantCanvas {
  setFont(fontFamily: string, fontSize: number, fontWeight: FontWeight, italic: boolean): void;
  measure(c: string): number;
}

export class WidthCache implements IDisposable {
  // flat cache for regular variant up to CacheSettings.FLAT_SIZE
  // NOTE: ~4x faster access than holey (serving >>80% of terminal content)
  //       It has a small memory footprint (only 1MB for full BMP caching),
  //       still the sweet spot is not reached before touching 32k different codepoints,
  //       thus we store the remaining <<20% of terminal data in a holey structure.
  protected _flat = new Float32Array(WidthCacheSettings.FLAT_SIZE);

  // holey cache for bold, italic and bold&italic for any string
  // FIXME: can grow really big over time (~8.5 MB for full BMP caching),
  //        so a shared API across terminals is needed
  protected _holey: Map<string, number> | undefined;

  private _font = '';
  private _fontSize = 0;
  private _weight: FontWeight = 'normal';
  private _weightBold: FontWeight = 'bold';
  private _canvasElements: IWidthCacheFontVariantCanvas[] = [];

  constructor(
    canvasFactory: () => IWidthCacheFontVariantCanvas = () => new WidthCacheFontVariantCanvas()
  ) {
    this._canvasElements = [
      canvasFactory(),
      canvasFactory(),
      canvasFactory(),
      canvasFactory()
    ];

    this.clear();
  }

  public dispose(): void {
    this._canvasElements.length = 0;
    this._holey = undefined; // free cache memory via GC
  }

  /**
   * Clear the width cache.
   */
  public clear(): void {
    this._flat.fill(WidthCacheSettings.FLAT_UNSET);
    // .clear() has some overhead, re-assign instead (>3 times faster)
    this._holey = new Map<string, number>();
  }

  /**
   * Set the font for measuring.
   * Must be called for any changes on font settings.
   * Also clears the cache.
   */
  public setFont(font: string, fontSize: number, weight: FontWeight, weightBold: FontWeight): void {
    // skip if nothing changed
    if (
      font === this._font &&
      fontSize === this._fontSize &&
      weight === this._weight &&
      weightBold === this._weightBold
    ) {
      return;
    }

    this._font = font;
    this._fontSize = fontSize;
    this._weight = weight;
    this._weightBold = weightBold;

    this._canvasElements[FontVariant.REGULAR].setFont(font, fontSize, weight, false);
    this._canvasElements[FontVariant.BOLD].setFont(font, fontSize, weightBold, false);
    this._canvasElements[FontVariant.ITALIC].setFont(font, fontSize, weight, true);
    this._canvasElements[FontVariant.BOLD_ITALIC].setFont(font, fontSize, weightBold, true);

    this.clear();
  }

  /**
   * Get the render width for cell content `c` with current font settings.
   * `variant` denotes the font variant to be used.
   */
  public get(c: string, bold: boolean | number, italic: boolean | number): number {
    let cp = 0;
    if (!bold && !italic && c.length === 1 && (cp = c.charCodeAt(0)) < WidthCacheSettings.FLAT_SIZE) {
      if (this._flat[cp] !== WidthCacheSettings.FLAT_UNSET) {
        return this._flat[cp];
      }
      const width = this._measure(c, 0);
      if (width > 0) {
        this._flat[cp] = width;
      }
      return width;
    }
    let key = c;
    if (bold) key += 'B';
    if (italic) key += 'I';
    let width = this._holey!.get(key);
    if (width === undefined) {
      let variant = 0;
      if (bold) variant |= FontVariant.BOLD;
      if (italic) variant |= FontVariant.ITALIC;
      width = this._measure(c, variant);
      if (width > 0) {
        this._holey!.set(key, width);
      }
    }
    return width;
  }

  protected _measure(c: string, variant: FontVariant): number {
    return this._canvasElements[variant].measure(c);
  }
}

class WidthCacheFontVariantCanvas implements IWidthCacheFontVariantCanvas {
  private _canvas: OffscreenCanvas | HTMLCanvasElement;
  private _ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

  constructor() {
    if (typeof OffscreenCanvas !== 'undefined') {
      this._canvas = new OffscreenCanvas(1, 1);
      this._ctx = throwIfFalsy(this._canvas.getContext('2d'));
    } else {
      this._canvas = document.createElement('canvas');
      this._canvas.width = 1;
      this._canvas.height = 1;
      this._ctx = throwIfFalsy(this._canvas.getContext('2d'));
    }
  }

  public setFont(fontFamily: string, fontSize: number, fontWeight: FontWeight, italic: boolean): void {
    const fontStyle = italic ? 'italic' : '';
    this._ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`.trim();
  }

  public measure(c: string): number {
    return this._ctx.measureText(c).width;
  }
}
