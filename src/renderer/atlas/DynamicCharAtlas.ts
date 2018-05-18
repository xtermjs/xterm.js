/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { DIM_OPACITY, IGlyphIdentifier, INVERTED_DEFAULT_COLOR } from './Types';
import { ICharAtlasConfig } from '../../shared/atlas/Types';
import { IColor } from '../../shared/Types';
import BaseCharAtlas from './BaseCharAtlas';
import { DEFAULT_ANSI_COLORS } from '../ColorManager';
import { clearColor } from '../../shared/atlas/CharAtlasGenerator';
import LRUMap from './LRUMap';

// In practice we're probably never going to exhaust a texture this large. For debugging purposes,
// however, it can be useful to set this to a really tiny value, to verify that LRU eviction works.
const TEXTURE_WIDTH = 1024;
const TEXTURE_HEIGHT = 1024;

const TRANSPARENT_COLOR = {
  css: 'rgba(0, 0, 0, 0)',
  rgba: 0
};

// Drawing to the cache is expensive: If we have to draw more than this number of glyphs to the
// cache in a single frame, give up on trying to cache anything else, and try to finish the current
// frame ASAP.
//
// This helps to limit the amount of damage a program can do when it would otherwise thrash the
// cache.
const FRAME_CACHE_DRAW_LIMIT = 100;

interface IGlyphCacheValue {
  index: number;
  isEmpty: boolean;
}

function getGlyphCacheKey(glyph: IGlyphIdentifier): string {
  const styleFlags = (glyph.bold ? 0 : 4) + (glyph.dim ? 0 : 2) + (glyph.italic ? 0 : 1);
  return `${glyph.bg}_${glyph.fg}_${styleFlags}${glyph.char}`;
}

export default class DynamicCharAtlas extends BaseCharAtlas {
  // An ordered map that we're using to keep track of where each glyph is in the atlas texture.
  // It's ordered so that we can determine when to remove the old entries.
  private _cacheMap: LRUMap<IGlyphCacheValue>;

  // The texture that the atlas is drawn to
  private _cacheCanvas: HTMLCanvasElement;
  private _cacheCtx: CanvasRenderingContext2D;

  // A temporary context that glyphs are drawn to before being transfered to the atlas.
  private _tmpCtx: CanvasRenderingContext2D;

  // The number of characters stored in the atlas by width/height
  private _width: number;
  private _height: number;

  private _drawToCacheCount: number = 0;

  constructor(document: Document, private _config: ICharAtlasConfig) {
    super();
    this._cacheCanvas = document.createElement('canvas');
    this._cacheCanvas.width = TEXTURE_WIDTH;
    this._cacheCanvas.height = TEXTURE_HEIGHT;
    // The canvas needs alpha because we use clearColor to convert the background color to alpha.
    // It might also contain some characters with transparent backgrounds if allowTransparency is
    // set.
    this._cacheCtx = this._cacheCanvas.getContext('2d', {alpha: true});

    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = this._config.scaledCharWidth;
    tmpCanvas.height = this._config.scaledCharHeight;
    this._tmpCtx = tmpCanvas.getContext('2d', {alpha: this._config.allowTransparency});

    this._width = Math.floor(TEXTURE_WIDTH / this._config.scaledCharWidth);
    this._height = Math.floor(TEXTURE_HEIGHT / this._config.scaledCharHeight);
    const capacity = this._width * this._height;
    this._cacheMap = new LRUMap(capacity);
    this._cacheMap.prealloc(capacity);

    // This is useful for debugging
    // document.body.appendChild(this._cacheCanvas);
  }

  public beginFrame(): void {
    this._drawToCacheCount = 0;
  }

  public draw(
    ctx: CanvasRenderingContext2D,
    glyph: IGlyphIdentifier,
    x: number,
    y: number
  ): boolean {
    const glyphKey = getGlyphCacheKey(glyph);
    const cacheValue = this._cacheMap.get(glyphKey);
    if (cacheValue != null) {
      this._drawFromCache(ctx, cacheValue, x, y);
      return true;
    } else if (this._canCache(glyph) && this._drawToCacheCount < FRAME_CACHE_DRAW_LIMIT) {
      let index;
      if (this._cacheMap.size < this._cacheMap.capacity) {
        index = this._cacheMap.size;
      } else {
        // we're out of space, so our call to set will delete this item
        index = this._cacheMap.peek().index;
      }
      const cacheValue = this._drawToCache(glyph, index);
      this._cacheMap.set(glyphKey, cacheValue);
      this._drawFromCache(ctx, cacheValue, x, y);
      return true;
    }
    return false;
  }

  private _canCache(glyph: IGlyphIdentifier): boolean {
    // Only cache ascii and extended characters for now, to be safe. In the future, we could do
    // something more complicated to determine the expected width of a character.
    //
    // If we switch the renderer over to webgl at some point, we may be able to use blending modes
    // to draw overlapping glyphs from the atlas:
    // https://github.com/servo/webrender/issues/464#issuecomment-255632875
    // https://webglfundamentals.org/webgl/lessons/webgl-text-texture.html
    return glyph.code < 256;
  }

  private _toCoordinates(index: number): [number, number] {
    return [
      (index % this._width) * this._config.scaledCharWidth,
      Math.floor(index / this._width) * this._config.scaledCharHeight
    ];
  }

  private _drawFromCache(
    ctx: CanvasRenderingContext2D,
    cacheValue: IGlyphCacheValue,
    x: number,
    y: number
  ): void {
    // We don't actually need to do anything if this is whitespace.
    if (cacheValue.isEmpty) {
      return;
    }
    const [cacheX, cacheY] = this._toCoordinates(cacheValue.index);
    ctx.drawImage(
      this._cacheCanvas,
      cacheX,
      cacheY,
      this._config.scaledCharWidth,
      this._config.scaledCharHeight,
      x,
      y,
      this._config.scaledCharWidth,
      this._config.scaledCharHeight
    );
  }

  private _getColorFromAnsiIndex(idx: number): IColor {
    if (idx < this._config.colors.ansi.length) {
      return this._config.colors.ansi[idx];
    }
    return DEFAULT_ANSI_COLORS[idx];
  }

  private _getBackgroundColor(glyph: IGlyphIdentifier): IColor {
    if (this._config.allowTransparency) {
      // The background color might have some transparency, so we need to render it as fully
      // transparent in the atlas. Otherwise we'd end up drawing the transparent background twice
      // around the anti-aliased edges of the glyph, and it would look too dark.
      return TRANSPARENT_COLOR;
    } else if (glyph.bg === INVERTED_DEFAULT_COLOR) {
      return this._config.colors.foreground;
    } else if (glyph.bg < 256) {
      return this._getColorFromAnsiIndex(glyph.bg);
    }
    return this._config.colors.background;
  }

  private _getForegroundColor(glyph: IGlyphIdentifier): IColor {
    if (glyph.fg === INVERTED_DEFAULT_COLOR) {
      return this._config.colors.background;
    } else if (glyph.fg < 256) {
      // 256 color support
      return this._getColorFromAnsiIndex(glyph.fg);
    }
    return this._config.colors.foreground;
  }

  // TODO: We do this (or something similar) in multiple places. We should split this off
  // into a shared function.
  private _drawToCache(glyph: IGlyphIdentifier, index: number): IGlyphCacheValue {
    this._drawToCacheCount++;

    this._tmpCtx.save();

    // draw the background
    const backgroundColor = this._getBackgroundColor(glyph);
    // Use a 'copy' composite operation to clear any existing glyph out of _tmpCtxWithAlpha, regardless of
    // transparency in backgroundColor
    this._tmpCtx.globalCompositeOperation = 'copy';
    this._tmpCtx.fillStyle = backgroundColor.css;
    this._tmpCtx.fillRect(0, 0, this._config.scaledCharWidth, this._config.scaledCharHeight);
    this._tmpCtx.globalCompositeOperation = 'source-over';

    // draw the foreground/glyph
    const fontWeight = glyph.bold ? this._config.fontWeightBold : this._config.fontWeight;
    const fontStyle = glyph.italic ? 'italic' : '';
    this._tmpCtx.font =
      `${fontStyle} ${fontWeight} ${this._config.fontSize * this._config.devicePixelRatio}px ${this._config.fontFamily}`;
    this._tmpCtx.textBaseline = 'top';

    this._tmpCtx.fillStyle = this._getForegroundColor(glyph).css;

    // Apply alpha to dim the character
    if (glyph.dim) {
      this._tmpCtx.globalAlpha = DIM_OPACITY;
    }
    // Draw the character
    this._tmpCtx.fillText(glyph.char, 0, 0);
    this._tmpCtx.restore();

    // clear the background from the character to avoid issues with drawing over the previous
    // character if it extends past it's bounds
    const imageData = this._tmpCtx.getImageData(
      0, 0, this._config.scaledCharWidth, this._config.scaledCharHeight
    );
    let isEmpty = false;
    if (!this._config.allowTransparency) {
      isEmpty = clearColor(imageData, backgroundColor);
    }

    // copy the data from imageData to _cacheCanvas
    const [x, y] = this._toCoordinates(index);
    // putImageData doesn't do any blending, so it will overwrite any existing cache entry for us
    this._cacheCtx.putImageData(imageData, x, y);

    return {
      index,
      isEmpty
    };
  }
}
