/**
 * Copyright (c) 2020, 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ImageStorage } from './ImageStorage';
import { IDcsHandler, IParams, IImageAddonOptions, ITerminalExt, AttributeData, IResetHandler, ReadonlyColorSet } from './Types';
import { toRGBA8888, BIG_ENDIAN, PALETTE_ANSI_256, PALETTE_VT340_COLOR } from 'sixel/lib/Colors';
import { RGBA8888 } from 'sixel/lib/Types';
import { ImageRenderer } from './ImageRenderer';

import { DecoderAsync, Decoder } from 'sixel/lib/Decoder';

// always free decoder ressources after decoding if it exceeds this limit
const MEM_PERMA_LIMIT = 4194304; // 1024 pixels * 1024 pixels * 4 channels = 4MB

// custom default palette: VT340 (lower 16 colors) + ANSI256 (up to 256) + zeroed (up to 4096)
const DEFAULT_PALETTE = PALETTE_ANSI_256;
DEFAULT_PALETTE.set(PALETTE_VT340_COLOR);


export class SixelHandler implements IDcsHandler, IResetHandler {
  private _size = 0;
  private _aborted = false;
  private _dec: Decoder | undefined;

  constructor(
    private readonly _opts: IImageAddonOptions,
    private readonly _storage: ImageStorage,
    private readonly _coreTerminal: ITerminalExt
  ) {
    DecoderAsync({
      memoryLimit: this._opts.pixelLimit * 4,
      palette: DEFAULT_PALETTE,
      paletteLimit: this._opts.sixelPaletteLimit
    }).then(d => this._dec = d);
  }

  public reset(): void {
    /**
     * reset sixel decoder to defaults:
     * - release all memory
     * - nullify palette (4096)
     * - apply default palette (256)
     */
    if (this._dec) {
      this._dec.release();
      // FIXME: missing interface on decoder to nullify full palette
      (this._dec as any)._palette.fill(0);
      this._dec.init(0, DEFAULT_PALETTE, this._opts.sixelPaletteLimit);
    }
  }

  public hook(params: IParams): void {
    this._size = 0;
    this._aborted = false;
    if (this._dec) {
      const fillColor = params.params[1] === 1 ? 0 : extractActiveBg(
        this._coreTerminal._core._inputHandler._curAttrData,
        this._coreTerminal._core._themeService?.colors);
      this._dec.init(fillColor, null, this._opts.sixelPaletteLimit);
    }
  }

  public put(data: Uint32Array, start: number, end: number): void {
    if (this._aborted || !this._dec) {
      return;
    }
    this._size += end - start;
    if (this._size > this._opts.sixelSizeLimit) {
      console.warn(`SIXEL: too much data, aborting`);
      this._aborted = true;
      this._dec.release();
      return;
    }
    try {
      this._dec.decode(data, start, end);
    } catch (e) {
      console.warn(`SIXEL: error while decoding image - ${e}`);
      this._aborted = true;
      this._dec.release();
    }
  }

  public unhook(success: boolean): boolean | Promise<boolean> {
    if (this._aborted || !success || !this._dec) {
      return true;
    }

    const width = this._dec.width;
    const height = this._dec.height;

    // partial fix for https://github.com/jerch/xterm-addon-image/issues/37
    if (!width || ! height) {
      if (height) {
        this._storage.advanceCursor(height);
      }
      return true;
    }

    const canvas = ImageRenderer.createCanvas(undefined, width, height);
    canvas.getContext('2d')?.putImageData(new ImageData(this._dec.data8, width, height), 0, 0);
    if (this._dec.memoryUsage > MEM_PERMA_LIMIT) {
      this._dec.release();
    }
    this._storage.addImage(canvas);
    return true;
  }
}


/**
 * Some helpers to extract current terminal colors.
 */

// get currently active background color from terminal
// also respect INVERSE setting
function extractActiveBg(attr: AttributeData, colors: ReadonlyColorSet | undefined): RGBA8888 {
  let bg = 0;
  if (!colors) {
    // FIXME: theme service is prolly not available yet,
    // happens if .open() was not called yet (bug in core?)
    return bg;
  }
  if (attr.isInverse()) {
    if (attr.isFgDefault()) {
      bg = convertLe(colors.foreground.rgba);
    } else if (attr.isFgRGB()) {
      const t = (attr.constructor as typeof AttributeData).toColorRGB(attr.getFgColor());
      bg = toRGBA8888(...t);
    } else {
      bg = convertLe(colors.ansi[attr.getFgColor()].rgba);
    }
  } else {
    if (attr.isBgDefault()) {
      bg = convertLe(colors.background.rgba);
    } else if (attr.isBgRGB()) {
      const t = (attr.constructor as typeof AttributeData).toColorRGB(attr.getBgColor());
      bg = toRGBA8888(...t);
    } else {
      bg = convertLe(colors.ansi[attr.getBgColor()].rgba);
    }
  }
  return bg;
}

// rgba values on the color managers are always in BE, thus convert to LE
function convertLe(color: number): RGBA8888 {
  if (BIG_ENDIAN) return color;
  return (color & 0xFF) << 24 | (color >>> 8 & 0xFF) << 16 | (color >>> 16 & 0xFF) << 8 | color >>> 24 & 0xFF;
}
