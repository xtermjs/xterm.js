/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { DIM_OPACITY } from './Types';
import { CHAR_ATLAS_CELL_SPACING, ICharAtlasConfig } from '../../shared/atlas/Types';
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

    // This is useful for debugging
    // document.body.appendChild(canvas);

    return canvas;
  }

  protected _doWarmUp(): void {
    const result = generateStaticCharAtlasTexture(window, this._canvasFactory, this._config);
    if (result instanceof HTMLCanvasElement) {
      this._texture = result;
    } else {
      result.then(texture => {
        this._texture = texture;
      });
    }
  }

  private _isCached(code: number, fg: number, bg: number, italic: boolean): boolean {
    const isAscii = code < 256;
    // A color is basic if it is one of the 4 bit ANSI colors.
    const isBasicColor = fg < 16;
    const isDefaultColor = fg >= 256;
    const isDefaultBackground = bg >= 256;
    return isAscii && (isBasicColor || isDefaultColor) && isDefaultBackground && !italic;
  }

  public draw(
    ctx: CanvasRenderingContext2D,
    chars: string,
    code: number,
    bg: number,
    fg: number,
    bold: boolean,
    dim: boolean,
    italic: boolean,
    x: number,
    y: number
  ): boolean {
    // we're not warmed up yet
    if (this._texture === null || this._texture === undefined) {
      return false;
    }

    let colorIndex = 0;
    if (fg < 256) {
      colorIndex = 2 + fg + (bold ? 16 : 0);
    } else {
      // If default color and bold
      if (bold) {
        colorIndex = 1;
      }
    }
    if (!this._isCached(code, fg, bg, italic)) {
      return false;
    }

    ctx.save();

    // ImageBitmap's draw about twice as fast as from a canvas
    const charAtlasCellWidth = this._config.scaledCharWidth + CHAR_ATLAS_CELL_SPACING;
    const charAtlasCellHeight = this._config.scaledCharHeight + CHAR_ATLAS_CELL_SPACING;

    // Apply alpha to dim the character
    if (dim) {
      ctx.globalAlpha = DIM_OPACITY;
    }

    ctx.drawImage(
      this._texture,
      code * charAtlasCellWidth,
      colorIndex * charAtlasCellHeight,
      charAtlasCellWidth,
      this._config.scaledCharHeight,
      x,
      y,
      charAtlasCellWidth,
      this._config.scaledCharHeight
    );

    ctx.restore();

    return true;
  }
}
