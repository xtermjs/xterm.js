/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IBufferService, IOptionsService } from 'common/services/Services';
import { BufferSet } from 'common/buffer/BufferSet';
import { IBufferSet, IBuffer } from 'common/buffer/Types';
import { EventEmitter, IEvent } from 'common/EventEmitter';
import { Disposable } from 'common/Lifecycle';

export const MINIMUM_COLS = 2; // Less than 2 can mess with wide chars
export const MINIMUM_ROWS = 1;

export class BufferService extends Disposable implements IBufferService {
  public serviceBrand: any;

  public cols: number;
  public rows: number;
  public buffers: IBufferSet;
  /** Whether the user is scrolling (locks the scroll position) */
  public isUserScrolling: boolean = false;

  private _onResize = new EventEmitter<{ cols: number, rows: number }>();
  public get onResize(): IEvent<{ cols: number, rows: number }> { return this._onResize.event; }

  public get buffer(): IBuffer { return this.buffers.active; }

  constructor(
    @IOptionsService private _optionsService: IOptionsService
  ) {
    super();
    this.cols = Math.max(_optionsService.options.cols, MINIMUM_COLS);
    this.rows = Math.max(_optionsService.options.rows, MINIMUM_ROWS);
    this.buffers = new BufferSet(_optionsService, this);
  }

  public dispose(): void {
    super.dispose();
    this.buffers.dispose();
  }

  public resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.buffers.resize(cols, rows);
    this.buffers.setupTabStops(this.cols);
    this._onResize.fire({ cols, rows });
  }

  public reset(): void {
    this.buffers.reset();
    this.isUserScrolling = false;
  }
}
