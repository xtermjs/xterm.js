/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IBufferService, IOptionsService } from './Services';

export const MINIMUM_COLS = 2; // Less than 2 can mess with wide chars
export const MINIMUM_ROWS = 1;

export class BufferService implements IBufferService {
  public cols: number;
  public rows: number;

  constructor(
    optionsService: IOptionsService
  ) {
    this.cols = Math.max(optionsService.options.cols, MINIMUM_COLS);
    this.rows = Math.max(optionsService.options.rows, MINIMUM_ROWS);
  }

  public resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
  }
}
