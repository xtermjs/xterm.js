/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from 'xterm';
import { IImageWorkerProtocol, IAckMsg, ISixelImageMsg, IChunkTransferMsg, ISixelImage, ISixelInitMsg, ISixelPutMsg, ISixelEndMsg } from './WorkerTypes';


/**
 * Manager to encapsulate certain worker aspects:
 * - lazy worker loading
 * - low level communication protocol with worker
 * - promise based image dispatcher
 * - mem pooling
 */
export class WorkerManager implements IDisposable {
  private _worker: Worker | undefined;
  private _memPool: ArrayBuffer[] = [];
  private _sixelResolver: ((img: ISixelImage | null) => void) | undefined;
  private _failedToLoad = false;
  private _poolChecker: any | undefined;
  private _lastActive = 0;

  private _startupError: () => void = () => {
    console.warn('ImageAddon worker failed to load, image output is disabled.');
    this._failedToLoad = true;
    this.dispose();
  };

  private _message(data: IImageWorkerProtocol): void {
    switch (data.type) {
      case 'CHUNK_TRANSFER':
        this.storeChunk((data as IChunkTransferMsg).payload);
        break;
      case 'SIXEL_IMAGE':
        if (this._sixelResolver) {
          this._sixelResolver((data as ISixelImageMsg).payload);
          this._sixelResolver = undefined;
        }
        break;
      case 'ACK':
        this._worker?.removeEventListener('error', this._startupError);
    }
  }

  private _setSixelResolver(f?: (img: ISixelImage | null) => void): void {
    if (this._sixelResolver) {
      this._sixelResolver(null);
    }
    this._sixelResolver = f;
  }

  constructor(public url: string, public chunkSize: number = 65536, public maxPoolSize: number = 100) {}

  public dispose(): void {
    this._worker?.terminate();
    this._worker = undefined;
    this._memPool.length = 0;
    this._setSixelResolver();
  }

  public get worker(): Worker | undefined {
    if (!this._worker && !this._failedToLoad) {
      this._worker = new Worker(this.url);
      this._worker.addEventListener('message', ev => this._message(ev.data), false);
      this._worker.addEventListener('error', this._startupError, false);
      this._worker.postMessage({type: 'ACK', payload: 'ping'} as IAckMsg);
    }
    return this._worker;
  }

  public getChunk(): ArrayBuffer {
    this._lastActive = Date.now();
    return this._memPool.pop() || new ArrayBuffer(this.chunkSize);
  }

  public storeChunk(chunk: ArrayBuffer): void {
    if (!this._poolChecker) {
      this._poolChecker = setInterval(() => {
        if (Date.now() - this._lastActive > 20000) {
          this.flushPool();
          clearInterval(this._poolChecker);
          this._poolChecker = undefined;
        }
      }, 20000);
    }
    if (this._memPool.length < this.maxPoolSize) {
      this._memPool.push(chunk);
    }
  }

  public flushPool(): void {
    this._memPool.length = 0;
  }

  // SIXEL message interface
  public sixelInit(fillColor: number, paletteName: string, limit: number): void {
    this._setSixelResolver();
    this.worker?.postMessage({
      type: 'SIXEL_INIT',
      payload: {fillColor, paletteName, limit}
    } as ISixelInitMsg);
  }
  public sixelPut(data: Uint8Array, length: number): void {
    this.worker?.postMessage({
      type: 'SIXEL_PUT',
      payload: {
        buffer: data.buffer,
        length
      }
    } as ISixelPutMsg, [data.buffer]);
  }
  public sixelEnd(success: boolean): Promise<ISixelImage|null> | void {
    let result: Promise<ISixelImage|null> | undefined;
    if (success && this.worker) {
      result = new Promise<ISixelImage|null>(resolve => this._setSixelResolver(resolve));
    }
    this.worker?.postMessage({
      type: 'SIXEL_END',
      payload: success
    } as ISixelEndMsg);
    return result;
  }
}
