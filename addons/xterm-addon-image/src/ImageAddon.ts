/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Implements image support for the terminal.
 */

import { Terminal, ITerminalAddon, IDisposable } from 'xterm';
import { ImageRenderer } from './ImageRenderer';
import { ImageStorage } from './ImageStorage';
import { InlineImageProtocol } from './ITermImageHandler';
import { SixelHandler } from './SixelHandler';
import { ICoreTerminal, IExtendedAttrsImage, IImageAddonOptionalOptions, IImageAddonOptions, IImageSpec } from './Types';

// to run testfiles:
// cd ../node-sixel/testfiles/
// shopt -s extglob
// cat !(*_clean).six

// no scrolling test:
// echo -ne '\x1b[?80l\x1bP0;0q' && cat ../node-sixel/testfiles/screen_clean.six && echo -e '\x1b\\'


// default values of addon ctor options
const DEFAULT_OPTIONS: IImageAddonOptions = {
  cursorRight: false,
  cursorBelow: false,
  sixelSupport: true,
  sixelScrolling: true,
  sixelPaletteLimit: 256,
  sixelSizeLimit: 25000000,
  sixelPrivatePalette: true,
  sixelDefaultPalette: 'VT340-COLOR',
  storageLimit: 100,
  showPlaceholder: true,
  itermImageProtocolSupport: true
};

// definitions for _xtermGraphicsAttributes sequence
const enum GaItem {
  COLORS = 1,
  SIXEL_GEO = 2,
  REGIS_GEO = 3
}
const enum GaAction {
  READ = 1,
  SET_DEFAULT = 2,
  SET = 3,
  READ_MAX = 4
}
const enum GaStatus {
  SUCCESS = 0,
  ITEM_ERROR = 1,
  ACTION_ERROR = 2,
  FAILURE = 3
}


export class ImageAddon implements ITerminalAddon {
  private _opts: IImageAddonOptions;
  private _defaultOpts: IImageAddonOptions;
  private _storage: ImageStorage | undefined;
  private _renderer: ImageRenderer | undefined;
  private _disposables: IDisposable[] = [];
  private _terminal: ICoreTerminal | undefined;

  constructor(opts: IImageAddonOptionalOptions = DEFAULT_OPTIONS) {
    this._opts = Object.assign({}, DEFAULT_OPTIONS, opts);
    this._defaultOpts = Object.assign({}, DEFAULT_OPTIONS, opts);
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
    this._terminal = <ICoreTerminal>terminal;

    // internal data structures
    this._renderer = new ImageRenderer(<ICoreTerminal>terminal, this._opts.showPlaceholder);
    this._storage = new ImageStorage(<ICoreTerminal>terminal, this._renderer, this._opts);

    this._disposeLater(
      this._renderer,
      this._storage,

      // DECSET/DECRST/DA1/XTSMGRAPHICS handlers
      terminal.parser.registerCsiHandler({ prefix: '?', final: 'h' }, params => this._decset(params)),
      terminal.parser.registerCsiHandler({ prefix: '?', final: 'l' }, params => this._decrst(params)),
      terminal.parser.registerCsiHandler({ final: 'c' }, params => this._da1(params)),
      terminal.parser.registerCsiHandler({ prefix: '?', final: 'S' }, params => this._xtermGraphicsAttributes(params)),

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
      (<ICoreTerminal>terminal)._core._inputHandler.onRequestReset(() => this.reset()),

      // wipe canvas and delete alternate images on buffer switch
      this._terminal.buffer.onBufferChange(() => this._storage?.wipeAlternate())
    );

    // SIXEL handler
    // TODO: report SIXEL support in DA
    if (this._opts.sixelSupport) {
      this._disposeLater(
        (<ICoreTerminal>terminal)._core._inputHandler._parser.registerDcsHandler(
          { final: 'q' }, new SixelHandler(this._opts, this._storage, <ICoreTerminal>terminal))
      );
    }

    // TODO: iTerm2 inline image protocol
    if (this._opts.itermImageProtocolSupport) {
      this._disposeLater(
        (<ICoreTerminal>terminal)._core._inputHandler._parser.registerOscHandler(
          1337, new InlineImageProtocol(this._opts, this._storage, <ICoreTerminal>terminal))
      );
    }

    // playground: hook to export image data somehow
    // TODO: make this configurable via API
    const callback = (data: Blob | null) => window.open(URL.createObjectURL(data), '_blank');

    setTimeout(() => 
      terminal.element?.addEventListener('click', (ev: MouseEvent) => {
        if (!ev.ctrlKey) return;
        const pos = (this._terminal as any)._core._mouseService!.getRawByteCoords(
          ev,
          this._terminal!._core.screenElement!,
          terminal.cols,
          terminal.rows
        );
        const buffer = this._terminal!._core.buffer;
        const x = pos.x - 33;
        const y = pos.y - 33;
        const line = buffer.lines.get(y + buffer.ydisp);
        if (!line) return;
        const HAS_EXTENDED = 0x10000000;
        if (line.getBg(x) & HAS_EXTENDED) {
          const e: IExtendedAttrsImage = line._extendedAttrs[x];
          if (!e || !e.imageId) return;
          const imgData = ((this._storage as any)._images as Map<number, IImageSpec>).get(e.imageId);
          if (imgData && imgData.orig) (imgData.orig as HTMLCanvasElement).toBlob(callback);
        }
      }),
      100);
  }

  // Note: storageLimit is skipped here to not intoduce a surprising side effect.
  public reset(): boolean {
    // reset options customizable by sequences to defaults
    this._opts.sixelScrolling = this._defaultOpts.sixelScrolling;
    this._opts.cursorRight = this._defaultOpts.cursorRight;
    this._opts.cursorBelow = this._defaultOpts.cursorBelow;
    this._opts.sixelPrivatePalette = this._defaultOpts.sixelPrivatePalette;
    this._opts.sixelPaletteLimit = this._defaultOpts.sixelPaletteLimit;
    // clear image storage
    this._storage?.reset();
    return false;
  }

  public get storageLimit(): number {
    return this._storage?.getLimit() || -1;
  }

  public set storageLimit(limit: number) {
    this._storage?.setLimit(limit);
    this._opts.storageLimit = limit;
  }

  public get storageUsage(): number {
    if (this._storage) {
      return this._storage.getUsage();
    }
    return -1;
  }

  public get showPlaceholder(): boolean {
    return this._opts.showPlaceholder;
  }

  public set showPlaceholder(value: boolean) {
    this._opts.showPlaceholder = value;
    this._renderer?.showPlaceholder(value);
  }

  private _report(s: string): void {
    this._terminal?._core._coreService.triggerDataEvent(s);
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

  // temporary fix: overload DA to return something more appropriate
  private _da1(params: (number | number[])[]): boolean {
    if (params[0] > 0) {
      return true;
    }
    // reported features:
    // 62 - VT220
    // 4 - SIXEL support
    // 9 - charsets
    // 22 - ANSI colors
    this._report(`\x1b[?62;4;9;22c`);
    return true;
  }

  /**
   * Implementation of xterm's graphics attribute sequence.
   * Most things are stubbed out as we don't support setting up a canvas directly:
   *
   * We do not hard limit the canvas size of a single SIXEL sequence nor to change that.
   * FIXME: Apply at least some sane upper limits to avoid OOM in the browser.
   *
   * ReGIS is not supported at all.
   *
   * Supported features:
   * - read/change palette limits
   * - read SIXEL canvas geometry (always reports current viewport pixel size)
   */
  private _xtermGraphicsAttributes(params: (number | number[])[]): boolean {
    if (params.length < 2) {
      return true;
    }
    if (params[0] === GaItem.COLORS) {
      switch (params[1]) {
        case GaAction.READ:
          this._report(`\x1b[?${params[0]};${GaStatus.SUCCESS};${this._opts.sixelPaletteLimit}S`);
          return true;
        case GaAction.SET_DEFAULT:
          this._opts.sixelPaletteLimit = this._defaultOpts.sixelPaletteLimit;
          this._report(`\x1b[?${params[0]};${GaStatus.SUCCESS};${this._opts.sixelPaletteLimit}S`);
          return true;
        case GaAction.SET:
          if (params.length > 2 && !(params[2] instanceof Array)) {
            this._opts.sixelPaletteLimit = params[2];
            this._report(`\x1b[?${params[0]};${GaStatus.SUCCESS};${this._opts.sixelPaletteLimit}S`);
          } else {
            this._report(`\x1b[?${params[0]};${GaStatus.ACTION_ERROR}S`);
          }
          return true;
        case GaAction.READ_MAX:
          this._report(`\x1b[?${params[0]};${GaStatus.SUCCESS};65536S`);  // hardlinked in sixel lib
          return true;
        default:
          this._report(`\x1b[?${params[0]};${GaStatus.ACTION_ERROR}S`);
          return true;
      }
    }
    if (params[0] === GaItem.SIXEL_GEO) {
      switch (params[1]) {
        case GaAction.READ:
          const width = this._renderer?.canvas?.width || 0;
          const height = this._renderer?.canvas?.height || 0;
          if (width && height) {
            this._report(`\x1b[?${params[0]};${GaStatus.SUCCESS};${width};${height}S`);
          } else {
            this._report(`\x1b[?${params[0]};${GaStatus.ACTION_ERROR}S`);
          }
          return true;
        default:
          this._report(`\x1b[?${params[0]};${GaStatus.ACTION_ERROR}S`);
          return true;
      }
    }
    // exit with error on ReGIS or any other requests
    this._report(`\x1b[?${params[0]};${GaStatus.ITEM_ERROR}S`);
    return true;
  }
}
