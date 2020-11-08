/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Implements image support for the terminal.
 */

import { Terminal, ITerminalAddon } from 'xterm';
import { SixelDecoder, DEFAULT_BACKGROUND, PALETTE_ANSI_256, PALETTE_VT340_COLOR, PALETTE_VT340_GREY, RGBA8888 } from 'sixel';
import { ImageRenderer, ImageStorage } from './ImageStorage';

interface IImageAddonOptions {
  // SIXEL settings
  // Whether SIXEL is enabled (default is true).
  sixelSupport?: boolean;
  // Whether SIXEL scrolling is enabled (default is true).
  sixelScrolling?: boolean;
  // Palette color limit (default 256).
  sixelPaletteLimit?: number;
  // SIXEL image size limit in bytes (calculated with 4 channels, default 12000000).
  sixelSizeLimit?: number;
  // Whether it use private palettes for separate SIXEL sequences.
  sixelPrivatePalette?: boolean;
  // Default start palette (default 'ANSI256').
  sixelDefaultPalette?: 'VT340-COLOR' | 'VT340-GREY' | 'ANSI256';
  // TODO: iTerm image protocol support
}

const DEFAULT_OPTIONS: IImageAddonOptions = {
  // SIXEL default settings
  sixelSupport: true,
  sixelScrolling: true,
  sixelPaletteLimit: 256,
  sixelSizeLimit: 12000000,
  sixelPrivatePalette: true,
  sixelDefaultPalette: 'VT340-COLOR'
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

type ParamsArray = (number | number[])[];

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


class SixelHandler implements IDcsHandler {
  private _dec: SixelDecoder | undefined;
  private _sixelPalette: RGBA8888[];
  private _opts: IImageAddonOptions;

  constructor(private _storage: ImageStorage, opts: IImageAddonOptions = DEFAULT_OPTIONS) {
    this._opts = Object.assign({}, DEFAULT_OPTIONS, opts);
    this._sixelPalette = this._opts.sixelDefaultPalette === 'VT340-COLOR'
      ? PALETTE_VT340_COLOR
      : this._opts.sixelDefaultPalette === 'VT340-GREY'
        ? PALETTE_VT340_GREY
        : PALETTE_ANSI_256;
  }

  public hook(params: IParams): void {
    this._dec = new SixelDecoder(
      params.params[1] === 1 ? 0 : DEFAULT_BACKGROUND,
      this._opts.sixelPrivatePalette ? Object.assign([], this._sixelPalette) : this._sixelPalette,
      this._opts.sixelPaletteLimit
    );
  }

  public put(data: Uint32Array, start: number, end: number): void {
    if (!this._dec) return;
    const size = Math.max(this._dec.rasterWidth * this._dec.rasterHeight * 4, this._dec.memUsage);
    if (size > this._opts.sixelSizeLimit!) {
      this._dec = undefined;
    } else {
      this._dec.decode(data, start, end);
    }
  }

  public unhook(success: boolean): void | boolean {
    if (!this._dec) return;
    if (success) {
      this._storage.addImageFromSixel(this._dec);
    }
    this._dec = undefined;
  }
}


/**
 * Missing features:
 * CSI Ps c     -->   Ps = 4  ⇒  Sixel graphics
 * CSI ? Pm h   -->   Ps = 8 0  ⇒  Sixel scrolling
 *                    Ps = 1 0 7 0  ⇒  use private color registers for each graphic
 *                    Ps = 8 4 5 2  ⇒  Sixel scrolling leaves cursor to right of graphic
 *                    from mintty: 7730h | 7730l (in scrolling: whether cursor is below left | beginning)
 */
export class ImageAddon implements ITerminalAddon {
  private _opts: IImageAddonOptions;
  private _storage: ImageStorage | undefined;
  private _renderer: ImageRenderer | undefined;
  private _sixelHandler: SixelHandler | undefined;
  private _clearSixelHandler: () => void = () => {};
  constructor(opts: IImageAddonOptions = DEFAULT_OPTIONS) {
    this._opts = Object.assign({}, DEFAULT_OPTIONS, opts);
  }
  public activate(terminal: Terminal): void {
    this._renderer = new ImageRenderer(terminal);
    this._storage = new ImageStorage(terminal, this._renderer);
    if (this._opts.sixelSupport && !this._sixelHandler) {
      this._sixelHandler = new SixelHandler(this._storage, this._opts);
      (terminal as any)._core._inputHandler._parser.setDcsHandler({final: 'q'}, this._sixelHandler);
      this._clearSixelHandler = () => (terminal as any)._core._inputHandler._parser.clearDcsHandler({final: 'q'});
    }

    terminal.onRender(this._storage.render.bind(this._storage));
  }

  public dispose(): void {
    if (this._sixelHandler) {
      this._clearSixelHandler();
      this._sixelHandler = undefined;
    }
    if (this._storage) {
      this._storage.dispose();
      this._storage = undefined;
    }
    if (this._renderer) {
      this._renderer.dispose();
      this._renderer = undefined;
    }
  }
}
