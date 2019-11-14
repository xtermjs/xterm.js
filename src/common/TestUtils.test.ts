/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IBufferService, ICoreService, ILogService, IOptionsService, ITerminalOptions, IPartialTerminalOptions, IDirtyRowService, ICoreMouseService } from 'common/services/Services';
import { IEvent, EventEmitter } from 'common/EventEmitter';
import { clone } from 'common/Clone';
import { DEFAULT_OPTIONS } from 'common/services/OptionsService';
import { IBufferSet, IBuffer } from 'common/buffer/Types';
import { BufferSet } from 'common/buffer/BufferSet';
import { IDecPrivateModes, ICoreMouseEvent, CoreMouseEventType } from 'common/Types';

export class MockBufferService implements IBufferService {
  serviceBrand: any;
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

export class MockCoreMouseService implements ICoreMouseService {
  activeEncoding: string = '';
  activeProtocol: string = '';
  addEncoding(name: string): void {}
  addProtocol(name: string): void {}
  reset(): void {}
  triggerMouseEvent(event: ICoreMouseEvent): boolean { return false; }
  onProtocolChange: IEvent<CoreMouseEventType> = new EventEmitter<CoreMouseEventType>().event;
  explainEvents(events: CoreMouseEventType): {[event: string]: boolean} {
    throw new Error('Method not implemented.');
  }
}

export class MockCoreService implements ICoreService {
  isCursorInitialized: boolean = false;
  isCursorHidden: boolean = false;
  isFocused: boolean = false;
  serviceBrand: any;
  decPrivateModes: IDecPrivateModes = {} as any;
  onData: IEvent<string> = new EventEmitter<string>().event;
  onUserInput: IEvent<void> = new EventEmitter<void>().event;
  reset(): void {}
  triggerDataEvent(data: string, wasUserInput?: boolean): void {}
}

export class MockDirtyRowService implements IDirtyRowService {
  serviceBrand: any;
  start: number = 0;
  end: number = 0;
  clearRange(): void {}
  markDirty(y: number): void {}
  markRangeDirty(y1: number, y2: number): void {}
  markAllDirty(): void {}
}

export class MockLogService implements ILogService {
  serviceBrand: any;
  debug(message: any, ...optionalParams: any[]): void {}
  info(message: any, ...optionalParams: any[]): void {}
  warn(message: any, ...optionalParams: any[]): void {}
  error(message: any, ...optionalParams: any[]): void {}
}

export class MockOptionsService implements IOptionsService {
  serviceBrand: any;
  options: ITerminalOptions = clone(DEFAULT_OPTIONS);
  windowOptions = 0;
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
