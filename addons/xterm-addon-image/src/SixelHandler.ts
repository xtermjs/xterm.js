/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ImageStorage } from './ImageStorage';
import { IDcsHandler, IParams, IImageAddonOptions } from './Types';
import { SixelDecoder, DEFAULT_BACKGROUND, PALETTE_ANSI_256, PALETTE_VT340_COLOR, PALETTE_VT340_GREY, RGBA8888 } from 'sixel';
import { ImageRenderer } from './ImageRenderer';


export class SixelHandler implements IDcsHandler {
  private _decoder: SixelDecoder | undefined;
  private _sixelPalette: RGBA8888[];

  constructor(private readonly _opts: IImageAddonOptions, private _storage: ImageStorage) {
    this._sixelPalette = this._opts.sixelDefaultPalette === 'VT340-COLOR'
      ? PALETTE_VT340_COLOR
      : this._opts.sixelDefaultPalette === 'VT340-GREY'
        ? PALETTE_VT340_GREY
        : PALETTE_ANSI_256;
  }

  // called on new SIXEL DCS sequence
  public hook(params: IParams): void {
    this._decoder = new SixelDecoder(
      params.params[1] === 1 ? 0 : DEFAULT_BACKGROUND,
      this._opts.sixelPrivatePalette ? Object.assign([], this._sixelPalette) : this._sixelPalette,
      this._opts.sixelPaletteLimit
    );
  }

  // called for any SIXEL data chunk
  public put(data: Uint32Array, start: number, end: number): void {
    if (!this._decoder) return;
    const size = Math.max(this._decoder.rasterWidth * this._decoder.rasterHeight * 4, this._decoder.memUsage);
    if (size > this._opts.sixelSizeLimit) {
      this._decoder = undefined;
    } else {
      this._decoder.decode(data, start, end);
    }
  }

  // called on finalizing the SIXEL DCS sequence
  public unhook(success: boolean): void | boolean {
    if (!this._decoder) return;
    if (success) {
      this._addImageToStorage();
    }
    this._decoder = undefined;
  }

  // Convert SIXEL data to a canvas digestable by the image storage.
  private _addImageToStorage(): void {
    if (!this._decoder) return;
    const width = this._decoder.width;
    const height = this._decoder.height;
    const canvas = ImageRenderer.createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imageData = ImageRenderer.createImageData(ctx, width, height);

      // TODO: whether current BG should be applied to sixel image
      // const applyBG = !!sixel.fillColor;  // TODO
      this._decoder.toPixelData(imageData.data, width, height);

      ctx.putImageData(imageData, 0, 0);
      this._storage.addImage(canvas);
    }
  }
}
