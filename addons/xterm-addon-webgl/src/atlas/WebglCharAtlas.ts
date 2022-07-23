/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICharAtlasConfig } from './Types';
import { DIM_OPACITY, TEXT_BASELINE } from 'browser/renderer/atlas/Constants';
import { IRasterizedGlyph, IBoundingBox, IRasterizedGlyphSet } from '../Types';
import { DEFAULT_COLOR, Attributes, DEFAULT_EXT, UnderlineStyle } from 'common/buffer/Constants';
import { throwIfFalsy } from '../WebglUtils';
import { IColor } from 'common/Types';
import { IDisposable } from 'xterm';
import { AttributeData } from 'common/buffer/AttributeData';
import { color, rgba } from 'common/Color';
import { tryDrawCustomChar } from 'browser/renderer/CustomGlyphs';
import { excludeFromContrastRatioDemands, isPowerlineGlyph } from 'browser/renderer/RendererUtils';

// For debugging purposes, it can be useful to set this to a really tiny value,
// to verify that LRU eviction works.
const TEXTURE_WIDTH = 1024;
const TEXTURE_HEIGHT = 1024;

/**
 * The amount of the texture to be filled before throwing it away and starting
 * again. Since the throw away and individual glyph draws don't cost too much,
 * this prevent juggling multiple textures in the GL context.
 */
const TEXTURE_CAPACITY = Math.floor(TEXTURE_HEIGHT * 0.8);

const TRANSPARENT_COLOR = {
  css: 'rgba(0, 0, 0, 0)',
  rgba: 0
};

/**
 * A shared object which is used to draw nothing for a particular cell.
 */
const NULL_RASTERIZED_GLYPH: IRasterizedGlyph = {
  offset: { x: 0, y: 0 },
  texturePosition: { x: 0, y: 0 },
  texturePositionClipSpace: { x: 0, y: 0 },
  size: { x: 0, y: 0 },
  sizeClipSpace: { x: 0, y: 0 }
};

const TMP_CANVAS_GLYPH_PADDING = 2;

export class WebglCharAtlas implements IDisposable {
  private _didWarmUp: boolean = false;

  private _cacheMap: { [code: number]: IRasterizedGlyphSet } = {};
  private _cacheMapCombined: { [chars: string]: IRasterizedGlyphSet } = {};

  // The texture that the atlas is drawn to
  public cacheCanvas: HTMLCanvasElement;
  private _cacheCtx: CanvasRenderingContext2D;

  private _tmpCanvas: HTMLCanvasElement;
  // A temporary context that glyphs are drawn to before being transfered to the atlas.
  private _tmpCtx: CanvasRenderingContext2D;

  // Since glyphs are expected to be around the same height, the packing
  // strategy used it to fill a row with glyphs while keeping track of the
  // tallest glyph in the row. Once the row is full a new row is started at
  // (0,lastRow+lastRowTallestGlyph).
  private _currentRowY: number = 0;
  private _currentRowX: number = 0;
  private _currentRowHeight: number = 0;

  public hasCanvasChanged = false;

  private _workBoundingBox: IBoundingBox = { top: 0, left: 0, bottom: 0, right: 0 };
  private _workAttributeData: AttributeData = new AttributeData();

  constructor(
    document: Document,
    private _config: ICharAtlasConfig
  ) {
    this.cacheCanvas = document.createElement('canvas');
    this.cacheCanvas.width = TEXTURE_WIDTH;
    this.cacheCanvas.height = TEXTURE_HEIGHT;
    // The canvas needs alpha because we use clearColor to convert the background color to alpha.
    // It might also contain some characters with transparent backgrounds if allowTransparency is
    // set.
    this._cacheCtx = throwIfFalsy(this.cacheCanvas.getContext('2d', { alpha: true }));

    this._tmpCanvas = document.createElement('canvas');
    this._tmpCanvas.width = this._config.scaledCellWidth * 4 + TMP_CANVAS_GLYPH_PADDING * 2;
    this._tmpCanvas.height = this._config.scaledCellHeight + TMP_CANVAS_GLYPH_PADDING * 2;
    this._tmpCtx = throwIfFalsy(this._tmpCanvas.getContext('2d', { alpha: this._config.allowTransparency }));
  }

  public dispose(): void {
    if (this.cacheCanvas.parentElement) {
      this.cacheCanvas.parentElement.removeChild(this.cacheCanvas);
    }
  }

  public warmUp(): void {
    if (!this._didWarmUp) {
      this._doWarmUp();
      this._didWarmUp = true;
    }
  }

  private _doWarmUp(): void {
    // Pre-fill with ASCII 33-126
    for (let i = 33; i < 126; i++) {
      const rasterizedGlyph = this._drawToCache(i, DEFAULT_COLOR, DEFAULT_COLOR, DEFAULT_EXT);
      this._cacheMap[i] = {
        [DEFAULT_COLOR]: {
          [DEFAULT_COLOR]: {
            [DEFAULT_EXT]: rasterizedGlyph
          }
        }
      };
    }
  }

  public beginFrame(): boolean {
    if (this._currentRowY > TEXTURE_CAPACITY) {
      this.clearTexture();
      this.warmUp();
      return true;
    }
    return false;
  }

  public clearTexture(): void {
    if (this._currentRowX === 0 && this._currentRowY === 0) {
      return;
    }
    this._cacheCtx.clearRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
    this._cacheMap = {};
    this._cacheMapCombined = {};
    this._currentRowHeight = 0;
    this._currentRowX = 0;
    this._currentRowY = 0;
    this._didWarmUp = false;
  }

  public getRasterizedGlyphCombinedChar(chars: string, bg: number, fg: number, ext: number): IRasterizedGlyph {
    return this._getFromCacheMap(this._cacheMapCombined, chars, bg, fg, ext);
  }

  public getRasterizedGlyph(code: number, bg: number, fg: number, ext: number): IRasterizedGlyph {
    return this._getFromCacheMap(this._cacheMap, code, bg, fg, ext);
  }

  /**
   * Gets the glyphs texture coords, drawing the texture if it's not already
   */
  private _getFromCacheMap(
    cacheMap: { [key: string | number]: IRasterizedGlyphSet },
    key: string | number,
    bg: number,
    fg: number,
    ext: number
  ): IRasterizedGlyph {
    let rasterizedGlyphSet = cacheMap[key];
    if (!rasterizedGlyphSet) {
      rasterizedGlyphSet = {};
      this._cacheMapCombined[key] = rasterizedGlyphSet;
    }

    let rasterizedGlyphSetBg = rasterizedGlyphSet[bg];
    if (!rasterizedGlyphSetBg) {
      rasterizedGlyphSetBg = {};
      rasterizedGlyphSet[bg] = rasterizedGlyphSetBg;
    }

    let rasterizedGlyph: IRasterizedGlyph | undefined;
    let rasterizedGlyphSetFg = rasterizedGlyphSetBg[fg];
    if (!rasterizedGlyphSetFg) {
      rasterizedGlyphSetFg = {};
      rasterizedGlyphSetBg[fg] = rasterizedGlyphSetFg;
    } else {
      rasterizedGlyph = rasterizedGlyphSetFg[ext];
    }

    if (!rasterizedGlyph) {
      rasterizedGlyph = this._drawToCache(key, bg, fg, ext);
      rasterizedGlyphSetFg[ext] = rasterizedGlyph;
    }

    return rasterizedGlyph;
  }

  private _getColorFromAnsiIndex(idx: number): IColor {
    if (idx >= this._config.colors.ansi.length) {
      throw new Error('No color found for idx ' + idx);
    }
    return this._config.colors.ansi[idx];
  }

  private _getBackgroundColor(bgColorMode: number, bgColor: number, inverse: boolean): IColor {
    if (this._config.allowTransparency) {
      // The background color might have some transparency, so we need to render it as fully
      // transparent in the atlas. Otherwise we'd end up drawing the transparent background twice
      // around the anti-aliased edges of the glyph, and it would look too dark.
      return TRANSPARENT_COLOR;
    }

    switch (bgColorMode) {
      case Attributes.CM_P16:
      case Attributes.CM_P256:
        return this._getColorFromAnsiIndex(bgColor);
      case Attributes.CM_RGB:
        const arr = AttributeData.toColorRGB(bgColor);
        // TODO: This object creation is slow
        return {
          rgba: bgColor << 8,
          css: `#${toPaddedHex(arr[0])}${toPaddedHex(arr[1])}${toPaddedHex(arr[2])}`
        };
      case Attributes.CM_DEFAULT:
      default:
        if (inverse) {
          return this._config.colors.foreground;
        }
        return this._config.colors.background;
    }
  }

  private _getForegroundColor(bg: number, bgColorMode: number, bgColor: number, fg: number, fgColorMode: number, fgColor: number, inverse: boolean, bold: boolean, excludeFromContrastRatioDemands: boolean): IColor {
    const minimumContrastColor = this._getMinimumContrastColor(bg, bgColorMode, bgColor, fg, fgColorMode, fgColor, inverse, bold, excludeFromContrastRatioDemands);
    if (minimumContrastColor) {
      return minimumContrastColor;
    }

    switch (fgColorMode) {
      case Attributes.CM_P16:
      case Attributes.CM_P256:
        if (this._config.drawBoldTextInBrightColors && bold && fgColor < 8) {
          fgColor += 8;
        }
        return this._getColorFromAnsiIndex(fgColor);
      case Attributes.CM_RGB:
        const arr = AttributeData.toColorRGB(fgColor);
        return rgba.toColor(arr[0], arr[1], arr[2]);
      case Attributes.CM_DEFAULT:
      default:
        if (inverse) {
          // Inverse should always been opaque, even when transparency is used
          return color.opaque(this._config.colors.background);
        }
        return this._config.colors.foreground;
    }
  }

  private _resolveBackgroundRgba(bgColorMode: number, bgColor: number, inverse: boolean): number {
    switch (bgColorMode) {
      case Attributes.CM_P16:
      case Attributes.CM_P256:
        return this._getColorFromAnsiIndex(bgColor).rgba;
      case Attributes.CM_RGB:
        return bgColor << 8;
      case Attributes.CM_DEFAULT:
      default:
        if (inverse) {
          return this._config.colors.foreground.rgba;
        }
        return this._config.colors.background.rgba;
    }
  }

  private _resolveForegroundRgba(fgColorMode: number, fgColor: number, inverse: boolean, bold: boolean): number {
    switch (fgColorMode) {
      case Attributes.CM_P16:
      case Attributes.CM_P256:
        if (this._config.drawBoldTextInBrightColors && bold && fgColor < 8) {
          fgColor += 8;
        }
        return this._getColorFromAnsiIndex(fgColor).rgba;
      case Attributes.CM_RGB:
        return fgColor << 8;
      case Attributes.CM_DEFAULT:
      default:
        if (inverse) {
          return this._config.colors.background.rgba;
        }
        return this._config.colors.foreground.rgba;
    }
  }

  private _getMinimumContrastColor(bg: number, bgColorMode: number, bgColor: number, fg: number, fgColorMode: number, fgColor: number, inverse: boolean, bold: boolean, excludeFromContrastRatioDemands: boolean): IColor | undefined {
    if (this._config.minimumContrastRatio === 1 || excludeFromContrastRatioDemands) {
      return undefined;
    }

    // Try get from cache first
    const adjustedColor = this._config.colors.contrastCache.getColor(bg, fg);
    if (adjustedColor !== undefined) {
      return adjustedColor || undefined;
    }

    const bgRgba = this._resolveBackgroundRgba(bgColorMode, bgColor, inverse);
    const fgRgba = this._resolveForegroundRgba(fgColorMode, fgColor, inverse, bold);
    const result = rgba.ensureContrastRatio(bgRgba, fgRgba, this._config.minimumContrastRatio);

    if (!result) {
      this._config.colors.contrastCache.setColor(bg, fg, null);
      return undefined;
    }

    const color = rgba.toColor(
      (result >> 24) & 0xFF,
      (result >> 16) & 0xFF,
      (result >> 8) & 0xFF
    );
    this._config.colors.contrastCache.setColor(bg, fg, color);

    return color;
  }

  private _drawToCache(codeOrChars: number | string, bg: number, fg: number, ext: number): IRasterizedGlyph {
    const chars = typeof codeOrChars === 'number' ? String.fromCharCode(codeOrChars) : codeOrChars;

    this.hasCanvasChanged = true;

    // Allow 1 cell width per character, with a minimum of 2 (CJK), plus some padding. This is used
    // to draw the glyph to the canvas as well as to restrict the bounding box search to ensure
    // giant ligatures (eg. =====>) don't impact overall performance.
    const allowedWidth = this._config.scaledCellWidth * Math.max(chars.length, 2) + TMP_CANVAS_GLYPH_PADDING * 2;
    if (this._tmpCanvas.width < allowedWidth) {
      this._tmpCanvas.width = allowedWidth;
    }
    // Include line height when drawing glyphs
    const allowedHeight = this._config.scaledCellHeight + TMP_CANVAS_GLYPH_PADDING * 2;
    if (this._tmpCanvas.height < allowedHeight) {
      this._tmpCanvas.height = allowedHeight;
    }
    this._tmpCtx.save();

    this._workAttributeData.fg = fg;
    this._workAttributeData.bg = bg;
    // TODO: Use packed ext format
    this._workAttributeData.extended.underlineStyle = ext;

    const invisible = !!this._workAttributeData.isInvisible();
    if (invisible) {
      return NULL_RASTERIZED_GLYPH;
    }

    const bold = !!this._workAttributeData.isBold();
    const inverse = !!this._workAttributeData.isInverse();
    const dim = !!this._workAttributeData.isDim();
    const italic = !!this._workAttributeData.isItalic();
    const underline = !!this._workAttributeData.isUnderline();
    const strikethrough = !!this._workAttributeData.isStrikethrough();
    let fgColor = this._workAttributeData.getFgColor();
    let fgColorMode = this._workAttributeData.getFgColorMode();
    let bgColor = this._workAttributeData.getBgColor();
    let bgColorMode = this._workAttributeData.getBgColorMode();
    if (inverse) {
      const temp = fgColor;
      fgColor = bgColor;
      bgColor = temp;
      const temp2 = fgColorMode;
      fgColorMode = bgColorMode;
      bgColorMode = temp2;
    }

    // draw the background
    const backgroundColor = this._getBackgroundColor(bgColorMode, bgColor, inverse);
    // Use a 'copy' composite operation to clear any existing glyph out of _tmpCtxWithAlpha, regardless of
    // transparency in backgroundColor
    this._tmpCtx.globalCompositeOperation = 'copy';
    this._tmpCtx.fillStyle = backgroundColor.css;
    this._tmpCtx.fillRect(0, 0, this._tmpCanvas.width, this._tmpCanvas.height);
    this._tmpCtx.globalCompositeOperation = 'source-over';

    // draw the foreground/glyph
    const fontWeight = bold ? this._config.fontWeightBold : this._config.fontWeight;
    const fontStyle = italic ? 'italic' : '';
    this._tmpCtx.font =
      `${fontStyle} ${fontWeight} ${this._config.fontSize * this._config.devicePixelRatio}px ${this._config.fontFamily}`;
    this._tmpCtx.textBaseline = TEXT_BASELINE;

    const powerLineGlyph = chars.length === 1 && isPowerlineGlyph(chars.charCodeAt(0));
    const foregroundColor = this._getForegroundColor(bg, bgColorMode, bgColor, fg, fgColorMode, fgColor, inverse, bold, excludeFromContrastRatioDemands(chars.charCodeAt(0)));
    this._tmpCtx.fillStyle = foregroundColor.css;

    // Apply alpha to dim the character
    if (dim) {
      this._tmpCtx.globalAlpha = DIM_OPACITY;
    }

    // For powerline glyphs left/top padding is excluded (https://github.com/microsoft/vscode/issues/120129)
    const padding = powerLineGlyph ? 0 : TMP_CANVAS_GLYPH_PADDING;

    // Draw custom characters if applicable
    let drawSuccess = false;
    if (this._config.customGlyphs !== false) {
      drawSuccess = tryDrawCustomChar(this._tmpCtx, chars, padding, padding, this._config.scaledCellWidth, this._config.scaledCellHeight);
    }

    // Draw the character
    if (!drawSuccess) {
      this._tmpCtx.fillText(chars, padding, padding + this._config.scaledCharHeight);
    }

    // If this charcater is underscore and beyond the cell bounds, shift it up until it is visible,
    // try for a maximum of 5 pixels.
    if (chars === '_' && !this._config.allowTransparency) {
      let isBeyondCellBounds = clearColor(this._tmpCtx.getImageData(padding, padding, this._config.scaledCellWidth, this._config.scaledCellHeight), backgroundColor, foregroundColor, this._config.allowTransparency);
      if (isBeyondCellBounds) {
        for (let offset = 1; offset <= 5; offset++) {
          this._tmpCtx.clearRect(0, 0, this._tmpCanvas.width, this._tmpCanvas.height);
          this._tmpCtx.fillText(chars, padding, padding + this._config.scaledCharHeight - offset);
          isBeyondCellBounds = clearColor(this._tmpCtx.getImageData(padding, padding, this._config.scaledCellWidth, this._config.scaledCellHeight), backgroundColor, foregroundColor, this._config.allowTransparency);
          if (!isBeyondCellBounds) {
            break;
          }
        }
      }
    }

    // Draw underline and strikethrough
    if (underline || strikethrough) {
      const lineWidth = Math.max(1, Math.floor(this._config.fontSize / 10));
      const yOffset = this._tmpCtx.lineWidth % 2 === 1 ? 0.5 : 0; // When the width is odd, draw at 0.5 position
      this._tmpCtx.lineWidth = lineWidth;
      this._tmpCtx.strokeStyle = this._tmpCtx.fillStyle;
      this._tmpCtx.beginPath();
      if (underline) {
        console.log('underline', this._workAttributeData.extended.underlineStyle);
        switch (this._workAttributeData.extended.underlineStyle) {
          case UnderlineStyle.DOUBLE:
            break;
          case UnderlineStyle.CURLY:
            break;
          case UnderlineStyle.DOTTED:
            break;
          case UnderlineStyle.DASHED:
            break;
          case UnderlineStyle.SINGLE:
          default:
            this._tmpCtx.moveTo(padding, padding + this._config.scaledCharHeight - yOffset);
            this._tmpCtx.lineTo(padding + this._config.scaledCharWidth, padding + this._config.scaledCharHeight - yOffset);
            break;
        }
      }
      if (strikethrough) {
        this._tmpCtx.moveTo(padding, padding + Math.floor(this._config.scaledCharHeight / 2) - yOffset);
        this._tmpCtx.lineTo(padding + this._config.scaledCharWidth, padding + Math.floor(this._config.scaledCharHeight / 2) - yOffset);
      }
      this._tmpCtx.stroke();
      this._tmpCtx.closePath();
    }

    this._tmpCtx.restore();

    // clear the background from the character to avoid issues with drawing over the previous
    // character if it extends past it's bounds
    const imageData = this._tmpCtx.getImageData(
      0, 0, this._tmpCanvas.width, this._tmpCanvas.height
    );

    // Clear out the background color and determine if the glyph is empty.
    const isEmpty = clearColor(imageData, backgroundColor, foregroundColor, this._config.allowTransparency);

    // Handle empty glyphs
    if (isEmpty) {
      return NULL_RASTERIZED_GLYPH;
    }

    const rasterizedGlyph = this._findGlyphBoundingBox(imageData, this._workBoundingBox, allowedWidth, powerLineGlyph, drawSuccess);
    const clippedImageData = this._clipImageData(imageData, this._workBoundingBox);

    // Check if there is enough room in the current row and go to next if needed
    if (this._currentRowX + rasterizedGlyph.size.x > TEXTURE_WIDTH) {
      this._currentRowX = 0;
      this._currentRowY += this._currentRowHeight;
      this._currentRowHeight = 0;
    }

    // Record texture position
    rasterizedGlyph.texturePosition.x = this._currentRowX;
    rasterizedGlyph.texturePosition.y = this._currentRowY;
    rasterizedGlyph.texturePositionClipSpace.x = this._currentRowX / TEXTURE_WIDTH;
    rasterizedGlyph.texturePositionClipSpace.y = this._currentRowY / TEXTURE_HEIGHT;

    // Update atlas current row
    this._currentRowHeight = Math.max(this._currentRowHeight, rasterizedGlyph.size.y);
    this._currentRowX += rasterizedGlyph.size.x;

    // putImageData doesn't do any blending, so it will overwrite any existing cache entry for us
    this._cacheCtx.putImageData(clippedImageData, rasterizedGlyph.texturePosition.x, rasterizedGlyph.texturePosition.y);

    return rasterizedGlyph;
  }

  /**
   * Given an ImageData object, find the bounding box of the non-transparent
   * portion of the texture and return an IRasterizedGlyph with these
   * dimensions.
   * @param imageData The image data to read.
   * @param boundingBox An IBoundingBox to put the clipped bounding box values.
   */
  private _findGlyphBoundingBox(imageData: ImageData, boundingBox: IBoundingBox, allowedWidth: number, restrictedGlyph: boolean, customGlyph: boolean): IRasterizedGlyph {
    boundingBox.top = 0;
    const height = restrictedGlyph ? this._config.scaledCellHeight : this._tmpCanvas.height;
    const width = restrictedGlyph ? this._config.scaledCharWidth : allowedWidth;
    let found = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alphaOffset = y * this._tmpCanvas.width * 4 + x * 4 + 3;
        if (imageData.data[alphaOffset] !== 0) {
          boundingBox.top = y;
          found = true;
          break;
        }
      }
      if (found) {
        break;
      }
    }
    boundingBox.left = 0;
    found = false;
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const alphaOffset = y * this._tmpCanvas.width * 4 + x * 4 + 3;
        if (imageData.data[alphaOffset] !== 0) {
          boundingBox.left = x;
          found = true;
          break;
        }
      }
      if (found) {
        break;
      }
    }
    boundingBox.right = width;
    found = false;
    for (let x = width - 1; x >= 0; x--) {
      for (let y = 0; y < height; y++) {
        const alphaOffset = y * this._tmpCanvas.width * 4 + x * 4 + 3;
        if (imageData.data[alphaOffset] !== 0) {
          boundingBox.right = x;
          found = true;
          break;
        }
      }
      if (found) {
        break;
      }
    }
    boundingBox.bottom = height;
    found = false;
    for (let y = height - 1; y >= 0; y--) {
      for (let x = 0; x < width; x++) {
        const alphaOffset = y * this._tmpCanvas.width * 4 + x * 4 + 3;
        if (imageData.data[alphaOffset] !== 0) {
          boundingBox.bottom = y;
          found = true;
          break;
        }
      }
      if (found) {
        break;
      }
    }
    return {
      texturePosition: { x: 0, y: 0 },
      texturePositionClipSpace: { x: 0, y: 0 },
      size: {
        x: boundingBox.right - boundingBox.left + 1,
        y: boundingBox.bottom - boundingBox.top + 1
      },
      sizeClipSpace: {
        x: (boundingBox.right - boundingBox.left + 1) / TEXTURE_WIDTH,
        y: (boundingBox.bottom - boundingBox.top + 1) / TEXTURE_HEIGHT
      },
      offset: {
        x: -boundingBox.left + (restrictedGlyph ? 0 : TMP_CANVAS_GLYPH_PADDING) + (customGlyph ? Math.floor(this._config.letterSpacing / 2) : 0),
        y: -boundingBox.top + (restrictedGlyph ? 0 : TMP_CANVAS_GLYPH_PADDING) + (customGlyph ? this._config.lineHeight === 1 ? 0 : Math.round((this._config.scaledCellHeight - this._config.scaledCharHeight) / 2) : 0)
      }
    };
  }

  private _clipImageData(imageData: ImageData, boundingBox: IBoundingBox): ImageData {
    const width = boundingBox.right - boundingBox.left + 1;
    const height = boundingBox.bottom - boundingBox.top + 1;
    const clippedData = new Uint8ClampedArray(width * height * 4);
    for (let y = boundingBox.top; y <= boundingBox.bottom; y++) {
      for (let x = boundingBox.left; x <= boundingBox.right; x++) {
        const oldOffset = y * this._tmpCanvas.width * 4 + x * 4;
        const newOffset = (y - boundingBox.top) * width * 4 + (x - boundingBox.left) * 4;
        clippedData[newOffset] = imageData.data[oldOffset];
        clippedData[newOffset + 1] = imageData.data[oldOffset + 1];
        clippedData[newOffset + 2] = imageData.data[oldOffset + 2];
        clippedData[newOffset + 3] = imageData.data[oldOffset + 3];
      }
    }
    return new ImageData(clippedData, width, height);
  }
}

/**
 * Makes a particular rgb color and colors that are nearly the same in an ImageData completely
 * transparent.
 * @returns True if the result is "empty", meaning all pixels are fully transparent.
 */
function clearColor(imageData: ImageData, bg: IColor, fg: IColor, allowTransparency: boolean): boolean {
  // Get color channels
  const r = bg.rgba >>> 24;
  const g = bg.rgba >>> 16 & 0xFF;
  const b = bg.rgba >>> 8 & 0xFF;
  const fgR = fg.rgba >>> 24;
  const fgG = fg.rgba >>> 16 & 0xFF;
  const fgB = fg.rgba >>> 8 & 0xFF;

  // Calculate a threshold that when below a color will be treated as transpart when the sum of
  // channel value differs. This helps improve rendering when glyphs overlap with others. This
  // threshold is calculated relative to the difference between the background and foreground to
  // ensure important details of the glyph are always shown, even when the contrast ratio is low.
  // The number 12 is largely arbitrary to ensure the pixels that escape the cell in the test case
  // were covered (fg=#8ae234, bg=#c4a000).
  const threshold = Math.floor((Math.abs(r - fgR) + Math.abs(g - fgG) + Math.abs(b - fgB)) / 12);

  // Set alpha channel of relevent pixels to 0
  let isEmpty = true;
  for (let offset = 0; offset < imageData.data.length; offset += 4) {
    if (imageData.data[offset] === r &&
        imageData.data[offset + 1] === g &&
        imageData.data[offset + 2] === b) {
      imageData.data[offset + 3] = 0;
    } else {
      // Check the threshold only when transparency is not allowed only as overlapping isn't an
      // issue for transparency glyphs.
      if (!allowTransparency &&
          (Math.abs(imageData.data[offset] - r) +
          Math.abs(imageData.data[offset + 1] - g) +
          Math.abs(imageData.data[offset + 2] - b)) < threshold) {
        imageData.data[offset + 3] = 0;
      } else {
        isEmpty = false;
      }
    }
  }

  return isEmpty;
}

function toPaddedHex(c: number): string {
  const s = c.toString(16);
  return s.length < 2 ? '0' + s : s;
}
