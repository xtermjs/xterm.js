/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IBufferService, IOptionsService, ITerminalOptions, IPartialTerminalOptions } from 'common/services/Services';
import { IEvent, EventEmitter } from 'common/EventEmitter';
import { clone } from 'common/Clone';
import { DEFAULT_OPTIONS } from 'common/services/OptionsService';
import { IBufferSet, IBuffer } from 'common/buffer/Types';
import { BufferSet } from 'common/buffer/BufferSet';

export class MockBufferService implements IBufferService {
  public get buffer(): IBuffer { return this.buffers.active; }
  public buffers: IBufferSet = {} as any;
  constructor(
    public cols: number,
    public rows: number,
    optionsService: IOptionsService = new MockOptionsService()
  ) {
    this.buffers = new BufferSet(optionsService, this);
  }
  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
  }
  reset(): void {}
}

export class MockOptionsService implements IOptionsService {
  options: ITerminalOptions = clone(DEFAULT_OPTIONS);
  onOptionChange: IEvent<string> = new EventEmitter<string>().event;
  constructor(testOptions?: IPartialTerminalOptions) {
    if (testOptions) {
      Object.keys(testOptions).forEach(key => this.options[key] = (<any>testOptions)[key]);
    }
  }
  setOption<T>(key: string, value: T): void {
    throw new Error('Method not implemented.');
  }
  getOption<T>(key: string): T {
    throw new Error('Method not implemented.');
  }
}
