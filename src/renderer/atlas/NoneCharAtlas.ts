/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * A dummy CharAtlas implementation that always fails to draw characters.
 */

import { IGlyphIdentifier, ICharAtlasConfig } from 'src/renderer/atlas/Types';
import BaseCharAtlas from 'src/renderer/atlas/BaseCharAtlas';

export default class NoneCharAtlas extends BaseCharAtlas {
  constructor(document: Document, config: ICharAtlasConfig) {
    super();
  }

  public draw(
    ctx: CanvasRenderingContext2D,
    glyph: IGlyphIdentifier,
    x: number,
    y: number
  ): boolean {
    return false;
  }
}
