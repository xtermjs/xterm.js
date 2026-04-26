/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { IImageAddonOptions, IOscHandler, IResetHandler, ITerminalExt } from './Types';
import { ImageRenderer } from './ImageRenderer';
import { IIPImageStorage } from './IIPImageStorage';
import { CELL_SIZE_DEFAULT } from './ImageStorage';
import Base64Decoder from 'xterm-wasm-parts/lib/base64/Base64Decoder.wasm';
import QoiDecoder from 'xterm-wasm-parts/lib/qoi/QoiDecoder.wasm';
import { HeaderParser, IHeaderFields, HeaderState } from './IIPHeaderParser';
import { imageType, UNSUPPORTED_TYPE } from './IIPMetrics';

// Local const enum mirror - esbuild can't inline const enums from external packages
const enum DecoderConst {
  // Limit held memory in base64 decoder (encoded bytes).
  KEEP_DATA = 4194304,
  // Initial buffer allocation for the decoder.
  INITIAL_DATA = 1048576,
  // Local mirror of const enum (esbuild can't inline const enums from external packages)
  OK = 0
}

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
  private _dec: Base64Decoder;
  private _qoiDec: QoiDecoder;
  private _metrics = UNSUPPORTED_TYPE;

  constructor(
    private readonly _opts: IImageAddonOptions,
    private readonly _renderer: ImageRenderer,
    private readonly _storage: IIPImageStorage,
    private readonly _coreTerminal: ITerminalExt
  ) {
    const maxEncodedBytes = Math.ceil(this._opts.iipSizeLimit * 4 / 3);
    const initialBytes = Math.min(DecoderConst.INITIAL_DATA, maxEncodedBytes);
    this._dec = new Base64Decoder(DecoderConst.KEEP_DATA, maxEncodedBytes, initialBytes);
    this._qoiDec = new QoiDecoder(DecoderConst.KEEP_DATA);
  }

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
      if ((this._dec.put(data.subarray(start, end)) as number) !== DecoderConst.OK) {
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
        this._dec.init();
        if ((this._dec.put(data.subarray(dataPos, end)) as number) !== DecoderConst.OK) {
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
        if (cond = this._dec.data8.length === this._header.size) {
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
    }
    if (!cond) {
      this._dec.release();
      return true;
    }

    let blob: Blob | ImageData;
    if (this._metrics.mime === 'image/qoi') {
      const data = this._qoiDec.decode(this._dec.data8);
      blob = new ImageData(
        new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
        this._qoiDec.width,
        this._qoiDec.height
      );
      this._qoiDec.release();
      if (w === this._qoiDec.width && h === this._qoiDec.height) {
        // use fast-path if we don't need to rescale
        this._dec.release();
        const canvas = ImageRenderer.createCanvas(undefined, this._qoiDec.width, this._qoiDec.height);
        canvas.getContext('2d')?.putImageData(blob, 0, 0);
        this._storage.addImage(canvas);
        return true;
      }
    } else {
      blob = new Blob([this._dec.data8], { type: this._metrics.mime });
    }
    this._dec.release();
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
