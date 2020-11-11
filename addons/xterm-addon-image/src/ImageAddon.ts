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
  private _disposables: IDisposable[] = [];

  constructor(opts: IImageAddonOptionalOptions = DEFAULT_OPTIONS) {
    this._opts = Object.assign({}, DEFAULT_OPTIONS, opts);
  }

  public dispose(): void {
    for (const obj of this._disposables) {
      obj.dispose();
    }
    this._disposables.length = 0;
  }

  private _disposeLater(...args: IDisposable[]): void {
    for (const obj of args) {
      this._disposables.push(obj);
    }
  }

  public activate(terminal: Terminal): void {
    // internal data structures
    this._renderer = new ImageRenderer(<ICoreTerminal>terminal);
    this._storage = new ImageStorage(<ICoreTerminal>terminal, this._renderer);

    this._disposeLater(
      this._renderer,
      this._storage,

      // DECSET/DECRST handlers
      terminal.parser.registerCsiHandler({ prefix: '?', final: 'h' }, params => this._decset(params)),
      terminal.parser.registerCsiHandler({ prefix: '?', final: 'l' }, params => this._decrst(params)),

      // render hook
      terminal.onRender(range => this._storage?.render(range)),

      /**
       * reset handlers covered:
       * - DECSTR
       * - RIS
       * - Terminal.reset()
       */
      terminal.parser.registerCsiHandler({intermediates: '!', final: 'p'}, () => this.reset()),
      terminal.parser.registerEscHandler({final: 'c'}, () => this.reset()),
      (<ICoreTerminal>terminal)._core._inputHandler.onRequestReset(() => this.reset())
    );

    // SIXEL handler
    // TODO: report SIXEL support in DA
    if (this._opts.sixelSupport) {
      this._disposeLater(
        (<ICoreTerminal>terminal)._core._inputHandler._parser.addDcsHandler(
          { final: 'q' }, new SixelHandler(this._opts, this._storage, <ICoreTerminal>terminal))
      );
    }

    // TODO: iTerm2 image support
  }

  public reset(): boolean {
    // reset options customizable by sequences to defaults
    this._opts.sixelScrolling = true;
    this._opts.cursorRight = false;
    this._opts.cursorBelow = false;
    this._opts.sixelPrivatePalette = true;
    // clear image storage
    this._storage?.reset();
    return false;
  }

  private _decset(params: (number | number[])[]): boolean {
    for (let i = 0; i < params.length; ++i) {
      switch (params[i]) {
        case 80:
          this._opts.sixelScrolling = true;
          break;
        case 1070:
          this._opts.sixelPrivatePalette = true;
          break;
        case 8452:
          this._opts.cursorRight = true;
          break;
        case 7730:
          this._opts.cursorBelow = true;
          break;
      }
    }
    return false;
  }

  private _decrst(params: (number | number[])[]): boolean {
    for (let i = 0; i < params.length; ++i) {
      switch (params[i]) {
        case 80:
          this._opts.sixelScrolling = false;
          break;
        case 1070:
          this._opts.sixelPrivatePalette = false;
          break;
        case 8452:
          this._opts.cursorRight = false;
          break;
        case 7730:
          this._opts.cursorBelow = false;
          break;
      }
    }
    return false;
  }
}
