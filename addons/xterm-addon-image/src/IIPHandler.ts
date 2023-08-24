/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { IImageAddonOptions, IOscHandler, IResetHandler, ITerminalExt } from './Types';
import { ImageRenderer } from './ImageRenderer';
import { ImageStorage, CELL_SIZE_DEFAULT } from './ImageStorage';
import Base64Decoder from 'xterm-wasm-parts/lib/base64/Base64Decoder.wasm';
import { HeaderParser, IHeaderFields, HeaderState } from './IIPHeaderParser';
import { imageType, UNSUPPORTED_TYPE } from './IIPMetrics';


// eslint-disable-next-line
declare const Buffer: any;

// limit hold memory in base64 decoder
const KEEP_DATA = 4194304;

// default IIP header values
const DEFAULT_HEADER: IHeaderFields = {
  name: 'Unnamed file',
  size: 0,
  width: 'auto',
  height: 'auto',
  preserveAspectRatio: 1,
  inline: 0
};


export class IIPHandler implements IOscHandler, IResetHandler {
  private _aborted = false;
  private _hp = new HeaderParser();
  private _header: IHeaderFields = DEFAULT_HEADER;
  private _dec = new Base64Decoder(KEEP_DATA);
  private _metrics = UNSUPPORTED_TYPE;

  constructor(
    private readonly _opts: IImageAddonOptions,
    private readonly _renderer: ImageRenderer,
    private readonly _storage: ImageStorage,
    private readonly _coreTerminal: ITerminalExt
  ) {}

  public reset(): void {}

  public start(): void {
    this._aborted = false;
    this._header = DEFAULT_HEADER;
    this._metrics  = UNSUPPORTED_TYPE;
    this._hp.reset();
  }

  public put(data: Uint32Array, start: number, end: number): void {
    if (this._aborted) return;

    if (this._hp.state === HeaderState.END) {
      if (this._dec.put(data, start, end)) {
        this._dec.release();
        this._aborted = true;
      }
    } else {
      const dataPos = this._hp.parse(data, start, end);
      if (dataPos === -1) {
        this._aborted = true;
        return;
      }
      if (dataPos > 0) {
        this._header = Object.assign({}, DEFAULT_HEADER, this._hp.fields);
        if (!this._header.inline || !this._header.size || this._header.size > this._opts.iipSizeLimit) {
          this._aborted = true;
          return;
        }
        this._dec.init(this._header.size);
        if (this._dec.put(data, dataPos, end)) {
          this._dec.release();
          this._aborted = true;
        }
      }
    }
  }

  public end(success: boolean): boolean | Promise<boolean> {
    if (this._aborted) return true;

    let w = 0;
    let h = 0;

    // early exit condition chain
    let cond: number | boolean = true;
    if (cond = success) {
      if (cond = !this._dec.end()) {
        this._metrics = imageType(this._dec.data8);
        if (cond = this._metrics.mime !== 'unsupported') {
          w = this._metrics.width;
          h = this._metrics.height;
          if (cond = w && h && w * h < this._opts.pixelLimit) {
            [w, h] = this._resize(w, h).map(Math.floor);
            cond = w && h && w * h < this._opts.pixelLimit;
          }
        }
      }
    }
    if (!cond) {
      this._dec.release();
      return true;
    }

    const blob = new Blob([this._dec.data8], { type: this._metrics.mime });
    this._dec.release();

    if (!window.createImageBitmap) {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      return new Promise<boolean>(r => {
        img.addEventListener('load', () => {
          URL.revokeObjectURL(url);
          const canvas = ImageRenderer.createCanvas(window.document, w, h);
          canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
          this._storage.addImage(canvas);
          r(true);
        });
        img.src = url;
        // sanity measure to avoid terminal blocking from dangling promise
        // happens from corrupt data (onload never gets fired)
        setTimeout(() => r(true), 1000);
      });
    }
    return createImageBitmap(blob, { resizeWidth: w, resizeHeight: h })
      .then(bm => {
        this._storage.addImage(bm);
        return true;
      });
  }

  private _resize(w: number, h: number): [number, number] {
    const cw = this._renderer.dimensions?.css.cell.width || CELL_SIZE_DEFAULT.width;
    const ch = this._renderer.dimensions?.css.cell.height || CELL_SIZE_DEFAULT.height;
    const width = this._renderer.dimensions?.css.canvas.width || cw * this._coreTerminal.cols;
    const height = this._renderer.dimensions?.css.canvas.height || ch * this._coreTerminal.rows;

    const rw = this._dim(this._header.width!, width, cw);
    const rh = this._dim(this._header.height!, height, ch);
    if (!rw && !rh) {
      const wf = width / w;         // TODO: should this respect initial cursor offset?
      const hf = (height - ch) / h; // TODO: fix offset issues from float cell height
      const f = Math.min(wf, hf);
      return f < 1 ? [w * f, h * f] : [w, h];
    }
    return !rw
      ? [w * rh / h, rh]
      : this._header.preserveAspectRatio || !rw || !rh
        ? [rw, h * rw / w] : [rw, rh];
  }

  private _dim(s: string, total: number, cdim: number): number {
    if (s === 'auto') return 0;
    if (s.endsWith('%')) return parseInt(s.slice(0, -1)) * total / 100;
    if (s.endsWith('px')) return parseInt(s.slice(0, -2));
    return parseInt(s) * cdim;
  }
}
