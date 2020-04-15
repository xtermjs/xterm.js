/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IBufferService, IDirtyRowService } from 'common/services/Services';

export class DirtyRowService implements IDirtyRowService {
  public serviceBrand: any;

  private _start!: number;
  private _end!: number;

  public get start(): number { return this._start; }
  public get end(): number { return this._end; }

  constructor(
    @IBufferService private readonly _bufferService: IBufferService
  ) {
    this.clearRange();
  }

  public clearRange(): void {
    this._start = this._bufferService.buffer.y;
    this._end = this._bufferService.buffer.y;
  }

  public markDirty(y: number): void {
    if (y < this._start) {
      this._start = y;
    } else if (y > this._end) {
      this._end = y;
    }
  }

  public markRangeDirty(y1: number, y2: number): void {
    if (y1 > y2) {
      const temp = y1;
      y1 = y2;
      y2 = temp;
    }
    if (y1 < this._start) {
      this._start = y1;
    }
    if (y2 > this._end) {
      this._end = y2;
    }
  }

  public markAllDirty(): void {
    this.markRangeDirty(0, this._bufferService.rows - 1);
  }
}
