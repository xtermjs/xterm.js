/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from 'common/Types';


export const enum FontVariant {
  REGULAR = 0,
  BOLD = 1,
  ITALIC = 2,
  BOLD_ITALIC = 3
}


const enum CacheSettings {
  FLAT_UNSET = -9999,   // sentinel for unset values in flat cache
  FLAT_SIZE = 256,      // codepoint upper bound to handle in flat cache
  REPEAT = 32           // char repeat for measuring
}


export class SpacingCache implements IDisposable {
  // flat cache for regular
  private _flat = new Float32Array(CacheSettings.FLAT_SIZE);
  // holey cache for bold, italic and bold&italic for any string
  private _holey = new Map<string, number>();

  private _font = '';
  private _fontSize = 0;
  private _container: HTMLDivElement;
  private _measureElements: HTMLSpanElement[] = [];

  constructor(
    private readonly _document: Document
  ) {
    this._container = _document.createElement('div');
    this._container.style.position = 'absolute';
    this._container.style.top = '-50000px';
    this._container.style.width = '50000px';
    this._container.style.whiteSpace = 'pre';
    // avoid undercuts in non-monospace fonts from kerning
    this._container.style.fontKerning = 'none';

    const regular = _document.createElement('span');

    const bold = _document.createElement('span');
    bold.style.fontWeight = 'bold';

    const italic = _document.createElement('span');
    italic.style.fontStyle = 'italic';

    const boldItalic = _document.createElement('span');
    boldItalic.style.fontWeight = 'bold';
    boldItalic.style.fontStyle = 'italic';

    // note: must be in order of FontVariant values
    this._measureElements = [regular, bold, italic, boldItalic];
    this._container.appendChild(regular);
    this._container.appendChild(bold);
    this._container.appendChild(italic);
    this._container.appendChild(boldItalic);

    _document.body.appendChild(this._container);

    this.clear();
  }

  public dispose(): void {
    this._container.remove();
    this._measureElements.length = 0;
    this._holey.clear();
  }

  /**
   * Clear the spacing cache.
   */
  public clear(): void {
    this._flat.fill(CacheSettings.FLAT_UNSET);
    this._holey.clear();
  }

  /**
   * Set the font for measuring.
   * Must be called for any fontFamily or fontSize changes.
   * Also clears the cache.
   */
  public setFont(font: string, fontSize: number): void {
    if (font !== this._font || fontSize !== this._fontSize) {
      this._font = font;
      this._fontSize = fontSize;
      this.clear();

      this._container.style.fontFamily = this._font;
      this._container.style.fontSize = `${this._fontSize}px`;
    }
  }

  /**
   * Get the letter-spacing value for cell content `c`.
   * `c` should be the cell content obtained from `cell.getChars()`.
   * `pixelWidth` is the standard width the cell should render with
   * and can be calculated by `cell.getWidth() * cellWidth`.
   * `variant` denotes the font variant to be used.
   *
   * Returns the letter-spacing value, so that `c` renders aligned to `pixelWidth`.
   */
  public get(c: string, pixelWidth: number, variant: FontVariant): number {
    let cp = 0;
    if (!variant && c.length === 1 && (cp = c.charCodeAt(0)) < CacheSettings.FLAT_SIZE) {
      return this._flat[cp] !== CacheSettings.FLAT_UNSET
        ? this._flat[cp]
        : (this._flat[cp] = pixelWidth - this._measure(c, 0));
    }
    let key = c;
    if (variant & FontVariant.BOLD) key += 'B';
    if (variant & FontVariant.ITALIC) key += 'I';
    let spacing = this._holey.get(key);
    if (spacing === undefined) {
      spacing = pixelWidth - this._measure(c, variant);
      this._holey.set(key, spacing);
    }
    return spacing;
  }

  private _measure(c: string, variant: FontVariant): number {
    const el = this._measureElements[variant];
    el.textContent = c.repeat(CacheSettings.REPEAT);
    return el.getBoundingClientRect().width / CacheSettings.REPEAT;
  }
}
