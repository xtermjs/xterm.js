/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { IImageAddonOptions, IOscHandler, IResetHandler, ITerminalExt } from './Types';
import { IIPImageStorage } from './IIPImageStorage';
import { CELL_SIZE_DEFAULT } from './ImageStorage';
import Base64Decoder from 'xterm-wasm-parts/lib/base64/Base64Decoder.wasm';
import QoiDecoder from 'xterm-wasm-parts/lib/qoi/QoiDecoder.wasm';
import { HeaderParser, IHeaderFields, HeaderState, SequenceType } from './IIPHeaderParser';
import { imageType, UNSUPPORTED_TYPE } from './Metrics';
import { Drawable } from './Primitives';

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
  type: SequenceType.INVALID,
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
  private _isMultipart = false;
  private _abortMulti = false;

  constructor(
    private readonly _opts: IImageAddonOptions,
    private readonly _storage: IIPImageStorage,
    private readonly _coreTerminal: ITerminalExt
  ) {
    const maxEncodedBytes = Math.ceil(this._opts.iipSizeLimit * 4 / 3);
    const initialBytes = Math.min(DecoderConst.INITIAL_DATA, maxEncodedBytes);
    this._dec = new Base64Decoder(DecoderConst.KEEP_DATA, maxEncodedBytes, initialBytes);
    this._qoiDec = new QoiDecoder(DecoderConst.KEEP_DATA);
  }

  public reset(): void {
    this._hp.reset();
    this._dec.release();
    this._qoiDec.release();
  }

  public start(): void {
    this._aborted = false;
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
        const seqType = this._hp.fields.type;
        if (seqType === SequenceType.FILE) {
          if (this._isMultipart) {
            this._isMultipart = false;
            this._abortMulti = false;
            this._dec.release();
          }
          this._header = Object.assign({}, DEFAULT_HEADER, this._hp.fields);
          if (!this._header.inline) {
            this._aborted = true;
            return;
          }
          this._dec.init();
        } else if (this._abortMulti) {
          this._aborted = true;
          return;
        }
        if ((this._dec.put(data.subarray(dataPos, end)) as number) !== DecoderConst.OK) {
          this._dec.release();
          this._aborted = true;
          if (this._isMultipart) this._abortMulti = true;
        }
      }
    }
  }

  public end(success: boolean): boolean | Promise<boolean> {
    if (this._aborted) return true;

    if (this._hp.state !== HeaderState.END) {
      if (this._hp.end()) return true;
    }
    const seqType = this._hp.fields.type;

    if (seqType === SequenceType.FILEPART) return true;

    if (seqType === SequenceType.REPORTCELLSIZE) {
      // OSC 1337 ; ReportCellSize=[height];[width];[scale] ST
      // IMPORTANT: ReportCellSize uses logical points (CSS pixels)
      let w = CELL_SIZE_DEFAULT.width;
      let h = CELL_SIZE_DEFAULT.height;
      const dimensions = this._coreTerminal.dimensions;
      if (dimensions) {
        w = dimensions.css.canvas.width / this._coreTerminal.cols;
        h = dimensions.css.canvas.height / this._coreTerminal.rows;
      }
      const scale = this._coreTerminal._core._coreBrowserService?.dpr ?? 1;
      const report = `\x1b]1337;ReportCellSize=${h.toFixed(3)};${w.toFixed(3)};${scale.toFixed(3)}\x1b\\`;
      this._coreTerminal.input(report, false);
      return true;
    }

    if (seqType === SequenceType.MULTIPARTFILE) {
      this._header = Object.assign({}, DEFAULT_HEADER, this._hp.fields);
      this._isMultipart = true;
      this._abortMulti = false;
      this._dec.release();
      this._dec.init();
      return true;
    }

    if (seqType === SequenceType.FILEEND) {
      if (!this._isMultipart) return true;
      this._isMultipart = false;
      if (this._abortMulti || this._header.type !== SequenceType.MULTIPARTFILE) return true;
    }

    // fallthrough for SequenceType.FILE & SequenceType.FILEEND

    // early exit condition chain
    let cond: number | boolean;
    let metrics = UNSUPPORTED_TYPE;
    if (cond = success) {
      if (cond = !this._dec.end()) {
        metrics = imageType(this._dec.data8);
        if (cond = metrics.mime !== 'unsupported') {
          if (!(cond = metrics.width && metrics.height && metrics.width * metrics.height < this._opts.pixelLimit)) {
            console.warn(`IIP: image dimension issue ${metrics.width}x${metrics.height}`);
          }
        } else {
          console.warn('IIP: unsupported image type');
        }
      } else {
        console.warn('IIP: error during BASE64 decoding');
      }
    }
    if (!cond) {
      this._dec.release();
      return true;
    }

    let bmSrc: Blob | ImageData;
    let imgBlob: Blob;
    if (metrics.mime === 'image/qoi') {
      const data = this._qoiDec.decode(this._dec.data8);
      bmSrc = new ImageData(
        new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
        this._qoiDec.width,
        this._qoiDec.height
      );
      this._qoiDec.release();
    } else {
      imgBlob = bmSrc = new Blob([this._dec.data8], { type: metrics.mime });
    }
    this._dec.release();
    return createImageBitmap(bmSrc)
      .then(bm => {
        const [w, h] = this._resize(metrics.width, metrics.height);
        this._storage.addImage(new Drawable(bm), imgBlob, metrics, w / metrics.width, h / metrics.height);
        return true;
      })
      .catch(e => {
        console.warn(`IIP: decoding error ${metrics.mime} ${metrics.width}x${metrics.height}`, e);
        return true;
      });
  }

  private _resize(w: number, h: number): [number, number] {
    let cw;
    let ch;
    let width;
    let height;
    const dimensions = this._coreTerminal.dimensions;
    if (dimensions) {
      width = dimensions.device.canvas.width;
      height = dimensions.device.canvas.height;
      cw = width / this._coreTerminal.cols;
      ch = height / this._coreTerminal.rows;
    } else {
      cw = CELL_SIZE_DEFAULT.width;
      ch = CELL_SIZE_DEFAULT.height;
      width = cw * this._coreTerminal.cols;
      height = ch * this._coreTerminal.rows;
    }

    const rw = this._dim(this._header.width ?? '', width, cw);
    const rh = this._dim(this._header.height ?? '', height, ch);
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
    if (s.endsWith('%')) return parseInt(s.slice(0, -1), 10) * total / 100;
    if (s.endsWith('px')) return parseInt(s.slice(0, -2), 10);
    return parseInt(s, 10) * cdim;
  }
}
