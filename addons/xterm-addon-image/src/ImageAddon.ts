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
      this._sixelHandler = terminal.parser.addDcsHandler({final: 'q'}, (data, params) => {
        const pal = this._opts.sixelPrivatePalette ? Object.assign([], this._sixelPalette) : this._sixelPalette;
        // TODO: 0 - get startup background, 2 - get BCE
        const dec = new SixelDecoder(params[1] === 1 ? 0 : DEFAULT_BACKGROUND, pal, this._opts.sixelPaletteLimit);
        dec.decodeString(data);
        if (this._storage) {
          this._storage.addImageFromSixel(dec);
        }
        return true;
      });
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
