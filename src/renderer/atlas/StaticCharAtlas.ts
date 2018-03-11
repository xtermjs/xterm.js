/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { DIM_OPACITY, IGlyphIdentifier } from './Types';
import { ICharAtlasConfig } from '../../shared/atlas/Types';
import { CHAR_ATLAS_CELL_SPACING } from '../../shared/atlas/Types';
import { generateStaticCharAtlasTexture } from '../../shared/atlas/CharAtlasGenerator';
import BaseCharAtlas from './BaseCharAtlas';

export default class StaticCharAtlas extends BaseCharAtlas {
  private _texture: HTMLCanvasElement | ImageBitmap;

  constructor(private _document: Document, private _config: ICharAtlasConfig) {
    super();
  }

  private _canvasFactory = (width: number, height: number) => {
    const canvas = this._document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  public async _doWarmUp(): Promise<void> {
    const result = generateStaticCharAtlasTexture(window, this._canvasFactory, this._config);
    if (result instanceof Promise) {
      this._texture = await result;
    } else {
      this._texture = result;
    }
  }

  private _isCached(glyph: IGlyphIdentifier, colorIndex: number): boolean {
    const isAscii = glyph.char.charCodeAt(0) < 256;
    // A color is basic if it is one of the standard normal or bold weight
    // colors of the characters held in the char atlas. Note that this excludes
    // the normal weight _light_ color characters.
    const isBasicColor = (colorIndex > 1 && glyph.fg < 16) && (glyph.fg < 8 || glyph.bold);
    const isDefaultColor = glyph.fg >= 256;
    const isDefaultBackground = glyph.bg >= 256;
    return isAscii && (isBasicColor || isDefaultColor) && isDefaultBackground;
  }

  public draw(
    ctx: CanvasRenderingContext2D,
    glyph: IGlyphIdentifier,
    x: number,
    y: number,
  ): boolean {
    // we're not warmed up yet
    if (this._texture == null) {
      return false;
    }

    let colorIndex = 0;
    if (glyph.fg < 256) {
      colorIndex = glyph.fg + 2;
    } else {
      // If default color and bold
      if (glyph.bold) {
        colorIndex = 1;
      }
    }
    if (!this._isCached(glyph, colorIndex)) {
      return false;
    }
    // ImageBitmap's draw about twice as fast as from a canvas
    const charAtlasCellWidth = this._config.scaledCharWidth + CHAR_ATLAS_CELL_SPACING;
    const charAtlasCellHeight = this._config.scaledCharHeight + CHAR_ATLAS_CELL_SPACING;

    // Apply alpha to dim the character
    if (glyph.dim) {
      ctx.globalAlpha = DIM_OPACITY;
    }

    // Draw the non-bold version of the same color if bold is not enabled
    /*if (glyph.bold && !terminal.options.enableBold) {
      // Ignore default color as it's not touched above
      if (colorIndex > 1) {
        colorIndex -= 8;
      }
    }*/

    ctx.drawImage(
      this._texture,
      glyph.char.charCodeAt(0) * charAtlasCellWidth,
      colorIndex * charAtlasCellHeight,
      charAtlasCellWidth,
      this._config.scaledCharHeight,
      x,
      y,
      charAtlasCellWidth,
      this._config.scaledCharHeight
    );

    return true;
  }
}
