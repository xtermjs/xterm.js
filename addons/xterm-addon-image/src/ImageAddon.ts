/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Implements image support for the terminal.
 */

import { Terminal, ITerminalAddon, IDisposable } from 'xterm';
import { ImageRenderer } from './ImageRenderer';
import { ImageStorage } from './ImageStorage';
import { SixelHandler } from './SixelHandler';
import { ICoreTerminal, IImageAddonOptionalOptions, IImageAddonOptions } from './Types';


/**
 * Missing features:
 * CSI Ps c     -->   Ps = 4  ⇒  Sixel graphics
 * CSI ? Pm h   -->   Ps = 8 0  ⇒  Sixel scrolling
 *                    Ps = 1 0 7 0  ⇒  use private color registers for each graphic
 *                    Ps = 8 4 5 2  ⇒  Sixel scrolling leaves cursor to right of graphic
 *                    from mintty: 7730h | 7730l (in scrolling: whether cursor is below left | beginning)
 */


// default values of addon ctor options
const DEFAULT_OPTIONS: IImageAddonOptions = {
  sixelSupport: true,
  sixelScrolling: true,
  sixelPaletteLimit: 256,
  sixelSizeLimit: 12000000,
  sixelPrivatePalette: true,
  sixelDefaultPalette: 'VT340-COLOR'
};


export class ImageAddon implements ITerminalAddon {
  private _opts: IImageAddonOptions;
  private _storage: ImageStorage | undefined;
  private _renderer: ImageRenderer | undefined;
  private _sixelDispose: IDisposable | undefined;
  private _renderDispose: IDisposable | undefined;

  constructor(opts: IImageAddonOptionalOptions = DEFAULT_OPTIONS) {
    this._opts = Object.assign({}, DEFAULT_OPTIONS, opts);
  }

  public activate(terminal: Terminal): void {
    this._renderer = new ImageRenderer(terminal);
    this._storage = new ImageStorage(terminal, this._renderer);

    if (this._opts.sixelSupport && !this._sixelDispose) {
      this._sixelDispose = (terminal as unknown as ICoreTerminal)._core._inputHandler._parser
        .addDcsHandler({ final: 'q' }, new SixelHandler(this._opts, this._storage));
    }

    this._renderDispose = terminal.onRender(this._storage.render.bind(this._storage));
  }

  public dispose(): void {
    this._sixelDispose?.dispose();
    this._renderDispose?.dispose();
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
