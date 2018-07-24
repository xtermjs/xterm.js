/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IGlyphIdentifier } from './Types';
import { IColor } from '../../shared/Types';

export default abstract class BaseCharAtlas {
  private _didWarmUp: boolean = false;

  /**
   * Perform any work needed to warm the cache before it can be used. May be called multiple times.
   * Implement _doWarmUp instead if you only want to get called once.
   */
  public warmUp(): void {
    if (!this._didWarmUp) {
      this._doWarmUp();
      this._didWarmUp = true;
    }
  }

  /**
   * Perform any work needed to warm the cache before it can be used. Used by the default
   * implementation of warmUp(), and will only be called once.
   */
  protected _doWarmUp(): void { }

  /**
   * Called when we start drawing a new frame.
   *
   * TODO: We rely on this getting called by TextRenderLayer. This should really be called by
   * Renderer instead, but we need to make Renderer the source-of-truth for the char atlas, instead
   * of BaseRenderLayer.
   */
  public beginFrame(): void { }

  /**
   * May be called before warmUp finishes, however it is okay for the implementation to
   * do nothing and return false in that case.
   *
   * @param ctx Where to draw the character onto.
   * @param glyph Information about what to draw
   * @param x The position on the context to start drawing at
   * @param y The position on the context to start drawing at
   * @returns The success state. True if we drew the character.
   */
  public abstract draw(
    ctx: CanvasRenderingContext2D,
    glyph: IGlyphIdentifier,
    x: number,
    y: number
  ): boolean;
}

/**
 * Makes a partiicular rgb color in an ImageData completely transparent.
 * @returns True if the result is "empty", meaning all pixels are fully transparent.
 */
export function clearColor(imageData: ImageData, color: IColor): boolean {
  let isEmpty = true;
  const r = color.rgba >>> 24;
  const g = color.rgba >>> 16 & 0xFF;
  const b = color.rgba >>> 8 & 0xFF;
  for (let offset = 0; offset < imageData.data.length; offset += 4) {
    if (imageData.data[offset] === r &&
        imageData.data[offset + 1] === g &&
        imageData.data[offset + 2] === b) {
      imageData.data[offset + 3] = 0;
    } else {
      isEmpty = false;
    }
  }
  return isEmpty;
}
