/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { DIM_OPACITY, IGlyphIdentifier } from '../atlas/Types';
import { ICharAtlasConfig } from '../../shared/atlas/Types';
import { IColor } from '../../shared/Types';
import BaseCharAtlas from '../atlas/BaseCharAtlas';
import { DEFAULT_ANSI_COLORS } from '../ColorManager';
import { clearColor } from '../../shared/atlas/CharAtlasGenerator';
import { IRasterizedGlyph, IBoundingBox, IRasterizedGlyphSet } from './Types';
import { DEFAULT_ATTR } from '../../Buffer';
import { FLAGS } from '../Types';
import { RENDER_INVERTED_DEFAULT_COLOR } from './RenderModel';

// In practice we're probably never going to exhaust a texture this large. For debugging purposes,
// however, it can be useful to set this to a really tiny value, to verify that LRU eviction works.
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

export default class WebglCharAtlas extends BaseCharAtlas {
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

  constructor(document: Document, private _config: ICharAtlasConfig) {
    super();

    this.cacheCanvas = document.createElement('canvas');
    this.cacheCanvas.width = TEXTURE_WIDTH;
    this.cacheCanvas.height = TEXTURE_HEIGHT;
    // The canvas needs alpha because we use clearColor to convert the background color to alpha.
    // It might also contain some characters with transparent backgrounds if allowTransparency is
    // set.
    this._cacheCtx = this.cacheCanvas.getContext('2d', {alpha: true});

    this._tmpCanvas = document.createElement('canvas');
    this._tmpCanvas.width = this._config.scaledCharWidth * 2 + TMP_CANVAS_GLYPH_PADDING * 2;
    this._tmpCanvas.height = this._config.scaledCharHeight + TMP_CANVAS_GLYPH_PADDING * 2;
    this._tmpCtx = this._tmpCanvas.getContext('2d', {alpha: this._config.allowTransparency});

    // This is useful for debugging
    document.body.appendChild(this.cacheCanvas);
  }

  public dispose(): void {
    if (this.cacheCanvas.parentElement) {
      this.cacheCanvas.parentElement.removeChild(this.cacheCanvas);
    }
  }

  protected _doWarmUp(): void {
    // Pre-fill with ASCII 33-126
    for (let i = 33; i < 126; i++) {
      const rasterizedGlyph = this._drawToCache(i, DEFAULT_ATTR, 256, 257, true);
      this._cacheMap[i] = {
        [DEFAULT_ATTR]: rasterizedGlyph
      };
    }
  }

  public beginFrame(): boolean {
    if (this._currentRowY > TEXTURE_CAPACITY) {
      this._cacheCtx.clearRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
      this._cacheMap = {};
      this._currentRowHeight = 0;
      this._currentRowX = 0;
      this._currentRowY = 0;
      this._doWarmUp();
      return true;
    }
    return false;
  }

  public getRasterizedGlyphCombinedChar(chars: string, attr: number, bg: number, fg: number, enableBold: boolean): IRasterizedGlyph {
    let rasterizedGlyphSet = this._cacheMapCombined[chars];
    if (!rasterizedGlyphSet) {
      rasterizedGlyphSet = {};
      this._cacheMapCombined[chars] = rasterizedGlyphSet;
    }
    let rasterizedGlyph = rasterizedGlyphSet[attr];
    if (!rasterizedGlyph) {
      rasterizedGlyph = this._drawToCache(chars, attr, bg, fg, enableBold);
      rasterizedGlyphSet[attr] = rasterizedGlyph;
    }
    return rasterizedGlyph;
  }

  /**
   * Gets the glyphs texture coords, drawing the texture if it's not already
   */
  public getRasterizedGlyph(code: number, attr: number, bg: number, fg: number, enableBold: boolean): IRasterizedGlyph {
    // Space is always an empty cell, special case this as it's so common
    if (code === 32) {
      return;
    }

    let rasterizedGlyphSet = this._cacheMap[code];
    if (!rasterizedGlyphSet) {
      rasterizedGlyphSet = {};
      this._cacheMap[code] = rasterizedGlyphSet;
    }
    let rasterizedGlyph = rasterizedGlyphSet[attr];
    if (!rasterizedGlyph) {
      rasterizedGlyph = this._drawToCache(code, attr, bg, fg, enableBold);
      rasterizedGlyphSet[attr] = rasterizedGlyph;
    }
    return rasterizedGlyph;
  }

  public draw(
    ctx: CanvasRenderingContext2D,
    glyph: IGlyphIdentifier,
    x: number,
    y: number
  ): boolean {
    throw new Error('WebglCharAtlas is only compatible with the webgl renderer');
  }

  private _getColorFromAnsiIndex(idx: number): IColor {
    if (idx < this._config.colors.ansi.length) {
      return this._config.colors.ansi[idx];
    }
    return DEFAULT_ANSI_COLORS[idx];
  }

  private _getBackgroundColor(bg: number): IColor {
    if (this._config.allowTransparency) {
      // The background color might have some transparency, so we need to render it as fully
      // transparent in the atlas. Otherwise we'd end up drawing the transparent background twice
      // around the anti-aliased edges of the glyph, and it would look too dark.
      return TRANSPARENT_COLOR;
    } else if (bg === RENDER_INVERTED_DEFAULT_COLOR) {
      return this._config.colors.foreground;
    } else if (bg < 256) {
      return this._getColorFromAnsiIndex(bg);
    }
    return this._config.colors.background;
  }

  private _getForegroundColor(fg: number): IColor {
    if (fg === RENDER_INVERTED_DEFAULT_COLOR) {
      return this._config.colors.background;
    } else if (fg < 256) {
      // 256 color support
      return this._getColorFromAnsiIndex(fg);
    }
    return this._config.colors.foreground;
  }

  private _drawToCache(code: number, attr: number, bg: number, fg: number, enableBold: boolean): IRasterizedGlyph;
  private _drawToCache(chars: string, attr: number, bg: number, fg: number, enableBold: boolean): IRasterizedGlyph;
  private _drawToCache(codeOrChars: number | string, attr: number, bg: number, fg: number, enableBold: boolean): IRasterizedGlyph {
    const chars = typeof codeOrChars === 'number' ? String.fromCharCode(codeOrChars) : codeOrChars;

    this.hasCanvasChanged = true;

    const flags = attr >> 18;

    const bold = !!(flags & FLAGS.BOLD) && enableBold;
    const dim = !!(flags & FLAGS.DIM);
    const italic = !!(flags & FLAGS.ITALIC);

    this._tmpCtx.save();

    // draw the background
    const backgroundColor = this._getBackgroundColor(bg);
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
    this._tmpCtx.textBaseline = 'top';

    this._tmpCtx.fillStyle = this._getForegroundColor(fg).css;

    // Apply alpha to dim the character
    if (dim) {
      this._tmpCtx.globalAlpha = DIM_OPACITY;
    }

    // Draw the character
    this._tmpCtx.fillText(chars, TMP_CANVAS_GLYPH_PADDING, TMP_CANVAS_GLYPH_PADDING);
    this._tmpCtx.restore();

    // clear the background from the character to avoid issues with drawing over the previous
    // character if it extends past it's bounds
    const imageData = this._tmpCtx.getImageData(
      0, 0, this._tmpCanvas.width, this._tmpCanvas.height
    );

    // TODO: Support transparency
    // let isEmpty = false;
    // if (!this._config.allowTransparency) {
    //   isEmpty = clearColor(imageData, backgroundColor);
    // }

    // Clear out the background color and determine if the glyph is empty.
    const isEmpty = clearColor(imageData, backgroundColor);

    // Handle empty glyphs
    if (isEmpty) {
      return NULL_RASTERIZED_GLYPH;
    }

    const rasterizedGlyph = this._findGlyphBoundingBox(imageData, this._workBoundingBox);
    const clippedImageData = this._clipImageData(imageData, this._workBoundingBox);

    // Check if there is enough room in the current row and go to next if needed
    if (this._currentRowX + this._config.scaledCharWidth > TEXTURE_WIDTH) {
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
  private _findGlyphBoundingBox(imageData: ImageData, boundingBox: IBoundingBox): IRasterizedGlyph {
    boundingBox.top = 0;
    let found = false;
    for (let y = 0; y < this._tmpCanvas.height; y++) {
      for (let x = 0; x < this._tmpCanvas.width; x++) {
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
    for (let x = 0; x < this._tmpCanvas.width; x++) {
      for (let y = 0; y < this._tmpCanvas.height; y++) {
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
    boundingBox.right = this._tmpCanvas.width;
    found = false;
    for (let x = this._tmpCanvas.width - 1; x >= 0; x--) {
      for (let y = 0; y < this._tmpCanvas.height; y++) {
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
    boundingBox.bottom = this._tmpCanvas.height;
    found = false;
    for (let y = this._tmpCanvas.height - 1; y >= 0; y--) {
      for (let x = 0; x < this._tmpCanvas.width; x++) {
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
        x: -boundingBox.left + TMP_CANVAS_GLYPH_PADDING,
        y: -boundingBox.top + TMP_CANVAS_GLYPH_PADDING
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
