/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IBufferService, IOptionsService } from 'common/services/Services';
import { BufferSet } from 'common/buffer/BufferSet';
import { IBufferSet, IBuffer } from 'common/buffer/Types';

export const MINIMUM_COLS = 2; // Less than 2 can mess with wide chars
export const MINIMUM_ROWS = 1;

export class BufferService implements IBufferService {
  public cols: number;
  public rows: number;
  public buffers: IBufferSet;

  public get buffer(): IBuffer { return this.buffers.active; }

  constructor(
    optionsService: IOptionsService
  ) {
    this.cols = Math.max(optionsService.options.cols, MINIMUM_COLS);
    this.rows = Math.max(optionsService.options.rows, MINIMUM_ROWS);
    this.buffers = new BufferSet(optionsService, this);
  }

  public resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
  }
}
