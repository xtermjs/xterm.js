/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Implements image support for the terminal.
 */

import { Terminal, ITerminalAddon, IDisposable } from 'xterm';
import { decsetImage, decrstImage } from './CsiHandler';
import { ImageRenderer } from './ImageRenderer';
import { ImageStorage } from './ImageStorage';
import { SixelHandler } from './SixelHandler';
import { ICoreTerminal, IImageAddonOptionalOptions, IImageAddonOptions } from './Types';

// to run testfiles:
// cd ../node-sixel/testfiles/
// shopt -s extglob
// cat !(*_clean).six


// default values of addon ctor options
const DEFAULT_OPTIONS: IImageAddonOptions = {
  cursorRight: false,
  cursorBelow: false,
  sixelSupport: true,
  sixelScrolling: true,
  sixelPaletteLimit: 256,
  sixelSizeLimit: 25000000,
  sixelPrivatePalette: true,
  sixelDefaultPalette: 'VT340-COLOR'
};


export class ImageAddon implements ITerminalAddon {
  private _opts: IImageAddonOptions;
  private _storage: ImageStorage | undefined;
  private _renderer: ImageRenderer | undefined;
  private _disposeSixel: IDisposable | undefined;
  private _disposeRender: IDisposable | undefined;
  private _disposeDecset: IDisposable | undefined;
  private _disposeDecrst: IDisposable | undefined;

  constructor(opts: IImageAddonOptionalOptions = DEFAULT_OPTIONS) {
    this._opts = Object.assign({}, DEFAULT_OPTIONS, opts);
  }

  public activate(terminal: Terminal): void {
    // internal data structures
    this._renderer = new ImageRenderer(<ICoreTerminal>terminal);
    this._storage = new ImageStorage(<ICoreTerminal>terminal, this._renderer);

    // DECSET handler
    this._disposeDecset = terminal.parser.registerCsiHandler(
      { prefix: '?', final: 'h' },
      decsetImage(this._opts)
    );

    // DECRST handler
    this._disposeDecrst = terminal.parser.registerCsiHandler(
      { prefix: '?', final: 'l' },
      decrstImage(this._opts)
    );

    // SIXEL handler
    if (this._opts.sixelSupport && !this._disposeSixel) {
      this._disposeSixel = (<ICoreTerminal>terminal)._core._inputHandler._parser.addDcsHandler(
        { final: 'q' },
        new SixelHandler(this._opts, this._storage, <ICoreTerminal>terminal)
      );
    }

    // render hook
    this._disposeRender = terminal.onRender(range => this._storage?.render(range));
  }

  public dispose(): void {
    if (this._renderer) {
      this._renderer.dispose();
      this._renderer = undefined;
    }
    if (this._storage) {
      this._storage.dispose();
      this._storage = undefined;
    }
    this._disposeDecset?.dispose();
    this._disposeDecrst?.dispose();
    this._disposeSixel?.dispose();
    this._disposeRender?.dispose();
  }
}
