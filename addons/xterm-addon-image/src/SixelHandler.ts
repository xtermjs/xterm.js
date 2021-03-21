/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ImageStorage } from './ImageStorage';
import { IDcsHandler, IParams, IImageAddonOptions, ICoreTerminal, Align } from './Types';
import { toRGBA8888, BIG_ENDIAN } from 'sixel/lib/Colors';
import { RGBA8888 } from 'sixel/lib/Types';
import { WorkerManager } from './WorkerManager';


export class SixelHandler implements IDcsHandler {
  private _size = 0;
  private _fillColor = 0;
  private _aborted = false;

  constructor(
    private readonly _opts: IImageAddonOptions,
    private readonly _storage: ImageStorage,
    private readonly _coreTerminal: ICoreTerminal,
    private readonly _workerManager: WorkerManager
  ) {}

  // called on new SIXEL DCS sequence
  public hook(params: IParams): void {
    this._aborted = false;
    this._fillColor = params.params[1] === 1 ? 0 : extractActiveBg(
      this._coreTerminal._core._inputHandler._curAttrData,
      this._coreTerminal._core._colorManager.colors);
    this._size = 0;
    this._workerManager.sixelInit(this._fillColor, 'VT340-COLOR', this._opts.sixelPaletteLimit);
  }

  // called for any SIXEL data chunk
  public put(data: Uint32Array, start: number, end: number): void {
    if (this._aborted) {
      return;
    }
    this._size += end - start;
    if (this._size > this._opts.sixelSizeLimit) {
      console.warn(`SIXEL: too much data, aborting`);
      this._workerManager.sixelEnd(false);
      this._aborted = true;
      return;
    }
    let p = start;
    while (p < end) {
      const chunk = new Uint8Array(this._workerManager.getChunk());
      const length = end - p > chunk.length ? chunk.length : end - p;
      chunk.set(data.subarray(p, p + length));
      this._workerManager.sixelPut(chunk, length);
      p += length;
    }
  }

  // called on finalizing the SIXEL DCS sequence
  public unhook(success: boolean): boolean | Promise<boolean> {
    if (this._aborted) {
      return true;
    }
    const imgData = this._workerManager.sixelEnd(success);
    if (!imgData) return true;
    return imgData.then(data => {
      if (!data) {
        return true;
      }
      const canvas = this._storage.getCellAdjustedCanvas(data.width, data.height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imageData = new ImageData(new Uint8ClampedArray(data.buffer), data.width, data.height);
        ctx.putImageData(imageData, 0, 0);
        this._storage.addImage(canvas, {
          scroll: this._opts.sixelScrolling,
          right: this._opts.cursorRight,
          below: this._opts.cursorBelow,
          alpha: true,
          fill: convertLe(this._fillColor),
          align: Align.CENTER
        });
      }
      return true;
    });
  }
}


/**
 * Some helpers to extract current terminal colors.
 * (quite hacky for now)
 */

function extractActiveBg(
  attr: ICoreTerminal['_core']['_inputHandler']['_curAttrData'],
  colors: ICoreTerminal['_core']['_colorManager']['colors']
): RGBA8888 {
  let bg = 0;
  if (attr.isInverse()) {
    if (attr.isFgDefault()) {
      bg = convertLe(colors.foreground.rgba);
    } else if (attr.isFgRGB()) {
      const t = <[number, number, number]>(attr as any).constructor.toColorRGB(attr.getFgColor());
      bg = toRGBA8888(...t);
    } else {
      bg = convertLe(colors.ansi[attr.getFgColor()].rgba);
    }
  } else {
    if (attr.isBgDefault()) {
      bg = convertLe(colors.background.rgba);
    } else if (attr.isBgRGB()) {
      const t = <[number, number, number]>(attr as any).constructor.toColorRGB(attr.getBgColor());
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
