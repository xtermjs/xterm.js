/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Implements image support for the terminal.
 */

import { Terminal, IDisposable, ITerminalAddon } from 'xterm';
import { SixelDecoder, DEFAULT_BACKGROUND, PALETTE_ANSI_256, PALETTE_VT340_COLOR, PALETTE_VT340_GREY, RGBA8888 } from 'sixel';
import { ImageStorage } from './ImageStorage';

interface IImageAddonOptions {
  sixelSupport?: boolean;
  sixelScroll?: boolean;
  sixelPaletteLimit?: number;
  sixelPrivatePalette?: boolean;
  sixelDefaultPalette: 'VT340-COLOR' | 'VT340-GREY' | 'ANSI256';
}

const DEFAULT_OPTIONS: IImageAddonOptions = {
  sixelSupport: true,
  sixelScroll: true,
  sixelPaletteLimit: 256,
  sixelPrivatePalette: true,
  sixelDefaultPalette: 'ANSI256'
};

interface IDcsHandler {
  /**
   * Called when a DCS command starts.
   * Prepare needed data structures here.
   * Note: `params` is borrowed.
   */
  hook(params: IParams): void;
  /**
   * Incoming payload chunk.
   * Note: `params` is borrowed.
   */
  put(data: Uint32Array, start: number, end: number): void;
  /**
   * End of DCS command. `success` indicates whether the
   * command finished normally or got aborted, thus final
   * execution of the command should depend on `success`.
   * To save memory also cleanup data structures here.
   */
  unhook(success: boolean): void | boolean;
}

interface IParams {
  /** from ctor */
  maxLength: number;
  maxSubParamsLength: number;

  /** param values and its length */
  params: Int32Array;
  length: number;

  /** methods */
  clone(): IParams;
  toArray(): ParamsArray;
  reset(): void;
  addParam(value: number): void;
  addSubParam(value: number): void;
  hasSubParams(idx: number): boolean;
  getSubParams(idx: number): Int32Array | null;
  getSubParamsAll(): {[idx: number]: Int32Array};
}
type ParamsArray = (number | number[])[];

class SixelHandler implements IDcsHandler {
  private _dec = new SixelDecoder(0);
  private _rejected = false;
  constructor(private _storage: ImageStorage) {}
  public hook(params: IParams): void {
    // TODO: palette + background select
  }
  public put(data: Uint32Array, start: number, end: number): void {
    // reject image with more than 3M pixels
    const size = (this._dec.rasterWidth * this._dec.rasterHeight * 4) || this._dec.memUsage;
    if (size > 12000000) {
      this._rejected = true;
      this._dec = new SixelDecoder(0);
    }
    if (!this._rejected) {
      this._dec.decode(data, start, end);
    }
  }
  public unhook(success: boolean): void | boolean {
    if (!this._rejected) {
      if (success) {
        this._storage.addImageFromSixel(this._dec);
      }
      this._dec = new SixelDecoder(0);
    }
    this._rejected = false;
  }
}

export class ImageAddon implements ITerminalAddon {
  private _opts: IImageAddonOptions;
  private _storage: ImageStorage | undefined;
  private _sixelHandler: IDisposable | undefined;
  private _sixelPalette: RGBA8888[];
  constructor(opts: IImageAddonOptions = DEFAULT_OPTIONS) {
    this._opts = Object.assign({}, DEFAULT_OPTIONS, opts);
    this._sixelPalette = this._opts.sixelDefaultPalette === 'VT340-COLOR' ? PALETTE_VT340_COLOR
      : this._opts.sixelDefaultPalette === 'VT340-GREY' ? PALETTE_VT340_GREY
        : PALETTE_ANSI_256;
  }
  public activate(terminal: Terminal): void {
    this._storage = new ImageStorage(terminal);
    if (this._opts.sixelSupport && !this._sixelHandler) {
      // this._sixelHandler = terminal.parser.addDcsHandler({final: 'q'}, (data, params) => {
      //   const pal = this._opts.sixelPrivatePalette ? Object.assign([], this._sixelPalette) : this._sixelPalette;
      //   // TODO: 0 - get startup background, 2 - get BCE
      //   const dec = new SixelDecoder(params[1] === 1 ? 0 : DEFAULT_BACKGROUND, pal, this._opts.sixelPaletteLimit);
      //   dec.decodeString(data);
      //   if (this._storage) {
      //     this._storage.addImageFromSixel(dec);
      //   }
      //   return true;
      // });

      (terminal as any)._core._inputHandler._parser.setDcsHandler({final: 'q'}, new SixelHandler(this._storage));
    }

    terminal.onRender(this._storage.render.bind(this._storage));
  }

  public dispose(): void {
    if (this._sixelHandler) {
      this._sixelHandler.dispose();
      this._sixelHandler = undefined;
    }
    if (this._storage) {
      this._storage.dispose();
      this._storage = undefined;
    }
  }
}
