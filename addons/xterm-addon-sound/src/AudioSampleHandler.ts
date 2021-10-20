import { Base64 } from './base64';

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
interface IDcsHandler {
  hook(params: IParams): void;
  put(data: Uint32Array, start: number, end: number): void;
  unhook(success: boolean): boolean | Promise<boolean>;
}
interface IWaveSnippet {
  // number of channels
  channels: number;
  // sampling width
  width: number;
  // sampling rate
  rate: number;
  byteLength: number;
  byteLengthB64: number;
}

export class AudioSampleHandler implements IDcsHandler {
  private _buffer = new Uint8Array(1000000);
  private _buffer2 = new Uint8Array(1000000);
  private _pos = 0;
  private _waveSnippet: IWaveSnippet | undefined;

  constructor(private _terminal: any) {}

  public hook(params: IParams): void {
    console.log(params.toArray());
    // TODO: sanitize params / default params
    this._waveSnippet = {
      channels: params.params[0],
      width: params.params[1],
      rate: params.params[2],
      byteLength: params.params[3],
      byteLengthB64: params.params[4]
    }
    this._pos = 0;
  }

  public put(data: Uint32Array, start: number, end: number): void {
    if (!this._waveSnippet) {
      return;
    }
    this._buffer.set(data.subarray(start, end), this._pos);
    this._pos += end - start;
  }

  public unhook(success: boolean): boolean | Promise<boolean> {
    if (!this._waveSnippet) {
      return true;
    }
    const idx = Base64.decode(this._buffer, this._buffer2, this._pos);

    // quick hack - load and play
    return new Promise(async res => {
      if (!this._waveSnippet) {
        return res(true);
      }
      const ctx = (this._terminal as any)._core?._soundService.constructor.audioContext as AudioContext;
      const audioBuffer = ctx.createBuffer(
        this._waveSnippet.channels,
        22050,
        this._waveSnippet.rate
      );

      for (let c = 0; c < this._waveSnippet.channels; ++c) {
        const data = audioBuffer.getChannelData(c);

        // TODO: iterate 2nd channel
        const buf16 = new Int16Array(this._buffer2.buffer, 0, idx / 2);
        for (let i = 0; i < 22050; ++i) {
          data[i] = buf16[i] / 32768;
          //const s = buf16[i];
          //data[i] = s < 0 ? s / 32768 : s / 32767;
        }
      }

      this._waveSnippet = undefined;
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
      source.onended = () => res(true);
    });
  }
}
