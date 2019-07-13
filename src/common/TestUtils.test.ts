/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IBufferService, ICoreService, ILogService, IOptionsService, ITerminalOptions, IPartialTerminalOptions } from 'common/services/Services';
import { IEvent, EventEmitter } from 'common/EventEmitter';
import { clone } from 'common/Clone';
import { DEFAULT_OPTIONS } from 'common/services/OptionsService';
import { IBufferSet, IBuffer } from 'common/buffer/Types';
import { BufferSet } from 'common/buffer/BufferSet';
import { IDecPrivateModes } from 'common/Types';

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

export class MockCoreService implements ICoreService {
  decPrivateModes: IDecPrivateModes = {} as any;
  onData: IEvent<string> = new EventEmitter<string>().event;
  onUserInput: IEvent<void> = new EventEmitter<void>().event;
  reset(): void {}
  triggerDataEvent(data: string, wasUserInput?: boolean): void {}
}

export class MockLogService implements ILogService {
  debug(message: any, ...optionalParams: any[]): void {}
  info(message: any, ...optionalParams: any[]): void {}
  warn(message: any, ...optionalParams: any[]): void {}
  error(message: any, ...optionalParams: any[]): void {}
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
