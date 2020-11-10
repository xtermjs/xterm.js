/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ImageStorage } from './ImageStorage';
import { IDcsHandler, IParams, IImageAddonOptions, ICoreTerminal, Align } from './Types';
import { SixelDecoder, DEFAULT_BACKGROUND, PALETTE_ANSI_256, PALETTE_VT340_COLOR, PALETTE_VT340_GREY, RGBA8888, toRGBA8888 } from 'sixel';
import { ImageRenderer } from './ImageRenderer';
import { BIG_ENDIAN } from 'sixel/lib/Colors';


export class SixelHandler implements IDcsHandler {
  private _decoder: SixelDecoder | undefined;
  private _sixelPalette: RGBA8888[];
  private _size = 0;

  constructor(
    private readonly _opts: IImageAddonOptions,
    private readonly _storage: ImageStorage,
    private readonly _coreTerminal: ICoreTerminal
  ) {
    this._sixelPalette = this._opts.sixelDefaultPalette === 'VT340-COLOR'
      ? PALETTE_VT340_COLOR
      : this._opts.sixelDefaultPalette === 'VT340-GREY'
        ? PALETTE_VT340_GREY
        : PALETTE_ANSI_256;
  }

  // called on new SIXEL DCS sequence
  public hook(params: IParams): void {
    const fillColor = params.params[1] === 0 ? extractDefaultBg(this._coreTerminal._core._colorManager.colors)
      : params.params[1] === 1 ? 0
        : params.params[1] === 2 ? extractActiveBg(
          this._coreTerminal._core._inputHandler._curAttrData,
          this._coreTerminal._core._colorManager.colors
        ) : DEFAULT_BACKGROUND;
    this._decoder = new SixelDecoder(
      fillColor,
      this._opts.sixelPrivatePalette ? Object.assign([], this._sixelPalette) : this._sixelPalette,
      this._opts.sixelPaletteLimit
    );
    this._size = 0;
  }

  // called for any SIXEL data chunk
  public put(data: Uint32Array, start: number, end: number): void {
    if (!this._decoder) return;
    this._size += end - start;
    if (this._size > this._opts.sixelSizeLimit) {
      this._decoder = undefined;
      console.log(`SIXEL image too big, got ${this._size} bytes`);
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
    if (!this._decoder || !this._decoder.width || !this._decoder.height) return;

    const canvas = this._storage.getCellAdjustedCanvas(this._decoder.width, this._decoder.height);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imageData = ImageRenderer.createImageData(ctx, canvas.width, canvas.height);
      if (this._decoder.fillColor) {
        const d32 = new Uint32Array(imageData.data.buffer);
        d32.fill(this._decoder.fillColor);
        this._decoder.fillColor = 0;
      }
      this._decoder.toPixelData(imageData.data, canvas.width, canvas.height);
      ctx.putImageData(imageData, 0, 0);
      this._storage.addImage(canvas, {
        scroll: this._opts.sixelScrolling,
        right: this._opts.cursorRight,
        below: this._opts.cursorBelow,
        alpha: true,
        fill: convertLittleEndian(this._decoder.fillColor),
        align: Align.CENTER
      });
    }
  }
}

// helpers to extract current terminal colors (quite hacky)

function extractDefaultBg(colors: ICoreTerminal['_core']['_colorManager']['colors']): RGBA8888 {
  return colors.background.rgba;
}


function extractActiveBg(
  attr: ICoreTerminal['_core']['_inputHandler']['_curAttrData'],
  colors: ICoreTerminal['_core']['_colorManager']['colors']
): RGBA8888 {
  let bg = 0;
  if (attr.isInverse()) {
    if (attr.isFgDefault()) {
      bg = colors.foreground.rgba;
    } else if (attr.isFgRGB()) {
      const t = <[number, number, number]>(attr as any).constructor.toColorRGB(attr.getFgColor());
      bg = toRGBA8888(...t);
    } else {
      bg = convertLittleEndian(colors.ansi[attr.getFgColor()].rgba);
    }
  } else {
    if (attr.isBgDefault()) {
      bg = colors.background.rgba;
    } else if (attr.isBgRGB()) {
      const t = <[number, number, number]>(attr as any).constructor.toColorRGB(attr.getBgColor());
      bg = toRGBA8888(...t);
    } else {
      bg = convertLittleEndian(colors.ansi[attr.getBgColor()].rgba);
    }
  }
  return bg;
}

function convertLittleEndian(color: number): RGBA8888 {
  if (!BIG_ENDIAN) {
    return (color & 0xFF) << 24 | (color >>> 8 & 0xFF) << 16 | (color >>> 16 & 0xFF) << 8 | color >>> 24 & 0xFF;
  }
  return color;
}
